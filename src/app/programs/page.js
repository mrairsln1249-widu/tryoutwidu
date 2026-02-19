'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ProgramsPage() {
    const [subjects, setSubjects] = useState([]);
    const [exams, setExams] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

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

    useEffect(() => {
        let active = true;
        (async () => {
            const currentUser = getUser();
            const [subRes, examRes] = await Promise.all([
                apiGet('/subjects'),
                apiGet('/exams?action=list'),
            ]);

            if (!active) return;

            const userCat = currentUser?.category || 'SMA';
            const userGrade = currentUser?.grade;

            if (subRes.success) {
                const filteredSubs = subRes.subjects.filter(s => {
                    const catMatch = s.category === userCat || s.category === 'All' || s.category === 'Umum';
                    if (!catMatch) return false;
                    if (s.level_class && userGrade && s.level_class !== userGrade) return false;
                    return true;
                });
                setSubjects(filteredSubs);
            }

            if (examRes.success) {
                const filteredExs = examRes.exams.filter(e => {
                    const relatedSubjects = subRes.subjects.filter(s => getExamSubjectIds(e).includes(Number(s.id)));
                    if (!relatedSubjects.length) return false;
                    return relatedSubjects.some(sub => {
                        const catMatch = sub.category === userCat || sub.category === 'All' || sub.category === 'Umum';
                        if (!catMatch) return false;
                        if (sub.level_class && userGrade && sub.level_class !== userGrade) return false;
                        return true;
                    });
                });
                setExams(filteredExs);
            }

            setLoading(false);
        })();

        return () => { active = false; };
    }, []);

    const filteredExams = selectedSubject
        ? exams.filter(e => getExamSubjectIds(e).includes(Number(selectedSubject)))
        : exams;

    const grouped = {};
    subjects.forEach(s => {
        grouped[s.category] = grouped[s.category] || [];
        grouped[s.category].push(s);
    });

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div>
                        <h1>📚 Program Ujian</h1>
                        <div className="topbar-sub">Pilih mata pelajaran dan mulai ujian</div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : (
                    <>
                        {/* Subject Filter */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
                            <button className={`btn ${!selectedSubject ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                onClick={() => setSelectedSubject(null)}>Semua</button>
                            {subjects.map(s => (
                                <button key={s.id}
                                    className={`btn ${selectedSubject === s.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                                    onClick={() => setSelectedSubject(s.id)}>
                                    {s.icon} {s.name}
                                </button>
                            ))}
                        </div>

                        {/* Exam Cards */}
                        {filteredExams.length > 0 ? (
                            <div className="programs-grid">
                                {filteredExams.map(exam => (
                                    <div key={exam.id} className="program-card card-hover"
                                        onClick={() => router.push(`/exam/${exam.id}`)}>
                                        <div className="program-icon">{exam.subject_icon}</div>
                                        <div className="program-title">{exam.title}</div>
                                        <div className="program-meta">
                                            <span>📖 {exam.subject_name}</span>
                                            <span>❓ {exam.question_count || exam.total_questions} soal</span>
                                            <span>⏱ {exam.duration} menit</span>
                                        </div>
                                        {exam.description && (
                                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                                                {exam.description.length > 100 ? exam.description.substring(0, 100) + '...' : exam.description}
                                            </p>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className={`badge badge-${exam.difficulty_level === 'hard' ? 'danger' : exam.difficulty_level === 'medium' ? 'warning' : 'success'}`}>
                                                {exam.difficulty_level === 'hard' ? '🔥 Sulit' : exam.difficulty_level === 'medium' ? '⚡ Sedang' : '✅ Mudah'}
                                            </span>
                                            <button className="btn btn-primary btn-sm">Mulai Ujian →</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state card"><div className="icon">📚</div><h3>Belum ada ujian tersedia</h3><p>Hubungi admin untuk menambahkan ujian.</p></div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
