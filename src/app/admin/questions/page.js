'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost, getUser } from '@/lib/api';
import RichTextEditor, { RichContentDisplay } from '@/components/RichTextEditor';

let xlsxModulePromise;
const getXlsxModule = async () => {
    if (!xlsxModulePromise) {
        xlsxModulePromise = import('xlsx').then((mod) => mod.default ?? mod);
    }
    return xlsxModulePromise;
};

export default function AdminQuestionsPage() {
    const [questions, setQuestions] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [filter, setFilter] = useState({ subject_id: '', exam_id: '', difficulty: '', type: '', search: '' });
    const [initialized, setInitialized] = useState(false);
    const [message, setMessage] = useState(null);
    const [importFile, setImportFile] = useState(null);
    const [importDefaults, setImportDefaults] = useState({ subject_id: '', exam_id: '' });
    const [importing, setImporting] = useState(false);
    const [importMode, setImportMode] = useState('file'); // 'file' or 'text'
    const [rawText, setRawText] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkExamId, setBulkExamId] = useState('');
    const fileInputRef = useRef(null);
    const [form, setForm] = useState({
        subject_id: '', exam_id: '', question_type: 'multiple_choice', question_text: '',
        option_a: '', option_b: '', option_c: '', option_d: '', option_e: '',
        options: [], // Dynamic options array
        correct_answer: 'A', difficulty_level: 'medium', explanation: ''
    });

    const getExamSubjectIds = (exam) => {
        if (!exam) return [];
        if (Array.isArray(exam.subject_ids)) {
            return [...new Set(exam.subject_ids.map(Number).filter(Boolean))];
        }
        if (typeof exam.subject_ids === 'string' && exam.subject_ids.trim()) {
            try {
                const parsed = JSON.parse(exam.subject_ids);
                if (Array.isArray(parsed)) {
                    return [...new Set(parsed.map(Number).filter(Boolean))];
                }
            } catch {
                return [...new Set(exam.subject_ids.split(',').map(v => Number(v.trim())).filter(Boolean))];
            }
        }
        const fallback = Number(exam.subject_id);
        return Number.isFinite(fallback) && fallback > 0 ? [fallback] : [];
    };

    const examMatchesSubject = (exam, subjectId) => {
        const parsedSubjectId = Number(subjectId);
        if (!parsedSubjectId) return true;
        return getExamSubjectIds(exam).includes(parsedSubjectId);
    };

    useEffect(() => {
        const query = new URLSearchParams(window.location.search);
        const sId = query.get('subject_id') || '';
        const eId = query.get('exam_id') || '';
        setFilter(prev => ({ ...prev, subject_id: sId, exam_id: eId }));
        setInitialized(true);
        loadData();
    }, []);

    const loadData = async () => {
        const [subRes, exRes] = await Promise.all([apiGet('/subjects'), apiGet('/exams?action=all')]);
        if (subRes.success) {
            const u = getUser();
            if (u?.role === 'teacher') {
                const allowedIds = u.assigned_subjects?.map(s => s.id) || [];
                setSubjects(subRes.subjects.filter(s => allowedIds.includes(s.id)));
            } else {
                setSubjects(subRes.subjects);
            }
        }
        if (exRes.success) setExams(exRes.exams);
    };

    const loadQuestions = useCallback(async () => {
        if (!initialized) return;
        let url = `/exams?action=questions&subject_id=${filter.subject_id}&exam_id=${filter.exam_id}&difficulty=${filter.difficulty}&type=${filter.type}&search=${encodeURIComponent(filter.search)}`;
        const res = await apiGet(url);
        if (res.success) setQuestions(res.questions);
        setLoading(false);
    }, [initialized, filter]);

    useEffect(() => {
        loadQuestions();
    }, [loadQuestions]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const action = editing ? 'update_question' : 'create_question';
        const data = editing ? { ...form, id: editing.id } : form;
        const res = await apiPost('/exams', { action, ...data });
        if (res.success) { setMessage({ type: 'success', text: res.message }); setShowForm(false); setEditing(null); loadQuestions(); }
        else setMessage({ type: 'error', text: res.message });
    };

    const handleEdit = (q) => {
        let parsedOptions = [];
        try {
            if (q.options) {
                parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            }
        } catch (e) {
            console.error('Error parsing question options:', e);
        }

        setEditing(q);
        setForm({
            subject_id: q.subject_id, exam_id: q.exam_id || '', question_type: q.question_type || 'multiple_choice',
            question_text: q.question_text,
            option_a: q.option_a || '', option_b: q.option_b || '', option_c: q.option_c || '', option_d: q.option_d || '',
            option_e: q.option_e || '',
            options: parsedOptions || [],
            correct_answer: q.correct_answer, difficulty_level: q.difficulty_level,
            explanation: q.explanation || ''
        });
        setShowForm(true);
    };

    const addOption = () => {
        const nextLetter = String.fromCharCode(65 + form.options.length);
        setForm({
            ...form,
            options: [...form.options, { label: nextLetter, text: '' }]
        });
    };

    const removeOption = (index) => {
        const newOptions = form.options.filter((_, i) => i !== index).map((opt, i) => ({
            ...opt,
            label: String.fromCharCode(65 + i)
        }));
        setForm({ ...form, options: newOptions });
    };

    const updateOption = (index, text) => {
        const newOptions = [...form.options];
        newOptions[index] = { ...newOptions[index], text };
        setForm({ ...form, options: newOptions });
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus soal ini?')) return;
        const res = await apiPost('/exams', { action: 'delete_question', id });
        if (res.success) { setMessage({ type: 'success', text: res.message }); loadQuestions(); }
    };

    const normalizeHeader = (header) => String(header || '')
        .trim()
        .toLowerCase()
        .replace(/[^\w]+/g, '_');

    const pickValue = (normalized, keys, fallback = '') => {
        for (const key of keys) {
            const value = normalized[normalizeHeader(key)];
            if (value === null || value === undefined) continue;
            const text = String(value).trim();
            if (text) return text;
        }
        return fallback;
    };

    const normalizeImportRow = (row) => {
        const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
            acc[normalizeHeader(key)] = value;
            return acc;
        }, {});

        const correct = pickValue(normalized, ['correct_answer', 'answer', 'kunci_jawaban']).toUpperCase();
        const difficulty = pickValue(normalized, ['difficulty_level', 'difficulty'], 'medium').toLowerCase();

        return {
            subject_id: pickValue(normalized, ['subject_id', 'subjectid'], importDefaults.subject_id),
            exam_id: pickValue(normalized, ['exam_id', 'examid'], importDefaults.exam_id),
            question_type: pickValue(normalized, ['question_type', 'type', 'jenis_soal'], 'multiple_choice'),
            question_text: pickValue(normalized, ['question_text', 'question', 'soal']),
            option_a: pickValue(normalized, ['option_a', 'a']),
            option_b: pickValue(normalized, ['option_b', 'b']),
            option_c: pickValue(normalized, ['option_c', 'c']),
            option_d: pickValue(normalized, ['option_d', 'd']),
            option_e: pickValue(normalized, ['option_e', 'e']),
            correct_answer: correct,
            difficulty_level: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : 'medium',
            explanation: pickValue(normalized, ['explanation', 'pembahasan']),
        };
    };

    const parseFlexibleText = (text) => {
        const lines = String(text || '').split(/\r?\n/);
        const questions = [];
        const context = {
            subject_id: importDefaults.subject_id || '',
            exam_id: importDefaults.exam_id || '',
            question_type: '',
            difficulty_level: '',
        };
        let current = null;

        const hasQuestionText = (q) => Boolean(q?.question_text && String(q.question_text).trim());
        const hasAnyAnswerPart = (q) => Boolean(
            q?.option_a || q?.option_b || q?.option_c || q?.option_d || q?.option_e || q?.correct_answer || q?.explanation
        );

        const createCurrent = () => ({
            subject_id: context.subject_id || '',
            exam_id: context.exam_id || '',
            question_type: context.question_type || '',
            difficulty_level: context.difficulty_level || '',
            options: [],
        });

        const ensureCurrent = () => {
            if (!current) current = createCurrent();
        };

        const normalizeType = (value) => {
            const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
            if (raw === 'multiple_choice' || raw === 'pg' || raw === 'pilihan_ganda') return 'multiple_choice';
            if (raw === 'multiple_choice_complex' || raw === 'pg_kompleks' || raw === 'pilihan_ganda_kompleks') return 'multiple_choice_complex';
            if (raw === 'true_false' || raw === 'benar_salah') return 'true_false';
            if (raw === 'short_answer' || raw === 'isian_singkat') return 'short_answer';
            if (raw === 'essay' || raw === 'uraian') return 'essay';
            return raw;
        };

        const normalizeDifficulty = (value) => {
            const raw = String(value || '').trim().toLowerCase();
            if (raw === 'easy' || raw === 'mudah') return 'easy';
            if (raw === 'medium' || raw === 'sedang') return 'medium';
            if (raw === 'hard' || raw === 'sulit') return 'hard';
            return '';
        };

        const upsertOption = (letter, optionText) => {
            const key = `option_${letter.toLowerCase()}`;
            current[key] = optionText;
            if (!current.options) current.options = [];
            const idx = current.options.findIndex(opt => opt.label === letter);
            if (idx >= 0) current.options[idx] = { label: letter, text: optionText };
            else current.options.push({ label: letter, text: optionText });
        };

        const flush = () => {
            if (!hasQuestionText(current)) {
                current = null;
                return;
            }

            if (!current.question_type) {
                if (current.option_a && current.option_b && current.correct_answer && String(current.correct_answer).includes(',')) {
                    current.question_type = 'multiple_choice_complex';
                } else if (current.option_a && current.option_b) {
                    current.question_type = 'multiple_choice';
                } else if (current.correct_answer) {
                    current.question_type = 'short_answer';
                } else {
                    current.question_type = 'essay';
                }
            }

            if (!current.difficulty_level) current.difficulty_level = 'medium';
            if (!current.explanation) current.explanation = '';

            questions.push(current);
            current = null;
        };

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) return;
            if (/^[-=_]{3,}$/.test(trimmed)) return;

            const tagMatch = trimmed.match(/^\[([^\]:]+)\s*:\s*(.+)\]$/);
            if (tagMatch) {
                if (current && hasQuestionText(current) && hasAnyAnswerPart(current)) flush();

                const key = normalizeHeader(tagMatch[1]);
                const val = tagMatch[2].trim();

                if (['topic', 'subject', 'subject_id', 'mapel'].includes(key)) {
                    context.subject_id = val;
                    if (current && !current.subject_id) current.subject_id = val;
                } else if (['exam', 'exam_id', 'ujian'].includes(key)) {
                    context.exam_id = val;
                    if (current && !current.exam_id) current.exam_id = val;
                } else if (['type', 'question_type', 'jenis', 'jenis_soal'].includes(key)) {
                    const normalized = normalizeType(val);
                    context.question_type = normalized;
                    if (current && !current.question_type) current.question_type = normalized;
                } else if (['difficulty', 'difficulty_level', 'tingkat'].includes(key)) {
                    const normalized = normalizeDifficulty(val);
                    if (normalized) {
                        context.difficulty_level = normalized;
                        if (current && !current.difficulty_level) current.difficulty_level = normalized;
                    }
                }
                return;
            }

            const questionLabelMatch = trimmed.match(/^(question|soal|pertanyaan)\s*[:\-]\s*(.+)$/i);
            const numberedQuestionMatch = trimmed.match(/^(?:q(?:uestion)?\s*)?(\d+)[\.\)]\s+(.+)$/i);
            if (questionLabelMatch || numberedQuestionMatch) {
                if (current && hasQuestionText(current) && hasAnyAnswerPart(current)) flush();
                ensureCurrent();
                current.question_text = (questionLabelMatch ? questionLabelMatch[2] : numberedQuestionMatch[2]).trim();
                return;
            }

            const optionMatch = trimmed.match(/^([A-Ea-e])\s*[:\.\)\-]\s*(.+)$/);
            if (optionMatch) {
                ensureCurrent();
                const letter = optionMatch[1].toUpperCase();
                const optionText = optionMatch[2].trim();
                upsertOption(letter, optionText);
                return;
            }

            const answerMatch = trimmed.match(/^(answer|jawaban|kunci(?:_jawaban)?|kunci\s*jawaban)\s*[:\-]\s*(.+)$/i);
            if (answerMatch) {
                ensureCurrent();
                const rawAnswer = answerMatch[2].trim();
                const compactUpper = rawAnswer.toUpperCase().replace(/\s+/g, '');
                if (/^[A-E](,[A-E])*$/.test(compactUpper)) {
                    current.correct_answer = compactUpper;
                } else if (/^(BENAR|TRUE)$/i.test(rawAnswer)) {
                    current.correct_answer = 'A';
                } else if (/^(SALAH|FALSE)$/i.test(rawAnswer)) {
                    current.correct_answer = 'B';
                } else {
                    current.correct_answer = rawAnswer;
                }
                return;
            }

            const explanationMatch = trimmed.match(/^(explanation|pembahasan|solusi)\s*[:\-]\s*(.+)$/i);
            if (explanationMatch) {
                ensureCurrent();
                const textPart = explanationMatch[2].trim();
                current.explanation = current.explanation ? `${current.explanation}\n${textPart}` : textPart;
                return;
            }

            ensureCurrent();
            if (!current.question_text) {
                current.question_text = trimmed;
            } else if (current.explanation) {
                current.explanation += `\n${trimmed}`;
            } else if (current.correct_answer && hasAnyAnswerPart(current)) {
                current.explanation = trimmed;
            } else {
                current.question_text += `\n${trimmed}`;
            }
        });

        flush();
        return questions;
    };

    const parseImportFile = async (file) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext === 'json') {
            const content = await file.text();
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
            throw new Error('Format JSON harus array atau { "rows": [] }');
        }

        if (ext === 'xlsx' || ext === 'xls') {
            const XLSX = await getXlsxModule();
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            if (!firstSheet) return [];
            return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
        }

        throw new Error('Format file tidak didukung. Gunakan JSON atau XLSX.');
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const downloadJsonTemplate = () => {
        const sample = [
            {
                subject_id: 1,
                exam_id: '',
                question_type: 'multiple_choice',
                question_text: '2 + 2 = ?',
                option_a: '1',
                option_b: '2',
                option_c: '3',
                option_d: '4',
                option_e: '',
                correct_answer: 'D',
                difficulty_level: 'easy',
                explanation: '2 + 2 = 4',
            },
        ];
        downloadBlob(
            new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' }),
            'template-soal.json'
        );
    };

    const downloadXlsxTemplate = async () => {
        const XLSX = await getXlsxModule();
        const sample = [
            {
                subject_id: 1,
                exam_id: '',
                question_type: 'multiple_choice',
                question_text: '2 + 2 = ?',
                option_a: '1',
                option_b: '2',
                option_c: '3',
                option_d: '4',
                option_e: '',
                correct_answer: 'D',
                difficulty_level: 'easy',
                explanation: '2 + 2 = 4',
            },
        ];
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(sample);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'questions');
        const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        downloadBlob(
            new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
            'template-soal.xlsx'
        );
    };

    const handleImport = async () => {
        if (importMode === 'file' && !importFile) {
            setMessage({ type: 'error', text: 'Pilih file JSON/XLSX terlebih dahulu' });
            return;
        }
        if (importMode === 'text' && !rawText.trim()) {
            setMessage({ type: 'error', text: 'Masukkan teks soal terlebih dahulu' });
            return;
        }

        setImporting(true);
        try {
            let rows = [];
            if (importMode === 'file') {
                rows = await parseImportFile(importFile);
            } else {
                rows = parseFlexibleText(rawText);
            }

            if (!rows.length) {
                setMessage({
                    type: 'error',
                    text: importMode === 'text'
                        ? 'Teks tidak terbaca sebagai soal. Gunakan format: "Question/Soal", opsi "A: ...", dan "Answer: ...".'
                        : 'Data pada file kosong'
                });
                return;
            }

            let mapped = rows.map((row, index) => ({ ...normalizeImportRow(row), _line: index + 1 }));
            const selectedImportSubjectId = String(importDefaults.subject_id || '').trim();
            const selectedImportExamId = String(importDefaults.exam_id || '').trim();

            // If mapel target is chosen, force all imported rows to that subject
            // to avoid accidental cross-subject assignment from file data.
            if (selectedImportSubjectId) {
                mapped = mapped.map((row) => {
                    const next = { ...row, subject_id: selectedImportSubjectId };
                    if (next.exam_id) {
                        const matchedExam = exams.find(ex => String(ex.id) === String(next.exam_id));
                        if (!matchedExam || !examMatchesSubject(matchedExam, selectedImportSubjectId)) {
                            next.exam_id = selectedImportExamId || '';
                        }
                    }
                    return next;
                });
            }
            const clientErrors = [];

            mapped.forEach((row) => {
                if (!row.subject_id) clientErrors.push(`Baris ${row._line}: subject_id wajib diisi`);
                if (!row.question_text) clientErrors.push(`Baris ${row._line}: question_text wajib diisi`);
                if ((row.question_type === 'multiple_choice' || row.question_type === 'multiple_choice_complex') && (!row.option_a || !row.option_b)) {
                    clientErrors.push(`Baris ${row._line}: option_a dan option_b wajib diisi untuk pilihan ganda`);
                }
            });

            if (clientErrors.length) {
                setMessage({
                    type: 'error',
                    text: `Validasi file gagal (${clientErrors.length} error): ${clientErrors.slice(0, 3).join(' | ')}`
                });
                return;
            }

            const payloadRows = mapped.map(({ _line, ...rest }) => rest);
            const res = await apiPost('/exams', { action: 'bulk_create_questions', rows: payloadRows });

            if (res.success) {
                setMessage({ type: 'success', text: res.message });
                setImportFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                await loadQuestions();
            } else {
                const details = Array.isArray(res.errors) && res.errors.length
                    ? ` (${res.errors.slice(0, 2).join(' | ')})`
                    : '';
                setMessage({ type: 'error', text: `${res.message || 'Import gagal'}${details}` });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message || 'Import gagal diproses' });
        } finally {
            setImporting(false);
            loadQuestions();
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkExamId) {
            setMessage({ type: 'error', text: 'Pilih ujian tujuan terlebih dahulu' });
            return;
        }
        if (selectedIds.length === 0) {
            setMessage({ type: 'error', text: 'Pilih minimal satu soal' });
            return;
        }

        const res = await apiPost('/exams', {
            action: 'bulk_assign_questions',
            exam_id: bulkExamId,
            question_ids: selectedIds
        });

        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            setSelectedIds([]);
            loadQuestions();
        } else {
            setMessage({ type: 'error', text: res.message });
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === questions.length) setSelectedIds([]);
        else setSelectedIds(questions.map(q => q.id));
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div><h1>❓ Bank Soal</h1><div className="topbar-sub">Kelola soal ujian</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                        setShowForm(true);
                        setEditing(null);
                        setForm({
                            subject_id: '', exam_id: '', question_type: 'multiple_choice', question_text: '',
                            option_a: '', option_b: '', option_c: '', option_d: '', option_e: '',
                            options: [],
                            correct_answer: 'A', difficulty_level: 'medium', explanation: ''
                        });
                    }}>+ Tambah Soal</button>
                </div>

                {message && <div className={`alert alert-${message.type}`}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                {/* Filter */}
                <div className="question-filters">
                    <div className="question-filter-main">
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                type="text"
                                className="input"
                                style={{ paddingLeft: 36, height: 42 }}
                                placeholder="Cari soal..."
                                value={filter.search}
                                onChange={e => setFilter({ ...filter, search: e.target.value })}
                            />
                            <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }}>🔍</span>
                        </div>
                        <select className="select question-filter-sm" style={{ height: 42 }} value={filter.difficulty} onChange={e => setFilter({ ...filter, difficulty: e.target.value })}>
                            <option value="">Semua Tingkat</option>
                            <option value="easy">🟢 Mudah</option>
                            <option value="medium">🟡 Sedang</option>
                            <option value="hard">🔴 Sulit</option>
                        </select>
                        <select className="select question-filter-md" style={{ height: 42 }} value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })}>
                            <option value="">Semua Jenis</option>
                            <option value="multiple_choice">Pilihan Ganda</option>
                            <option value="multiple_choice_complex">PG Kompleks</option>
                            <option value="true_false">Benar/Salah</option>
                            <option value="short_answer">Isian Singkat</option>
                            <option value="essay">Uraian</option>
                        </select>
                    </div>

                    <div className="question-filter-secondary">
                        <select className="select question-filter-sm" style={{ height: 42 }} value={filter.subject_id} onChange={e => setFilter({ ...filter, subject_id: e.target.value, exam_id: '' })}>
                            <option value="">Semua Mapel</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <select className="select question-filter-md" style={{ height: 42 }} value={filter.exam_id} onChange={e => setFilter({ ...filter, exam_id: e.target.value })}>
                            <option value="">Semua Ujian</option>
                            {exams.filter(ex => examMatchesSubject(ex, filter.subject_id)).map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                        </select>
                        <button className="btn btn-secondary btn-sm" style={{ height: 42 }} onClick={() => setFilter({ subject_id: '', exam_id: '', difficulty: '', type: '', search: '' })}>
                            Reset
                        </button>
                    </div>

                    <div className="question-filter-footer">
                        <span className="badge badge-info" style={{ borderRadius: 20, padding: '4px 12px' }}>{questions.length} Soal ditemukan</span>

                        <div className="question-bulk-actions">
                            {selectedIds.length > 0 && (
                                <>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selectedIds.length} dipilih:</span>
                                    <select className="select select-sm question-filter-md" value={bulkExamId} onChange={e => setBulkExamId(e.target.value)}>
                                        <option value="">Pilih Ujian...</option>
                                        {exams.filter(ex => examMatchesSubject(ex, filter.subject_id)).map(ex => (
                                            <option key={ex.id} value={ex.id}>{ex.title}</option>
                                        ))}
                                    </select>
                                    <button className="btn btn-primary btn-sm" onClick={handleBulkAssign}>Pindahkan</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 28, background: 'var(--bg-glass)', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                    <div style={{ background: 'var(--bg-input)', padding: 6, borderRadius: 12, display: 'inline-flex', gap: 6, marginBottom: 24, border: '1px solid var(--border-color)' }}>
                        <button
                            type="button"
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: 10,
                                background: importMode === 'file' ? 'var(--primary)' : 'transparent',
                                color: importMode === 'file' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: importMode === 'file' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onClick={() => setImportMode('file')}
                        >
                            <span style={{ fontSize: 16 }}>📁</span> Import File (XLSX/JSON)
                        </button>
                        <button
                            type="button"
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: 10,
                                background: importMode === 'text' ? 'var(--primary)' : 'transparent',
                                color: importMode === 'text' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: 700,
                                fontSize: 13,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: importMode === 'text' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                            }}
                            onClick={() => setImportMode('text')}
                        >
                            <span style={{ fontSize: 16 }}>✍️</span> Teks Fleksibel (Soal & LaTeX)
                        </button>
                    </div>

                    {importMode === 'file' ? (
                        <>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 4, height: 16, background: 'var(--primary)', borderRadius: 4 }}></span>
                                Konfigurasi Import File
                            </h3>
                            <div className="grid-3">
                                <div className="form-group">
                                    <label className="form-label">Mapel Tujuan Import</label>
                                    <select
                                        className="select"
                                        value={importDefaults.subject_id}
                                        onChange={(e) => setImportDefaults({ subject_id: e.target.value, exam_id: '' })}
                                    >
                                        <option value="">Pilih mapel tujuan</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                        Jika dipilih, semua soal dari file akan otomatis disimpan ke mapel ini.
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Default Ujian</label>
                                    <select
                                        className="select"
                                        value={importDefaults.exam_id}
                                        onChange={(e) => setImportDefaults({ ...importDefaults, exam_id: e.target.value })}
                                    >
                                        <option value="">Tanpa default</option>
                                        {exams
                                            .filter(ex => examMatchesSubject(ex, importDefaults.subject_id))
                                            .map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">File</label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".json,.xlsx,.xls"
                                        className="input"
                                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="form-group">
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 4, height: 16, background: 'var(--primary)', borderRadius: 4 }}></span>
                                Tulis atau Tempel Soal
                            </h3>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Mapel Tujuan Import</label>
                                <select
                                    className="select"
                                    value={importDefaults.subject_id}
                                    onChange={(e) => setImportDefaults({ subject_id: e.target.value, exam_id: '' })}
                                >
                                    <option value="">Pilih mapel tujuan</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                    Jika dipilih, semua soal dari teks akan otomatis disimpan ke mapel ini.
                                </div>
                            </div>
                            <label className="form-label">Gunakan format tag [TYPE: ...], [DIFFICULTY: ...] untuk kemudahan.</label>
                            <textarea
                                className="input"
                                style={{
                                    minHeight: 300,
                                    fontFamily: 'monospace',
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                    background: 'var(--bg-input)',
                                    borderColor: 'var(--border-color)',
                                    resize: 'vertical'
                                }}
                                placeholder={`Contoh Format:\n\n[TOPIC: 1]\n[TYPE: multiple_choice]\n[DIFFICULTY: easy]\nQuestion: Berapa hasil dari $\\sqrt{144}$?\nA: 10\nB: 11\nC: 12\nD: 13\nAnswer: C\nExplanation: Karena $12^2 = 144$.\n\n[TYPE: essay]\nQuestion: Jelaskan hukum Newton 1...\nAnswer: Hukum Newton 1 adalah...`}
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                            />
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                                💡 Tip: Gunakan tag [TOPIC: id] di awal baris untuk set Mapel. Format ini sangat fleksibel untuk LaTeX.
                            </p>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                        <button className="btn btn-primary btn-sm" type="button" onClick={handleImport} disabled={importing}>
                            {importing ? 'Mengimpor...' : 'Import Sekarang'}
                        </button>
                        {importMode === 'file' && (
                            <>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={downloadJsonTemplate}>
                                    Download Template JSON
                                </button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={downloadXlsxTemplate}>
                                    Download Template XLSX
                                </button>
                                {importFile && <span className="badge badge-info" style={{ alignSelf: 'center' }}>{importFile.name}</span>}
                            </>
                        )}
                        {importMode === 'text' && rawText && (
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => setRawText('')}>Bersihkan Teks</button>
                        )}
                    </div>
                </div>

                {showForm && (
                    <div className="modal-overlay" style={{ position: 'fixed', zIndex: 9999 }} onClick={() => { setShowForm(false); setEditing(null); }}>
                        <div className="modal-box" style={{ maxWidth: 900, width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{editing ? '✏️ Edit' : '+ Tambah'} Soal</h3>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowForm(false); setEditing(null); }}>✕</button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="grid-3">
                                    <div className="form-group"><label className="form-label">Mata Pelajaran</label>
                                        <select className="select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
                                            <option value="">Pilih</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Ujian (opsional)</label>
                                        <select className="select" value={form.exam_id} onChange={e => setForm({ ...form, exam_id: e.target.value })}>
                                            <option value="">Tanpa ujian</option>{exams.filter(ex => examMatchesSubject(ex, form.subject_id)).map(ex => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Kesulitan</label>
                                        <select className="select" value={form.difficulty_level} onChange={e => setForm({ ...form, difficulty_level: e.target.value })}>
                                            <option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option>
                                        </select></div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Jenis Soal</label>
                                    <select className="select" value={form.question_type} onChange={e => {
                                        const type = e.target.value;
                                        let correct = form.correct_answer;
                                        if (type === 'true_false' && !['A', 'B'].includes(correct)) correct = 'A';
                                        setForm({ ...form, question_type: type, correct_answer: correct });
                                    }}>
                                        <option value="multiple_choice">Pilihan Ganda</option>
                                        <option value="multiple_choice_complex">Pilihan Ganda Kompleks</option>
                                        <option value="true_false">Benar / Salah</option>
                                        <option value="short_answer">Isian Singkat</option>
                                        <option value="essay">Uraian</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Pertanyaan (Mendukung Gambar, LaTeX, Code)</label>
                                    <RichTextEditor value={form.question_text} onChange={val => setForm({ ...form, question_text: val })} height={200} />
                                </div>

                                {form.question_type === 'multiple_choice' && (
                                    <>
                                        <div className="grid-2">
                                            <div className="form-group"><label className="form-label">Opsi A</label><RichTextEditor value={form.option_a} onChange={val => setForm({ ...form, option_a: val })} height={80} /></div>
                                            <div className="form-group"><label className="form-label">Opsi B</label><RichTextEditor value={form.option_b} onChange={val => setForm({ ...form, option_b: val })} height={80} /></div>
                                            <div className="form-group"><label className="form-label">Opsi C</label><RichTextEditor value={form.option_c} onChange={val => setForm({ ...form, option_c: val })} height={80} /></div>
                                            <div className="form-group"><label className="form-label">Opsi D</label><RichTextEditor value={form.option_d} onChange={val => setForm({ ...form, option_d: val })} height={80} /></div>
                                        </div>
                                        <div className="grid-2">
                                            <div className="form-group"><label className="form-label">Opsi E (opsional)</label><RichTextEditor value={form.option_e} onChange={val => setForm({ ...form, option_e: val })} height={80} /></div>
                                            <div className="form-group">
                                                <label className="form-label">Jawaban Benar</label>
                                                <select className="select" value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value })}>
                                                    <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="E">E</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {form.question_type === 'multiple_choice_complex' && (
                                    <div className="form-group" style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <label className="form-label" style={{ marginBottom: 0 }}>Daftar Pilihan Jawaban</label>
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={addOption}>+ Tambah Opsi</button>
                                        </div>
                                        <div style={{ display: 'grid', gap: 16 }}>
                                            {form.options.map((opt, idx) => (
                                                <div key={idx} className="card" style={{ padding: 12, border: '1px solid var(--border-color)', background: 'var(--bg-glass)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                                        <span className="badge badge-info">Opsi {opt.label}</span>
                                                        <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }} onClick={() => removeOption(idx)}>Hapus</button>
                                                    </div>
                                                    <RichTextEditor value={opt.text} onChange={val => updateOption(idx, val)} height={80} />
                                                </div>
                                            ))}
                                            {form.options.length === 0 && (
                                                <div style={{ padding: 20, textAlign: 'center', border: '2px dashed var(--border-color)', borderRadius: 8, color: 'var(--text-muted)' }}>
                                                    Belum ada opsi. Silakan klik &quot;Tambah Opsi&quot;.
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group" style={{ marginTop: 16 }}>
                                            <label className="form-label">Jawaban Benar (Pisahkan dengan koma, misal: A,C)</label>
                                            <input className="input" value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value.toUpperCase() })} placeholder="Contoh: A,B" />
                                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Gunakan label A, B, C, dst sesuai urutan opsi di atas.</p>
                                        </div>
                                    </div>
                                )}

                                {form.question_type === 'true_false' && (
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Jawaban Benar</label>
                                            <select className="select" value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value })}>
                                                <option value="A">Benar</option>
                                                <option value="B">Salah</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {(form.question_type === 'short_answer' || form.question_type === 'essay') && (
                                    <div className="form-group">
                                        <label className="form-label">Jawaban Benar / Referensi Jawaban</label>
                                        {form.question_type === 'short_answer' ? (
                                            <input className="input" value={form.correct_answer} onChange={e => setForm({ ...form, correct_answer: e.target.value })} placeholder="Ketik jawaban benar..." />
                                        ) : (
                                            <RichTextEditor value={form.correct_answer} onChange={val => setForm({ ...form, correct_answer: val })} height={120} />
                                        )}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">Penjelasan</label>
                                    <RichTextEditor value={form.explanation} onChange={val => setForm({ ...form, explanation: val })} height={120} />
                                </div>

                                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                                    <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>💾 Simpan Perubahan</button>
                                    <button className="btn btn-secondary" type="button" onClick={() => { setShowForm(false); setEditing(null); }} style={{ flex: 1 }}>Batal</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : questions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-glass)' }}>
                            <input type="checkbox" checked={selectedIds.length === questions.length && questions.length > 0} onChange={toggleSelectAll} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Pilih Semua</span>
                        </div>
                        {questions.map((q, i) => (
                            <div key={i} className={`card ${selectedIds.includes(q.id) ? 'selected-item' : ''}`} style={{ padding: 16, border: selectedIds.includes(q.id) ? '2px solid var(--primary)' : '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                    <div style={{ display: 'flex', gap: 12, flex: 1 }}>
                                        <input type="checkbox" style={{ marginTop: 4 }} checked={selectedIds.includes(q.id)} onChange={() => toggleSelect(q.id)} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                                                <span className="q-badge">#{q.id}</span>
                                                <span className="badge badge-primary">{
                                                    q.question_type === 'multiple_choice_complex' ? 'Pilihan Ganda Kompleks' :
                                                        q.question_type === 'true_false' ? 'Benar/Salah' :
                                                            q.question_type === 'short_answer' ? 'Isian Singkat' :
                                                                q.question_type === 'essay' ? 'Uraian' : 'Pilihan Ganda'
                                                }</span>
                                                <span className="badge badge-info">{q.subject_name}</span>
                                                <span className={`badge badge-${q.difficulty_level === 'hard' ? 'danger' : q.difficulty_level === 'medium' ? 'warning' : 'success'}`}>{q.difficulty_level}</span>
                                            </div>
                                            <div style={{ fontSize: 14, marginBottom: 8 }}>
                                                <RichContentDisplay content={q.question_text} />
                                            </div>
                                            {q.question_type === 'multiple_choice' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    {['A', 'B', 'C', 'D', 'E'].map(l => {
                                                        const v = q[`option_${l.toLowerCase()}`]; if (!v) return null;
                                                        const isCorrect = q.correct_answer === l;
                                                        return (
                                                            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, ...(isCorrect ? { color: 'var(--green)', fontWeight: 600 } : {}) }}>
                                                                <span>{isCorrect ? '✅' : '○'} {l}.</span>
                                                                <div style={{ flex: 1 }}><RichContentDisplay content={v} /></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {q.question_type === 'multiple_choice_complex' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                                                    {(() => {
                                                        let opts = [];
                                                        try {
                                                            opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options || [];
                                                        } catch (e) { }

                                                        if (!Array.isArray(opts) || opts.length === 0) {
                                                            // Fallback to A-E if options array is empty
                                                            return ['A', 'B', 'C', 'D', 'E'].map(l => {
                                                                const v = q[`option_${l.toLowerCase()}`]; if (!v) return null;
                                                                const isCorrect = (q.correct_answer || '').split(',').includes(l);
                                                                return (
                                                                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, ...(isCorrect ? { color: 'var(--green)', fontWeight: 600 } : {}) }}>
                                                                        <span>{isCorrect ? '✅' : '○'} {l}.</span>
                                                                        <div style={{ flex: 1 }}><RichContentDisplay content={v} /></div>
                                                                    </div>
                                                                );
                                                            });
                                                        }

                                                        return opts.map((opt, idx) => {
                                                            const isCorrect = (q.correct_answer || '').split(',').includes(opt.label);
                                                            return (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, ...(isCorrect ? { color: 'var(--green)', fontWeight: 600 } : {}) }}>
                                                                    <span>{isCorrect ? '✅' : '○'} {opt.label}.</span>
                                                                    <div style={{ flex: 1 }}><RichContentDisplay content={opt.text} /></div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            )}
                                            {q.question_type === 'true_false' && (
                                                <div style={{ fontSize: 12, fontWeight: 600 }}>
                                                    Kunci: <span style={{ color: 'var(--green)' }}>{q.correct_answer === 'A' ? 'Benar' : 'Salah'}</span>
                                                </div>
                                            )}
                                            {(q.question_type === 'short_answer' || q.question_type === 'essay') && (
                                                <div style={{ fontSize: 12 }}>
                                                    <strong>Kunci/Referensi:</strong>
                                                    <div className="card" style={{ marginTop: 4, padding: 8, background: 'var(--bg-secondary)' }}>
                                                        <RichContentDisplay content={q.correct_answer} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(q)}>✏️</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(q.id)}>🗑</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state card">
                        <div className="icon">❓</div>
                        <h3>Belum ada soal</h3>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
