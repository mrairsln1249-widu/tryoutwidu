import pool, { query, queryOne, insert, update, remove } from '@/lib/db';
import { requireAuth, requireAdmin, requireStaff, jsonError, jsonSuccess } from '@/lib/auth';
import { estimateAbilityEAP, getAbilityPercentile } from '@/lib/irt';
import { gradeFromScore, resolveScoreScale, scaleRawPercentageToScore } from '@/lib/scoring';

const VALID_ANSWERS = new Set(['A', 'B', 'C', 'D', 'E']);
const VALID_DIFFICULTY_LEVELS = new Set(['easy', 'medium', 'hard']);
const VALID_QUESTION_TYPES = new Set(['multiple_choice', 'multiple_choice_complex', 'true_false', 'short_answer', 'essay']);

function toNullableInt(value) {
    if (value === '' || value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isInteger(value) ? value : null;

    const text = String(value).trim();
    if (!/^\d+$/.test(text)) return null;

    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function placeholders(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr.map(() => '?').join(',');
}

function normalizeImportRow(row) {
    const subjectId = toNullableInt(row.subject_id);
    const examId = toNullableInt(row.exam_id);
    const difficultyLevel = String(row.difficulty_level || 'medium').trim().toLowerCase();
    const questionType = String(row.question_type || 'multiple_choice').trim().toLowerCase();

    let correctAnswer = String(row.correct_answer || '').trim();
    if (questionType === 'multiple_choice' || questionType === 'true_false') {
        correctAnswer = correctAnswer.toUpperCase();
    }

    return {
        subject_id: subjectId,
        exam_id: examId,
        question_type: VALID_QUESTION_TYPES.has(questionType) ? questionType : 'multiple_choice',
        question_text: String(row.question_text || '').trim(),
        option_a: String(row.option_a || '').trim(),
        option_b: String(row.option_b || '').trim(),
        option_c: String(row.option_c || '').trim(),
        option_d: String(row.option_d || '').trim(),
        option_e: String(row.option_e || '').trim(),
        correct_answer: correctAnswer,
        difficulty_level: VALID_DIFFICULTY_LEVELS.has(difficultyLevel) ? difficultyLevel : 'medium',
        explanation: String(row.explanation || '').trim(),
    };
}

function hasSelectedOption(row) {
    if (row.question_type !== 'multiple_choice') return true;
    if (row.correct_answer === 'A') return Boolean(row.option_a);
    if (row.correct_answer === 'B') return Boolean(row.option_b);
    if (row.correct_answer === 'C') return Boolean(row.option_c);
    if (row.correct_answer === 'D') return Boolean(row.option_d);
    if (row.correct_answer === 'E') return Boolean(row.option_e);
    return false;
}

function parseScoreMax(rawMaxScore, passingScore) {
    const passing = parseInt(passingScore, 10);
    if (!Number.isNaN(passing) && passing > 100) return 1000;

    const max = parseInt(rawMaxScore, 10);
    if (max >= 1000) return 1000;
    if (max > 100) return 1000;
    if (max > 0) return 100;
    return 100;
}

function parsePositiveInt(value) {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function createSeededRandom(seedInput) {
    let seed = 2166136261;
    const text = String(seedInput);
    for (let i = 0; i < text.length; i += 1) {
        seed ^= text.charCodeAt(i);
        seed = Math.imul(seed, 16777619);
    }
    return function nextRandom() {
        seed += 0x6D2B79F5;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

async function getTeacherSubjects(userId) {
    const subs = await query('SELECT subject_id FROM teacher_subjects WHERE teacher_id = ?', [userId]);
    return subs.map(s => s.subject_id);
}

function parseSubjectIds(rawValue) {
    if (Array.isArray(rawValue)) {
        return [...new Set(rawValue.map(toNullableInt).filter(Boolean))];
    }
    if (rawValue === null || rawValue === undefined || rawValue === '') return [];

    if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return [...new Set(parsed.map(toNullableInt).filter(Boolean))];
            }
        } catch {
            // no-op: fallback to CSV parse below
        }

        return [...new Set(trimmed.split(',').map(part => toNullableInt(part.trim())).filter(Boolean))];
    }

    const single = toNullableInt(rawValue);
    return single ? [single] : [];
}

function normalizeSubjectIdsInput(subjectIdsInput, fallbackSubjectId) {
    const parsed = parseSubjectIds(subjectIdsInput);
    if (parsed.length > 0) return parsed;

    const fallback = toNullableInt(fallbackSubjectId);
    return fallback ? [fallback] : [];
}

function getExamSubjectIds(exam) {
    if (!exam || typeof exam !== 'object') return [];
    return normalizeSubjectIdsInput(exam.subject_ids, exam.subject_id);
}

function examHasSubject(exam, subjectId) {
    const parsedSubjectId = toNullableInt(subjectId);
    if (!parsedSubjectId) return false;
    return getExamSubjectIds(exam).includes(parsedSubjectId);
}

function examHasAnySubject(exam, subjectIds = []) {
    const examSubjects = new Set(getExamSubjectIds(exam));
    return subjectIds.some(id => examSubjects.has(toNullableInt(id)));
}

function stringifySubjectIds(subjectIds) {
    return JSON.stringify([...new Set((subjectIds || []).map(toNullableInt).filter(Boolean))]);
}

async function checkSubjectAccess(user, subjectId) {
    if (user.role === 'admin') return true;
    if (user.role === 'teacher') {
        const allowed = await getTeacherSubjects(user.id);
        return allowed.includes(parseInt(subjectId));
    }
    return false;
}

async function checkAnySubjectAccess(user, subjectIds = []) {
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'teacher') return false;
    const allowed = await getTeacherSubjects(user.id);
    const allowedSet = new Set(allowed.map(Number));
    return subjectIds.some(id => allowedSet.has(Number(id)));
}

async function checkAllSubjectAccess(user, subjectIds = []) {
    if (!Array.isArray(subjectIds) || subjectIds.length === 0) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'teacher') return false;
    const allowed = await getTeacherSubjects(user.id);
    const allowedSet = new Set(allowed.map(Number));
    return subjectIds.every(id => allowedSet.has(Number(id)));
}

