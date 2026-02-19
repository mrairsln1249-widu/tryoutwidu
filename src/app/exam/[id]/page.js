'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { RichContentDisplay } from '@/components/RichTextEditor';

const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function ExamTimer({ initialTime, onTimeUp }) {
    const [timeLeft, setTimeLeft] = useState(initialTime);
    const timerRef = useRef(null);

    useEffect(() => {
        setTimeLeft(initialTime);
    }, [initialTime]);

    useEffect(() => {
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    onTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [onTimeUp]);

    const timerClass = timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : '';

    return (
        <div className={`exam-timer ${timerClass}`} style={{ fontVariantNumeric: 'tabular-nums', minWidth: '80px' }}>
            {formatTime(timeLeft)}
        </div>
    );
}

export default function ExamTakePage() {
    const { id } = useParams();
    const router = useRouter();
    const [exam, setExam] = useState(null);
    const [attempt, setAttempt] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [current, setCurrent] = useState(0);
    const [flags, setFlags] = useState({});
    const [visited, setVisited] = useState({});
    const [initialTimeLeft, setInitialTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isOnline, setIsOnline] = useState(() => (typeof window === 'undefined' ? true : window.navigator.onLine));
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSubmit = useCallback(async () => {
        if (submitting || !attempt) return;
        setSubmitting(true);
        const res = await apiPost('/exams', { action: 'submit', attempt_id: attempt.id });
        if (res.success) {
            router.push(`/exam/${id}/result?attempt=${attempt.id}`);
        } else {
            alert(res.message || 'Gagal submit ujian');
            setSubmitting(false);
        }
    }, [submitting, attempt, id, router]);

    const loadExam = useCallback(async () => {
        const res = await apiGet(`/exams?action=take&id=${id}`);
        if (res.success) {
            setExam(res.exam);
            setAttempt(res.attempt);
            setQuestions(res.questions);
            setAnswers(res.answers || {});
            setInitialTimeLeft(res.timeRemaining);
            // Mark initial answers as visited
            const initialVisited = {};
            res.questions.forEach(q => {
                if (res.answers?.[q.id]) initialVisited[q.id] = true;
            });
            setVisited(prev => ({ ...prev, ...initialVisited, [res.questions[0]?.id]: true }));
        } else {
            alert(res.message || 'Gagal memuat ujian');
            router.push('/programs');
        }
        setLoading(false);
    }, [id, router]);

    const handleTimeUp = useCallback(() => {
        handleSubmit();
    }, [handleSubmit]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadExam();
        }, 0);
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [loadExam]);

    const selectAnswer = async (questionId, displayAnswer) => {
        const question = questions.find(q => q.id === questionId);
        let currentAnswers = answers[questionId] || '';

        let nextDisplayAnswer = displayAnswer;

        if (question?.question_type === 'multiple_choice_complex') {
            const parts = String(currentAnswers).split(',').filter(Boolean);
            if (parts.includes(displayAnswer)) {
                nextDisplayAnswer = parts.filter(p => p !== displayAnswer).sort().join(',');
            } else {
                nextDisplayAnswer = [...parts, displayAnswer].sort().join(',');
            }
        }

        setAnswers(prev => ({ ...prev, [questionId]: nextDisplayAnswer }));

        // Map display letters back to original letters for the backend if it's MCQ
        let originalAnswer = nextDisplayAnswer;
        if (question?.question_type === 'multiple_choice' || question?.question_type === 'multiple_choice_complex') {
            const parts = String(nextDisplayAnswer).split(',').filter(Boolean);
            const mappedParts = parts.map(p => question.option_map?.[p] || p);
            originalAnswer = mappedParts.join(',');
        }

        setIsSaving(true);
        const res = await apiPost('/exams', { action: 'answer', attempt_id: attempt.id, question_id: questionId, selected_answer: originalAnswer });
        if (res.success) {
            setTimeout(() => setIsSaving(false), 800);
        } else {
            setIsSaving(false);
        }
    };

    const toggleFlag = () => {
        const qId = questions[current]?.id;
        setFlags(prev => ({ ...prev, [qId]: !prev[qId] }));
    };

    const goToQuestion = (index) => {
        const maxIndex = Math.max(questions.length - 1, 0);
        const nextIndex = Math.min(Math.max(index, 0), maxIndex);
        setCurrent(nextIndex);
        const qId = questions[nextIndex]?.id;
        if (qId) setVisited(prev => ({ ...prev, [qId]: true }));
    };

    const answered = Object.keys(answers).length;
    const total = questions.length;
    const flagged = Object.values(flags).filter(f => f).length;

    if (loading) return <div className="loading-page" style={{ minHeight: '100vh' }}><div className="spinner" /><p style={{ color: 'var(--text-muted)' }}>Memuat ujian...</p></div>;

    const q = questions[current];

    return (
        <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', background: 'var(--bg-secondary)' }}>
            {/* Top Bar */}
            <div className="exam-bar">
                <div className="exam-brand">🎯 TO <span className="acc" style={{ color: 'var(--accent)' }}>Wijaya</span> Edu</div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{exam?.title}</div>
                    <ExamTimer initialTime={initialTimeLeft} onTimeUp={handleTimeUp} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        Terjawab: <span style={{ color: 'var(--green)', fontWeight: 800 }}>{answered}</span> / {total}
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ padding: '8px 16px' }} onClick={() => setShowConfirm(true)}>Kumpulkan</button>
                </div>
            </div>

            {/* Floating Connectivity Badge */}
            <div className="exam-conn-badge" style={{
                background: 'var(--bg-secondary)',
                padding: '8px 16px',
                borderRadius: 30,
                border: `1px solid ${!isOnline ? 'var(--red)' : 'var(--border-color)'}`,
                fontSize: 12,
                fontWeight: 700,
                boxShadow: 'var(--shadow-lg)',
                color: isOnline ? 'var(--text-primary)' : 'var(--red)',
                transition: 'all 0.3s ease'
            }}>
                <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: !isOnline ? 'var(--red)' : isSaving ? 'var(--yellow)' : 'var(--green)',
                    boxShadow: !isOnline ? '0 0 10px var(--red)' : isSaving ? '0 0 10px var(--yellow)' : '0 0 10px var(--green)',
                    animation: isSaving || !isOnline ? 'pulse 1s infinite' : 'none'
                }} />
                {!isOnline ? 'Koneksi Terputus' : isSaving ? 'Menyimpan Jawaban...' : 'Tersimpan Otomatis'}
            </div>

            {/* Main Content */}
            <div className="exam-layout">
                <div className="q-panel">
                    <div className="q-hdr">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className="q-badge" style={{ marginBottom: 0 }}>Soal {current + 1}</span>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {q?.topic || 'Umum'}
                            </div>
                        </div>
                        <button
                            className={`flag-btn ${flags[q?.id] ? 'flagged' : ''}`}
                            onClick={toggleFlag}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                        >
                            {flags[q?.id] ? '🚩 Ditandai Ragu' : '🏳️ Tandai Ragu'}
                        </button>
                    </div>

                    <div className="q-card">
                        <div className="q-text">
                            <RichContentDisplay content={q?.question_text} />
                        </div>
                        <div className="opts-list">
                            {(q?.question_type === 'multiple_choice' || q?.question_type === 'multiple_choice_complex') && (() => {
                                let opts = [];
                                try {
                                    if (q?.options) {
                                        opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                                    }
                                } catch (e) { }

                                if (Array.isArray(opts) && opts.length > 0) {
                                    return opts.map((opt, idx) => {
                                        const isSelected = q.question_type === 'multiple_choice_complex'
                                            ? String(answers[q.id] || '').split(',').filter(Boolean).includes(opt.label)
                                            : answers[q.id] === opt.label;
                                        return (
                                            <div key={idx} className={`opt-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => selectAnswer(q.id, opt.label)}>
                                                <div className={`opt-check ${q.question_type === 'multiple_choice_complex' ? 'checkbox' : 'radio'}`}>
                                                    {isSelected && <div className="dot" />}
                                                </div>
                                                <div className="opt-letter">{opt.label}</div>
                                                <div style={{ flex: 1 }}>
                                                    <RichContentDisplay content={opt.text} />
                                                </div>
                                            </div>
                                        );
                                    });
                                }

                                // Fallback to A-E
                                return ['A', 'B', 'C', 'D', 'E'].map(letter => {
                                    const optKey = `option_${letter.toLowerCase()}`;
                                    const optText = q?.[optKey];
                                    if (!optText) return null;
                                    const isSelected = q?.question_type === 'multiple_choice_complex'
                                        ? String(answers[q?.id] || '').split(',').filter(Boolean).includes(letter)
                                        : answers[q?.id] === letter;
                                    return (
                                        <div key={letter} className={`opt-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => selectAnswer(q.id, letter)}>
                                            <div className={`opt-check ${q?.question_type === 'multiple_choice_complex' ? 'checkbox' : 'radio'}`}>
                                                {isSelected && <div className="dot" />}
                                            </div>
                                            <div className="opt-letter">{letter}</div>
                                            <div style={{ flex: 1 }}>
                                                <RichContentDisplay content={optText} />
                                            </div>
                                        </div>
                                    );
                                });
                            })()}

                            {q?.question_type === 'true_false' && [
                                { l: 'A', t: 'Benar' },
                                { l: 'B', t: 'Salah' }
                            ].map(item => (
                                <div key={item.l} className={`opt-item ${answers[q?.id] === item.l ? 'selected' : ''}`}
                                    onClick={() => selectAnswer(q.id, item.l)}>
                                    <div className="opt-check radio">
                                        {answers[q?.id] === item.l && <div className="dot" />}
                                    </div>
                                    <div className="opt-letter">{item.l === 'A' ? '✅' : '❌'}</div>
                                    <div style={{ flex: 1, fontWeight: 600 }}>{item.t}</div>
                                </div>
                            ))}

                            {q?.question_type === 'short_answer' && (
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Ketik Jawaban Anda:</label>
                                    <input
                                        className="input"
                                        style={{ padding: '12px 16px', fontSize: 16 }}
                                        value={answers[q?.id] || ''}
                                        onChange={e => selectAnswer(q.id, e.target.value)}
                                        placeholder="Ketik jawaban di sini..."
                                    />
                                </div>
                            )}

                            {q?.question_type === 'essay' && (
                                <div className="form-group" style={{ marginTop: 16 }}>
                                    <label className="form-label" style={{ fontSize: 13, marginBottom: 8 }}>Tulis Jawaban Anda:</label>
                                    <textarea
                                        className="input"
                                        style={{ padding: '12px 16px', fontSize: 15, minHeight: 200, lineHeight: 1.6 }}
                                        value={answers[q?.id] || ''}
                                        onChange={e => selectAnswer(q.id, e.target.value)}
                                        placeholder="Tulis uraian jawaban Anda di sini secara lengkap..."
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="q-nav">
                        <button className="q-nav-btn" onClick={() => goToQuestion(current - 1)} disabled={current === 0}>
                            ← Sebelumnya
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{current + 1} / {total}</span>
                        <button className="q-nav-btn next-btn" onClick={() => goToQuestion(current + 1)} disabled={current === total - 1}>
                            Selanjutnya →
                        </button>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="exam-sidebar">
                    <div className="es-title">Navigasi Soal</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 16, fontSize: 10, color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--green)' }} /> Dijawab</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--yellow)' }} /> Ragu-ragu</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--border-hover)' }} /> Dilihat</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--bg-glass)', border: '1px solid var(--border-color)' }} /> Belum Dilihat</div>
                    </div>
                    <div className="q-grid-nav">
                        {questions.map((_, i) => {
                            const qId = questions[i]?.id;
                            let cls = '';
                            if (i === current) cls = 'current';

                            // Visual Priority: Flagged > Answered > Visited > Default
                            let stateCls = '';
                            if (flags[qId]) stateCls = 'flagged';
                            else if (answers[qId]) stateCls = 'answered';
                            else if (visited[qId]) stateCls = 'visited';

                            return (
                                <button key={i} className={`q-grid-btn ${cls} ${stateCls}`} onClick={() => goToQuestion(i)}>
                                    {i + 1}
                                </button>
                            );
                        })}
                    </div>

                    <div className="es-title">Ringkasan</div>
                    <div className="es-stats">
                        <div className="ess"><div className="ess-val" style={{ color: 'var(--blue)' }}>{answered}</div><div className="ess-lbl">Dijawab</div></div>
                        <div className="ess"><div className="ess-val" style={{ color: 'var(--text-muted)' }}>{total - answered}</div><div className="ess-lbl">Kosong</div></div>
                        <div className="ess"><div className="ess-val" style={{ color: 'var(--yellow)' }}>{flagged}</div><div className="ess-lbl">Ragu</div></div>
                    </div>

                    <button className="btn btn-primary btn-full" style={{ padding: 14 }} onClick={() => setShowConfirm(true)}>
                        ✅ Kumpulkan Jawaban
                    </button>
                </div>
            </div>

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                        <div className="modal-title">Kumpulkan Jawaban?</div>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                            Dijawab: <strong style={{ color: 'var(--green)' }}>{answered}</strong> dari {total} soal
                        </p>
                        {total - answered > 0 && (
                            <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 16 }}>
                                ⚠️ Masih ada {total - answered} soal yang belum dijawab!
                            </p>
                        )}
                        <div className="modal-actions" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setShowConfirm(false)}>Kembali</button>
                            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                                {submitting ? '⏳ Mengirim...' : '✅ Ya, Kumpulkan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