async function enrichExamsWithSubjects(exams = []) {
    if (!Array.isArray(exams) || exams.length === 0) return [];

    const allSubjectIds = [...new Set(exams.flatMap(exam => getExamSubjectIds(exam)).map(Number).filter(Boolean))];
    const subjectMap = new Map();

    if (allSubjectIds.length > 0) {
        const rows = await query(
            `SELECT id, name, icon, category, level_class
             FROM subjects
             WHERE id IN (${placeholders(allSubjectIds)})`,
            allSubjectIds
        );
        rows.forEach(row => subjectMap.set(Number(row.id), row));
    }

    return exams.map(exam => {
        const subjectIds = getExamSubjectIds(exam);
        const subjects = subjectIds
            .map(id => subjectMap.get(Number(id)))
            .filter(Boolean)
            .map(row => ({
                id: Number(row.id),
                name: row.name,
                icon: row.icon,
                category: row.category,
                level_class: row.level_class,
            }));

        const subjectNames = subjects.map(s => s.name);
        const subjectIcons = subjects.map(s => s.icon).filter(Boolean);
        const primarySubject = subjects[0];

        return {
            ...exam,
            subject_id: subjectIds[0] || toNullableInt(exam.subject_id),
            subject_ids: subjectIds,
            subjects,
            subject_names: subjectNames,
            subject_name: subjectNames.join(', ') || exam.subject_name || primarySubject?.name || '-',
            subject_icon: subjectIcons[0] || exam.subject_icon || primarySubject?.icon || '📚',
            category: primarySubject?.category || exam.category || null,
        };
    });
}

function shuffleDeterministic(items, seedInput) {
    const result = [...items];
    const random = createSeededRandom(seedInput);
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function shuffleQuestionForAttempt(question, seedInput) {
    if (question.question_type !== 'multiple_choice' && question.question_type !== 'multiple_choice_complex') {
        return question;
    }
    const availableOriginalLetters = ['A', 'B', 'C', 'D', 'E']
        .filter(letter => {
            const value = question[`option_${letter.toLowerCase()}`];
            return value !== null && value !== undefined && value !== '';
        });

    const shuffledOriginalLetters = shuffleDeterministic(availableOriginalLetters, seedInput);
    const displayLetters = ['A', 'B', 'C', 'D', 'E'];
    const displayToOriginal = {};
    const originalToDisplay = {};

    const shuffled = { ...question };

    // Support custom options JSON
    if (question.options) {
        try {
            const opts = typeof question.options === 'string' ? JSON.parse(question.options) : question.options;
            if (Array.isArray(opts) && opts.length > 0) {
                const availableIndices = opts.map((_, i) => i);
                const shuffledIndices = shuffleDeterministic(availableIndices, seedInput);

                const shuffledOpts = [];
                const displayToOriginal = {};
                const originalToDisplay = {};

                shuffledIndices.forEach((origIdx, dispIdx) => {
                    const dispLetter = String.fromCharCode(65 + dispIdx); // A, B, C...
                    const origLetter = String.fromCharCode(65 + origIdx);

                    displayToOriginal[dispLetter] = origLetter;
                    originalToDisplay[origLetter] = dispLetter;

                    shuffledOpts.push({
                        ...opts[origIdx],
                        label: dispLetter
                    });
                });

                shuffled.options = JSON.stringify(shuffledOpts);
                shuffled.option_map = displayToOriginal;
                shuffled._original_to_display = originalToDisplay;
                return shuffled;
            }
        } catch (e) {
            console.error('Error parsing question options:', e);
        }
    }

    for (let i = 0; i < displayLetters.length; i += 1) {
        const displayLetter = displayLetters[i];
        const originalLetter = shuffledOriginalLetters[i];
        const optionKey = `option_${displayLetter.toLowerCase()}`;
        if (originalLetter) {
            displayToOriginal[displayLetter] = originalLetter;
            originalToDisplay[originalLetter] = displayLetter;
            shuffled[optionKey] = question[`option_${originalLetter.toLowerCase()}`];
        } else {
            shuffled[optionKey] = null;
        }
    }

    shuffled.option_map = displayToOriginal;
    shuffled._original_to_display = originalToDisplay;
    return shuffled;
}

let hasMaxScoreColumnCache = null;
let hasSubjectIdsColumnCache = null;

async function hasMaxScoreColumn() {
    if (hasMaxScoreColumnCache !== null) return hasMaxScoreColumnCache;

    const row = await queryOne(
        `SELECT COUNT(*) as total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'exams'
         AND COLUMN_NAME = 'max_score'`
    );
    hasMaxScoreColumnCache = Number(row?.total || 0) > 0;
    return hasMaxScoreColumnCache;
}

async function hasSubjectIdsColumn() {
    if (hasSubjectIdsColumnCache !== null) return hasSubjectIdsColumnCache;

    const row = await queryOne(
        `SELECT COUNT(*) as total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'exams'
         AND COLUMN_NAME = 'subject_ids'`
    );
    hasSubjectIdsColumnCache = Number(row?.total || 0) > 0;
    return hasSubjectIdsColumnCache;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'list') {
            const subjectId = toNullableInt(searchParams.get('subject_id'));

            const rawExams = await query(
                `SELECT e.*, s.name as subject_name, s.icon as subject_icon, s.category,
                (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
         FROM exams e 
         LEFT JOIN subjects s ON e.subject_id = s.id
         WHERE e.is_active = 1
         ORDER BY e.created_at DESC`,
                []
            );
            let exams = await enrichExamsWithSubjects(rawExams);
            if (subjectId) {
                exams = exams.filter(exam => examHasSubject(exam, subjectId));
            }
            return jsonSuccess({ exams });
        }

        if (action === 'detail') {
            const id = searchParams.get('id');
            const examRaw = await queryOne(
                `SELECT e.*, s.name as subject_name, s.icon as subject_icon 
         FROM exams e LEFT JOIN subjects s ON e.subject_id = s.id WHERE e.id = ?`, [id]
            );
            if (!examRaw) return jsonError('Ujian tidak ditemukan', 404);

            const [exam] = await enrichExamsWithSubjects([examRaw]);

            const questions = await query(
                `SELECT q.*, eq.question_order FROM questions q 
         JOIN exam_questions eq ON q.id = eq.question_id 
         WHERE eq.exam_id = ? ORDER BY eq.question_order`, [id]
            );
            return jsonSuccess({ exam, questions });
        }

        if (action === 'take') {
            const user = await requireAuth(request);
            const examId = searchParams.get('id');
            const exam = await queryOne('SELECT * FROM exams WHERE id = ? AND is_active = 1', [examId]);
            if (!exam) return jsonError('Ujian tidak ditemukan atau tidak aktif', 404);

            let attempt = await queryOne(
                `SELECT * FROM exam_attempts WHERE user_id = ? AND exam_id = ? AND status = 'in_progress' 
         ORDER BY created_at DESC LIMIT 1`, [user.id, examId]
            );

            if (!attempt) {
                const attemptId = await insert('exam_attempts', {
                    user_id: user.id, exam_id: examId, start_time: new Date(), status: 'in_progress'
                });
                attempt = await queryOne('SELECT * FROM exam_attempts WHERE id = ?', [attemptId]);
            }

            const baseQuestions = await query(
                `SELECT q.id, q.question_type, q.question_text, q.options, 
                q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, 
                eq.question_order
FROM questions q JOIN exam_questions eq ON q.id = eq.question_id 
WHERE eq.exam_id = ? ORDER BY eq.question_order`, [examId]
            );

            const shuffledQuestionOrder = shuffleDeterministic(
                baseQuestions,
                `exam:${examId}:attempt:${attempt.id}:user:${user.id}`
            );

            // Apply question limit if set
            let limitedQuestions = shuffledQuestionOrder;
            if (exam.question_limit && exam.question_limit > 0) {
                limitedQuestions = shuffledQuestionOrder.slice(0, exam.question_limit);
            }

            const questions = limitedQuestions.map((question, index) =>
                shuffleQuestionForAttempt(
                    { ...question, question_order: index + 1 },
                    `exam:${examId}:attempt:${attempt.id}:question:${question.id}`
                )
            );
            const questionById = new Map(questions.map(q => [q.id, q]));

            const answers = await query(
                'SELECT question_id, selected_answer FROM student_answers WHERE attempt_id = ?', [attempt.id]
            );
            const answerMap = {};
            answers.forEach(a => {
                const question = questionById.get(a.question_id);
                if ((question?.question_type === 'multiple_choice' || question?.question_type === 'multiple_choice_complex') && question?._original_to_display) {
                    const parts = String(a.selected_answer || '').split(',').filter(Boolean);
                    const mappedParts = parts.map(p => question._original_to_display[p] || p);
                    answerMap[a.question_id] = mappedParts.join(',');
                } else {
                    answerMap[a.question_id] = a.selected_answer;
                }
            });
            questions.forEach(q => { delete q._original_to_display; });

            const startTime = new Date(attempt.start_time).getTime();
            const endTime = startTime + exam.duration * 60 * 1000;
            const timeRemaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

            return jsonSuccess({ exam, attempt, questions, answers: answerMap, timeRemaining });
        }

        if (action === 'all') {
            const user = await requireStaff(request);
            const rawExams = await query(
                `SELECT e.*, s.name as subject_name, s.icon as subject_icon,
                (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
                (SELECT COUNT(*) FROM exam_attempts WHERE exam_id = e.id AND status = 'completed') as attempt_count
         FROM exams e LEFT JOIN subjects s ON e.subject_id = s.id
         WHERE 1=1
         ORDER BY e.created_at DESC`,
                []
            );
            let exams = await enrichExamsWithSubjects(rawExams);

            if (user.role === 'teacher') {
                const allowed = await getTeacherSubjects(user.id);
                if (allowed.length === 0) return jsonSuccess({ exams: [] });
                const allowedSet = new Set(allowed.map(Number));
                exams = exams.filter(exam => {
                    const examSubjectIds = getExamSubjectIds(exam);
                    return examSubjectIds.length > 0 && examSubjectIds.every(id => allowedSet.has(Number(id)));
                });
            }

            return jsonSuccess({ exams });
        }

        if (action === 'questions') {
            const user = await requireStaff(request);
            const examId = searchParams.get('exam_id');
            const subjectId = searchParams.get('subject_id');
            const difficulty = searchParams.get('difficulty');
            const type = searchParams.get('type');
            const search = searchParams.get('search');

            let w = '1=1', p = [];

            if (examId) {
                const exam = await queryOne('SELECT * FROM exams WHERE id = ?', [examId]);
                if (!exam) return jsonError('Akses ditolak');
                const examSubjectIds = getExamSubjectIds(exam);
                if (!(await checkAnySubjectAccess(user, examSubjectIds))) return jsonError('Akses ditolak');
                w += ' AND q.exam_id = ?'; p.push(examId);
                if (user.role === 'teacher') {
                    const allowed = await getTeacherSubjects(user.id);
                    if (allowed.length === 0) return jsonSuccess({ questions: [] });
                    w += ` AND q.subject_id IN (${placeholders(allowed)})`;
                    p.push(...allowed);
                }
            } else if (subjectId) {
                if (!(await checkSubjectAccess(user, subjectId))) return jsonError('Akses ditolak');
                w += ' AND q.subject_id = ?'; p.push(subjectId);
            } else if (user.role === 'teacher') {
                const allowed = await getTeacherSubjects(user.id);
                if (allowed.length === 0) return jsonSuccess({ questions: [] });
                w += ` AND q.subject_id IN (${placeholders(allowed)})`;
                p.push(...allowed);
            }

            if (difficulty) {
                w += ' AND q.difficulty_level = ?';
                p.push(difficulty);
            }
            if (type) {
                w += ' AND q.question_type = ?';
                p.push(type);
            }
            if (search) {
                w += ' AND q.question_text LIKE ?';
                p.push(`%${search}%`);
            }

            const questions = await query(
                `SELECT q.*, s.name as subject_name FROM questions q 
         LEFT JOIN subjects s ON q.subject_id = s.id WHERE ${w} ORDER BY q.id DESC`, p
            );
            return jsonSuccess({ questions });
        }

        if (action === 'result') {
            const user = await requireAuth(request);
            const attemptId = searchParams.get('attempt_id');
            const attemptRow = await queryOne(
                `SELECT ea.*, e.subject_id, e.title, e.duration, e.total_questions, e.passing_score, e.max_score,
                s.name as subject_name, s.icon as subject_icon
         FROM exam_attempts ea 
         JOIN exams e ON ea.exam_id = e.id 
         JOIN subjects s ON e.subject_id = s.id 
         WHERE ea.id = ? AND ea.user_id = ?`, [attemptId, user.id]
            );
            if (!attemptRow) return jsonError('Hasil tidak ditemukan', 404);

            const examMeta = await queryOne('SELECT * FROM exams WHERE id = ?', [attemptRow.exam_id]);
            const [attemptMeta] = await enrichExamsWithSubjects([{
                ...attemptRow,
                subject_id: examMeta?.subject_id || attemptRow.subject_id,
                subject_ids: examMeta?.subject_ids,
            }]);

            const scale = resolveScoreScale({
                maxScore: attemptMeta.max_score,
                passingScore: attemptMeta.passing_score,
                score: attemptMeta.score,
            });
            const attempt = {
                ...attemptMeta,
                score_min: scale.min,
                score_max: scale.max,
            };

            const answers = await query(
                `SELECT sa.*, q.question_type, q.question_text, q.options,
                q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
                q.correct_answer, q.explanation, q.difficulty_level, q.discrimination, q.difficulty, q.guessing, q.topic
FROM student_answers sa 
JOIN questions q ON sa.question_id = q.id 
WHERE sa.attempt_id = ? ORDER BY q.id`, [attemptId]
            );

            const trendSubjectId = getExamSubjectIds(examMeta || attemptMeta)[0] || attemptMeta.subject_id;
            const trend = await query(
                `SELECT ea2.id as attempt_id, ea2.score, ea2.end_time, e2.passing_score, e2.max_score
         FROM exam_attempts ea2
         JOIN exams e2 ON ea2.exam_id = e2.id
         WHERE ea2.user_id = ? 
           AND ea2.status = 'completed'
           AND ea2.score IS NOT NULL
           AND e2.subject_id = ?
         ORDER BY ea2.end_time DESC
         LIMIT 8`,
                [user.id, trendSubjectId]
            );

            return jsonSuccess({ attempt, answers, trend: trend.reverse() });
        }

        if (action === 'monitoring') {
            const user = await requireStaff(request);
            const activeAttemptsRaw = await query(
                `SELECT 
                    ea.id as attempt_id,
                    ea.exam_id,
                    u.full_name,
                    u.school,
                    u.grade,
                    e.title as exam_title,
                    e.duration,
                    e.subject_id,
                    ea.start_time,
                    ea.status,
                    (SELECT COUNT(*) FROM student_answers WHERE attempt_id = ea.id) as answered_count,
                    (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as total_questions
                 FROM exam_attempts ea
                 JOIN users u ON ea.user_id = u.id
                 JOIN exams e ON ea.exam_id = e.id
                 WHERE ea.status = 'in_progress'
                 ORDER BY ea.start_time DESC`,
                []
            );

            let activeAttempts = activeAttemptsRaw;
            if (user.role === 'teacher') {
                const allowed = await getTeacherSubjects(user.id);
                if (allowed.length === 0) return jsonSuccess({ monitoring: [] });

                const examIds = [...new Set(activeAttempts.map(a => Number(a.exam_id)).filter(Boolean))];
                const examRows = examIds.length
                    ? await query(`SELECT * FROM exams WHERE id IN (${placeholders(examIds)})`, examIds)
                    : [];
                const examMap = new Map(examRows.map(ex => [Number(ex.id), ex]));

                activeAttempts = activeAttempts.filter(a => {
                    const examRef = examMap.get(Number(a.exam_id)) || a;
                    return examHasAnySubject(examRef, allowed);
                });
            }

            // Calculate estimated time remaining for each attempt
            const monitoring = activeAttempts.map(a => {
                const startTime = new Date(a.start_time).getTime();
                const endTime = startTime + a.duration * 60 * 1000;
                const remainingRaw = Math.max(0, Math.floor((endTime - Date.now()) / 1000));

                return {
                    ...a,
                    remaining_seconds: remainingRaw,
                    progress_percent: a.total_questions > 0 ? Math.round((a.answered_count / a.total_questions) * 100) : 0
                };
            });

            return jsonSuccess({ monitoring });
        }

        if (action === 'exam_results') {
            const user = await requireStaff(request);
            const examId = searchParams.get('exam_id');
            const examRaw = await queryOne('SELECT * FROM exams WHERE id = ?', [examId]);
            if (!examRaw) return jsonError('Akses ditolak');
            if (!(await checkAnySubjectAccess(user, getExamSubjectIds(examRaw)))) return jsonError('Akses ditolak');

            const [exam] = await enrichExamsWithSubjects([examRaw]);

            const results = await query(
                `SELECT ea.*, u.full_name, u.school, u.grade, u.email
                 FROM exam_attempts ea
                 JOIN users u ON ea.user_id = u.id
                 WHERE ea.exam_id = ? AND ea.status = 'completed'
                 ORDER BY ea.score DESC, ea.end_time ASC`,
                [examId]
            );

            return jsonSuccess({ exam, results });
        }

        return jsonError('Invalid action');
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Access Denied', 403);
        console.error('Exams GET error:', error);
        return jsonError('Server error', 500);
    }
}

export async function POST(request) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { action } = body;

        if (action === 'answer') {
            const { attempt_id, question_id, selected_answer } = body;
            const existing = await queryOne(
                'SELECT id FROM student_answers WHERE attempt_id = ? AND question_id = ?',
                [attempt_id, question_id]
            );
            const question = await queryOne('SELECT question_type, correct_answer FROM questions WHERE id = ?', [question_id]);

            let isCorrect = 0;
            if (question) {
                if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
                    isCorrect = (selected_answer === question.correct_answer) ? 1 : 0;
                } else if (question.question_type === 'multiple_choice_complex') {
                    const sel = String(selected_answer || '').split(',').filter(Boolean).sort().join(',');
                    const cor = String(question.correct_answer || '').split(',').filter(Boolean).sort().join(',');
                    isCorrect = (sel === cor && sel !== '') ? 1 : 0;
                } else if (question.question_type === 'short_answer') {
                    isCorrect = (String(selected_answer || '').trim().toLowerCase() === String(question.correct_answer || '').trim().toLowerCase()) ? 1 : 0;
                } else if (question.question_type === 'essay') {
                    isCorrect = 0; // Manual grading
                }
            }

            if (existing) {
                await update('student_answers', { selected_answer, is_correct: isCorrect }, 'id = ?', [existing.id]);
            } else {
                await insert('student_answers', { attempt_id, question_id, selected_answer, is_correct: isCorrect });
            }
            return jsonSuccess({ message: 'Jawaban disimpan' });
        }

        if (action === 'submit') {
            const { attempt_id } = body;
            const attempt = await queryOne('SELECT * FROM exam_attempts WHERE id = ? AND user_id = ?', [attempt_id, user.id]);
            if (!attempt) return jsonError('Attempt tidak ditemukan');

            const exam = await queryOne('SELECT * FROM exams WHERE id = ?', [attempt.exam_id]);
            if (!exam) return jsonError('Ujian tidak ditemukan');
            const maxScore = parseScoreMax(exam.max_score, exam.passing_score);
            const scoreScale = resolveScoreScale({
                maxScore,
                passingScore: exam.passing_score,
            });

            const answers = await query(
                `SELECT sa.is_correct, q.discrimination, q.difficulty, q.guessing 
         FROM student_answers sa JOIN questions q ON sa.question_id = q.id 
         WHERE sa.attempt_id = ?`, [attempt_id]
            );

            const correct = answers.filter(a => a.is_correct).length;
            const total = answers.length;
            const rawPercentage = total > 0 ? (correct / total) * 100 : 0;
            const score = scaleRawPercentageToScore(rawPercentage, scoreScale);

            let abilityScore = 0, standardError = 1, percentile = 50;
            try {
                const responses = answers.map(a => a.is_correct ? 1 : 0);
                const items = answers.map(a => ({
                    discrimination: a.discrimination || 1,
                    difficulty: a.difficulty || 0,
                    guessing: a.guessing || 0.25,
                }));
                if (responses.length > 0) {
                    abilityScore = estimateAbilityEAP(responses, items);
                    percentile = getAbilityPercentile(abilityScore);
                }
            } catch (e) { console.error('IRT error:', e); }

            await update('exam_attempts', {
                end_time: new Date(),
                score: (typeof score === 'number' && !isNaN(score)) ? score : 0,
                ability_score: (typeof abilityScore === 'number' && !isNaN(abilityScore)) ? abilityScore : 0,
                standard_error: (typeof standardError === 'number' && !isNaN(standardError)) ? standardError : 1,
                percentile: (typeof percentile === 'number' && !isNaN(percentile)) ? percentile : 50,
                status: 'completed',
            }, 'id = ?', [attempt_id]);

            return jsonSuccess({
                score,
                correct,
                total,
                ability_score: abilityScore,
                percentile,
                grade: gradeFromScore(score, scoreScale),
                score_scale: scoreScale,
            });
        }

        if (action === 'create') {
            const user = await requireStaff(request);
            const { title, subject_id, subject_ids, description, duration, passing_score, difficulty_level, max_score, question_limit } = body;
            const normalizedSubjectIds = normalizeSubjectIdsInput(subject_ids, subject_id);
            if (!title || normalizedSubjectIds.length === 0 || !duration) return jsonError('Data ujian tidak lengkap');

            if (!(await checkAllSubjectAccess(user, normalizedSubjectIds))) return jsonError('Bukan mata pelajaran Anda');
            const primarySubjectId = normalizedSubjectIds[0];

            const parsedDuration = parsePositiveInt(duration);
            if (!parsedDuration) return jsonError('Durasi harus lebih dari 0 menit');

            const parsedMaxScore = parseScoreMax(max_score, passing_score);
            const scoreScale = resolveScoreScale({ maxScore: parsedMaxScore, passingScore: passing_score });
            const defaultPassing = parsedMaxScore >= 1000 ? 550 : 60;
            const parsedPassingScore = parseInt(passing_score ?? defaultPassing, 10);
            if (Number.isNaN(parsedPassingScore)) return jsonError('Passing score tidak valid');
            if (parsedPassingScore < scoreScale.min || parsedPassingScore > scoreScale.max) {
                return jsonError(`Passing score harus di rentang ${scoreScale.min}-${scoreScale.max}`);
            }

            const examData = {
                title,
                subject_id: primarySubjectId,
                description: description || '',
                duration: parsedDuration,
                passing_score: parsedPassingScore,
                difficulty_level: difficulty_level || 'medium',
                question_limit: toNullableInt(question_limit),
                is_active: 1,
                created_by: user.id,
            };
            const maxScoreColumnExists = await hasMaxScoreColumn();
            if (!maxScoreColumnExists && parsedMaxScore === 1000 && parsedPassingScore <= 100) {
                return jsonError('Skala 10-1000 membutuhkan kolom max_score. Jalankan: npm run migrate:max-score');
            }
            if (maxScoreColumnExists) examData.max_score = parsedMaxScore;
            const subjectIdsColumnExists = await hasSubjectIdsColumn();
            if (!subjectIdsColumnExists && normalizedSubjectIds.length > 1) {
                return jsonError('Multi mapel membutuhkan kolom subject_ids. Jalankan: npm run migrate:exam-subject-ids');
            }
            if (subjectIdsColumnExists) examData.subject_ids = stringifySubjectIds(normalizedSubjectIds);

            const id = await insert('exams', examData);
            return jsonSuccess({ message: 'Ujian berhasil dibuat', id }, 201);
        }

        if (action === 'update_exam') {
            const user = await requireStaff(request);
            const { id, title, subject_id, subject_ids, description, duration, passing_score, difficulty_level, is_active, max_score, question_limit } = body;
            const normalizedSubjectIds = normalizeSubjectIdsInput(subject_ids, subject_id);
            if (normalizedSubjectIds.length === 0) return jsonError('Pilih minimal 1 mata pelajaran');

            if (!(await checkAllSubjectAccess(user, normalizedSubjectIds))) return jsonError('Bukan mata pelajaran Anda');
            const target = await queryOne('SELECT * FROM exams WHERE id = ?', [id]);
            if (!target || !(await checkAnySubjectAccess(user, getExamSubjectIds(target)))) return jsonError('Akses ditolak');
            const primarySubjectId = normalizedSubjectIds[0];

            const parsedDuration = parsePositiveInt(duration);
            if (!parsedDuration) return jsonError('Durasi harus lebih dari 0 menit');

            const parsedMaxScore = parseScoreMax(max_score, passing_score);
            const scoreScale = resolveScoreScale({ maxScore: parsedMaxScore, passingScore: passing_score });
            const defaultPassing = parsedMaxScore >= 1000 ? 550 : 60;
            const parsedPassingScore = parseInt(passing_score ?? defaultPassing, 10);
            if (Number.isNaN(parsedPassingScore)) return jsonError('Passing score tidak valid');
            if (parsedPassingScore < scoreScale.min || parsedPassingScore > scoreScale.max) {
                return jsonError(`Passing score harus di rentang ${scoreScale.min}-${scoreScale.max}`);
            }

            const examData = {
                title,
                subject_id: primarySubjectId,
                description,
                duration: parsedDuration,
                passing_score: parsedPassingScore,
                difficulty_level,
                question_limit: toNullableInt(question_limit),
                is_active: is_active ? 1 : 0,
            };
            const maxScoreColumnExists = await hasMaxScoreColumn();
            if (!maxScoreColumnExists && parsedMaxScore === 1000 && parsedPassingScore <= 100) {
                return jsonError('Skala 10-1000 membutuhkan kolom max_score. Jalankan: npm run migrate:max-score');
            }
            if (maxScoreColumnExists) examData.max_score = parsedMaxScore;
            const subjectIdsColumnExists = await hasSubjectIdsColumn();
            if (!subjectIdsColumnExists && normalizedSubjectIds.length > 1) {
                return jsonError('Multi mapel membutuhkan kolom subject_ids. Jalankan: npm run migrate:exam-subject-ids');
            }
            if (subjectIdsColumnExists) examData.subject_ids = stringifySubjectIds(normalizedSubjectIds);

            await update('exams', examData, 'id = ?', [id]);
            return jsonSuccess({ message: 'Ujian berhasil diupdate' });
        }

        if (action === 'delete_exam') {
            const user = await requireStaff(request);
            const target = await queryOne('SELECT * FROM exams WHERE id = ?', [body.id]);
            if (!target || !(await checkAnySubjectAccess(user, getExamSubjectIds(target)))) return jsonError('Akses ditolak');
            await remove('exams', 'id = ?', [body.id]);
            return jsonSuccess({ message: 'Ujian berhasil dihapus' });
        }

        if (action === 'create_question') {
            const user = await requireStaff(request);
            const { subject_id, exam_id, question_type, question_text, options, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level, explanation } = body;

            if (!(await checkSubjectAccess(user, subject_id))) return jsonError('Bukan mata pelajaran Anda');
            if (exam_id) {
                const ex = await queryOne('SELECT * FROM exams WHERE id = ?', [exam_id]);
                if (!ex || !(await checkAnySubjectAccess(user, getExamSubjectIds(ex)))) return jsonError('Akses ujian ditolak');
                if (!examHasSubject(ex, subject_id)) return jsonError('Mapel soal harus termasuk mapel ujian');
            }
            if (!question_text || !correct_answer) return jsonError('Data soal tidak lengkap');
            const qId = await insert('questions', {
                subject_id, exam_id, question_type: question_type || 'multiple_choice', question_text,
                options: options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
                option_a, option_b, option_c, option_d, option_e: option_e || null,
                correct_answer, difficulty_level: difficulty_level || 'medium', explanation: explanation || '',
                created_by: user.id
            });
            if (exam_id) {
                const maxOrder = await queryOne('SELECT MAX(question_order) as max_order FROM exam_questions WHERE exam_id = ?', [exam_id]);
                await insert('exam_questions', { exam_id, question_id: qId, question_order: (maxOrder?.max_order || 0) + 1 });
                const count = await queryOne('SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?', [exam_id]);
                await update('exams', { total_questions: count.total }, 'id = ?', [exam_id]);
            }
            return jsonSuccess({ message: 'Soal berhasil ditambahkan', id: qId }, 201);
        }

        if (action === 'bulk_create_questions') {
            const user = await requireStaff(request);

            const rows = Array.isArray(body.rows) ? body.rows : [];
            if (!rows.length) return jsonError('Data import kosong');
            if (rows.length > 1000) return jsonError('Maksimal 1000 soal per upload');

            const normalizedRows = [];
            const validationErrors = [];

            rows.forEach((row, index) => {
                const line = index + 1;
                if (!row || typeof row !== 'object' || Array.isArray(row)) {
                    validationErrors.push(`Baris ${line}: format row tidak valid`);
                    return;
                }

                const normalized = normalizeImportRow(row);
                const hasRawExamId = row.exam_id !== '' && row.exam_id !== null && row.exam_id !== undefined;
                if (!normalized.subject_id) validationErrors.push(`Baris ${line}: subject_id wajib diisi`);
                if (!normalized.question_text) validationErrors.push(`Baris ${line}: question_text wajib diisi`);

                if (normalized.question_type === 'multiple_choice' || normalized.question_type === 'multiple_choice_complex') {
                    if (!normalized.option_a || !normalized.option_b) validationErrors.push(`Baris ${line}: option_a dan option_b wajib diisi`);
                }

                if (normalized.question_type === 'multiple_choice') {
                    if (!VALID_ANSWERS.has(normalized.correct_answer)) validationErrors.push(`Baris ${line}: correct_answer harus A/B/C/D/E`);
                    if (!hasSelectedOption(normalized)) validationErrors.push(`Baris ${line}: opsi jawaban ${normalized.correct_answer} belum diisi`);
                }

                if (hasRawExamId && normalized.exam_id === null) validationErrors.push(`Baris ${line}: exam_id tidak valid`);
                if (normalized.exam_id !== null && normalized.exam_id <= 0) validationErrors.push(`Baris ${line}: exam_id tidak valid`);

                normalizedRows.push({ ...normalized, _line: line });
            });

            if (validationErrors.length) {
                return Response.json(
                    {
                        success: false,
                        message: 'Validasi import gagal',
                        errors: validationErrors.slice(0, 30),
                        error_count: validationErrors.length,
                    },
                    { status: 400 }
                );
            }

            // Check subject access for all subjectIds in import
            const subjectIds = [...new Set(normalizedRows.map(r => r.subject_id))];
            for (const sId of subjectIds) {
                if (!(await checkSubjectAccess(user, sId))) {
                    return jsonError(`Anda tidak memiliki akses ke mata pelajaran ID: ${sId}`);
                }
            }
            if (subjectIds.length) {
                const existingSubjects = await query(
                    `SELECT id FROM subjects WHERE id IN (${placeholders(subjectIds)})`,
                    subjectIds
                );
                const existingSubjectSet = new Set(existingSubjects.map(s => s.id));
                const missingSubjects = subjectIds.filter(id => !existingSubjectSet.has(id));
                if (missingSubjects.length) {
                    return Response.json(
                        {
                            success: false,
                            message: 'Ada subject_id yang tidak ditemukan',
                            errors: missingSubjects.map(id => `subject_id ${id} tidak ada`),
                            error_count: missingSubjects.length,
                        },
                        { status: 400 }
                    );
                }
            }

            const examIds = [...new Set(normalizedRows.filter(r => r.exam_id).map(r => r.exam_id))];
            const examMap = new Map();
            if (examIds.length) {
                const existingExams = await query(
                    `SELECT * FROM exams WHERE id IN (${placeholders(examIds)})`,
                    examIds
                );
                existingExams.forEach(exam => examMap.set(exam.id, exam));

                const missingExams = examIds.filter(id => !examMap.has(id));
                if (missingExams.length) {
                    return Response.json(
                        {
                            success: false,
                            message: 'Ada exam_id yang tidak ditemukan',
                            errors: missingExams.map(id => `exam_id ${id} tidak ada`),
                            error_count: missingExams.length,
                        },
                        { status: 400 }
                    );
                }

                const mismatchErrors = normalizedRows
                    .filter(r => r.exam_id && !examHasSubject(examMap.get(r.exam_id), r.subject_id))
                    .map(r => `Baris ${r._line}: exam_id ${r.exam_id} tidak sesuai dengan subject_id ${r.subject_id}`);
                if (mismatchErrors.length) {
                    return Response.json(
                        {
                            success: false,
                            message: 'Ada relasi subject dan ujian yang tidak sesuai',
                            errors: mismatchErrors.slice(0, 30),
                            error_count: mismatchErrors.length,
                        },
                        { status: 400 }
                    );
                }
            }

            const connection = await pool.getConnection();
            const touchedExamIds = new Set();
            let created = 0;

            try {
                await connection.beginTransaction();

                const examOrderMap = new Map();
                if (examIds.length) {
                    const [orderRows] = await connection.execute(
                        `SELECT exam_id, COALESCE(MAX(question_order), 0) as max_order
                         FROM exam_questions
                         WHERE exam_id IN (${placeholders(examIds)})
                         GROUP BY exam_id`,
                        examIds
                    );
                    orderRows.forEach(row => examOrderMap.set(row.exam_id, row.max_order || 0));
                    examIds.forEach(id => {
                        if (!examOrderMap.has(id)) examOrderMap.set(id, 0);
                    });
                }

                for (const row of normalizedRows) {
                    const [questionInsert] = await connection.execute(
                        `INSERT INTO questions
                        (subject_id, exam_id, question_type, question_text, options, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level, explanation, created_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            row.subject_id,
                            row.exam_id,
                            row.question_type,
                            row.question_text,
                            row.options ? (typeof row.options === 'string' ? row.options : JSON.stringify(row.options)) : null,
                            row.option_a,
                            row.option_b,
                            row.option_c,
                            row.option_d,
                            row.option_e || null,
                            row.correct_answer,
                            row.difficulty_level,
                            row.explanation,
                            user.id,
                        ]
                    );

                    created += 1;

                    if (row.exam_id) {
                        const nextOrder = (examOrderMap.get(row.exam_id) || 0) + 1;
                        examOrderMap.set(row.exam_id, nextOrder);
                        await connection.execute(
                            'INSERT INTO exam_questions (exam_id, question_id, question_order) VALUES (?, ?, ?)',
                            [row.exam_id, questionInsert.insertId, nextOrder]
                        );
                        touchedExamIds.add(row.exam_id);
                    }
                }

                if (touchedExamIds.size) {
                    const touchedIds = [...touchedExamIds];
                    const [countRows] = await connection.execute(
                        `SELECT exam_id, COUNT(*) as total
                         FROM exam_questions
                         WHERE exam_id IN (${placeholders(touchedIds)})
                         GROUP BY exam_id`,
                        touchedIds
                    );
                    const totalMap = new Map(countRows.map(r => [r.exam_id, r.total]));
                    for (const examId of touchedIds) {
                        await connection.execute(
                            'UPDATE exams SET total_questions = ? WHERE id = ?',
                            [totalMap.get(examId) || 0, examId]
                        );
                    }
                }

                await connection.commit();
            } catch (txError) {
                await connection.rollback();
                throw txError;
            } finally {
                connection.release();
            }

            return jsonSuccess({
                message: `Import berhasil. ${created} soal ditambahkan.`,
                summary: {
                    total_rows: rows.length,
                    created,
                    linked_to_exam: touchedExamIds.size,
                },
            }, 201);
        }
        if (action === 'bulk_assign_questions') {
            const user = await requireStaff(request);
            const { exam_id, question_ids } = body;
            if (!exam_id || !Array.isArray(question_ids)) return jsonError('Data tidak valid');

            const exam = await queryOne('SELECT * FROM exams WHERE id = ?', [exam_id]);
            if (!exam || !(await checkAnySubjectAccess(user, getExamSubjectIds(exam)))) return jsonError('Akses ujian ditolak');
            const examSubjectIds = getExamSubjectIds(exam);

            const normalizedQuestionIds = [...new Set(question_ids.map(toNullableInt).filter(Boolean))];
            if (normalizedQuestionIds.length === 0) return jsonError('Soal yang dipilih tidak valid');

            const questionRows = await query(
                `SELECT id, exam_id, subject_id
                 FROM questions
                 WHERE id IN (${placeholders(normalizedQuestionIds)})`,
                normalizedQuestionIds
            );
            const questionMap = new Map(questionRows.map(row => [Number(row.id), row]));

            if (questionRows.length !== normalizedQuestionIds.length) {
                return jsonError('Ada soal yang tidak ditemukan');
            }

            for (const questionId of normalizedQuestionIds) {
                const currentQuestion = questionMap.get(Number(questionId));
                if (!currentQuestion) return jsonError('Ada soal yang tidak ditemukan');
                if (!examSubjectIds.includes(Number(currentQuestion.subject_id))) {
                    return jsonError(`Soal ID ${questionId} tidak cocok dengan mapel ujian tujuan`);
                }
                if (!(await checkSubjectAccess(user, currentQuestion.subject_id))) {
                    return jsonError(`Anda tidak memiliki akses mapel untuk soal ID ${questionId}`);
                }
            }

            for (const qId of normalizedQuestionIds) {
                const oldQuestion = questionMap.get(Number(qId));
                if (oldQuestion?.exam_id != exam_id) {
                    await update('questions', { exam_id }, 'id = ?', [qId]);
                    // Remove from old if any
                    if (oldQuestion?.exam_id) {
                        await remove('exam_questions', 'exam_id = ? AND question_id = ?', [oldQuestion.exam_id, qId]);
                        const count = await queryOne('SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?', [oldQuestion.exam_id]);
                        await update('exams', { total_questions: count.total }, 'id = ?', [oldQuestion.exam_id]);
                    }
                    // Add to new
                    const maxOrder = await queryOne('SELECT MAX(question_order) as max_order FROM exam_questions WHERE exam_id = ?', [exam_id]);
                    await insert('exam_questions', { exam_id, question_id: qId, question_order: (maxOrder?.max_order || 0) + 1 });
                }
            }
            const finalCount = await queryOne('SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?', [exam_id]);
            await update('exams', { total_questions: finalCount.total }, 'id = ?', [exam_id]);

            return jsonSuccess({ message: `${normalizedQuestionIds.length} soal berhasil dipindahkan ke ujian` });
        }


        if (action === 'update_question') {
            const user = await requireStaff(request);
            const { id, subject_id, exam_id, question_type, question_text, options, option_a, option_b, option_c, option_d, option_e, correct_answer, difficulty_level, explanation } = body;

            if (!(await checkSubjectAccess(user, subject_id))) return jsonError('Bukan mata pelajaran Anda');
            if (exam_id) {
                const targetExam = await queryOne('SELECT * FROM exams WHERE id = ?', [exam_id]);
                if (!targetExam || !(await checkAnySubjectAccess(user, getExamSubjectIds(targetExam)))) {
                    return jsonError('Akses ujian ditolak');
                }
                if (!examHasSubject(targetExam, subject_id)) {
                    return jsonError('Mapel soal harus termasuk mapel ujian');
                }
            }

            // 1. Get current exam assignment
            const oldQuestion = await queryOne('SELECT exam_id FROM questions WHERE id = ?', [id]);

            // 2. Update questions table
            await update('questions', {
                subject_id, exam_id: exam_id || null,
                question_type, question_text,
                options: options ? (typeof options === 'string' ? options : JSON.stringify(options)) : null,
                option_a, option_b, option_c, option_d, option_e: option_e || null,
                correct_answer, difficulty_level, explanation: explanation || ''
            }, 'id = ?', [id]);

            // 3. Sync exam_questions table if exam changed
            const oldExamId = oldQuestion?.exam_id;
            const newExamId = exam_id ? parseInt(exam_id) : null;

            if (oldExamId !== newExamId) {
                // Remove from old exam
                if (oldExamId) {
                    await remove('exam_questions', 'exam_id = ? AND question_id = ?', [oldExamId, id]);
                    const count = await queryOne('SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?', [oldExamId]);
                    await update('exams', { total_questions: count.total }, 'id = ?', [oldExamId]);
                }
                // Add to new exam
                if (newExamId) {
                    const maxOrder = await queryOne('SELECT MAX(question_order) as max_order FROM exam_questions WHERE exam_id = ?', [newExamId]);
                    await insert('exam_questions', { exam_id: newExamId, question_id: id, question_order: (maxOrder?.max_order || 0) + 1 });
                    const count = await queryOne('SELECT COUNT(*) as total FROM exam_questions WHERE exam_id = ?', [newExamId]);
                    await update('exams', { total_questions: count.total }, 'id = ?', [newExamId]);
                }
            }

            return jsonSuccess({ message: 'Soal berhasil diupdate' });
        }

        if (action === 'delete_question') {
            await requireAdmin(request);
            await remove('questions', 'id = ?', [body.id]);
            return jsonSuccess({ message: 'Soal berhasil dihapus' });
        }

        return jsonError('Invalid action');
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Access Denied', 403);
        console.error('Exams POST error:', error);
        return jsonError('Server error', 500);
    }
}
