'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

const DEFAULT_FORM = {
    title: '',
    subject_ids: [],
    description: '',
    duration: 60,
    passing_score: 60,
    max_score: 100,
    difficulty_level: 'medium',
    question_limit: '',
};

function getScaleMax(exam) {
    const maxScore = Number(exam?.max_score);
    if (maxScore >= 1000) return 1000;
    return Number(exam?.passing_score) > 100 ? 1000 : 100;
}

function parseExamSubjectIds(exam) {
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
}

export default function AdminExamsPage() {
    const [exams, setExams] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [message, setMessage] = useState(null);
    const router = useRouter();

    async function loadData() {
        const [exRes, subRes] = await Promise.all([apiGet('/exams?action=all'), apiGet('/subjects')]);
        if (exRes.success) setExams(exRes.exams);
        if (subRes.success) setSubjects(subRes.subjects);
        setLoading(false);
    }

    useEffect(() => {
        let active = true;
        (async () => {
            const [exRes, subRes] = await Promise.all([apiGet('/exams?action=all'), apiGet('/subjects')]);
            if (!active) return;
            if (exRes.success) setExams(exRes.exams);

            if (subRes.success) {
                const u = getUser();
                if (u?.role === 'teacher') {
                    const allowedIds = u.assigned_subjects?.map(s => s.id) || [];
                    setSubjects(subRes.subjects.filter(s => allowedIds.includes(s.id)));
                } else {
                    setSubjects(subRes.subjects);
                }
            }
            setLoading(false);
        })();
        return () => { active = false; };
    }, []);

    const handleScaleChange = (value) => {
        const maxScore = Number(value) >= 1000 ? 1000 : 100;
        setForm(prev => {
            let nextPassing = Number(prev.passing_score);
            if (!Number.isFinite(nextPassing)) nextPassing = maxScore === 1000 ? 550 : 60;
            if (maxScore === 1000 && (nextPassing < 10 || nextPassing > 1000)) nextPassing = 550;
            if (maxScore === 100 && (nextPassing < 0 || nextPassing > 100)) nextPassing = 60;
            return { ...prev, max_score: maxScore, passing_score: nextPassing };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const maxScore = Number(form.max_score) >= 1000 ? 1000 : 100;
        const minPassing = maxScore === 1000 ? 10 : 0;
        const passing = Number(form.passing_score);
        const duration = Number(form.duration);
        const selectedSubjectIds = [...new Set((form.subject_ids || []).map(Number).filter(Boolean))];

        if (!Number.isFinite(duration) || duration <= 0) {
            setMessage({ type: 'error', text: 'Durasi harus lebih dari 0 menit' });
            return;
        }

        if (selectedSubjectIds.length === 0) {
            setMessage({ type: 'error', text: 'Pilih minimal 1 mata pelajaran' });
            return;
        }

        if (!Number.isFinite(passing) || passing < minPassing || passing > maxScore) {
            setMessage({ type: 'error', text: `Passing score harus di rentang ${minPassing}-${maxScore}` });
            return;
        }

        const action = editing ? 'update_exam' : 'create';
        const payload = { ...form, subject_ids: selectedSubjectIds, subject_id: selectedSubjectIds[0], max_score: maxScore };
        const data = editing ? { ...payload, id: editing.id } : payload;
        const res = await apiPost('/exams', { action, ...data });
        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            setShowForm(false);
            setEditing(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: res.message });
        }
    };

    const handleEdit = (exam) => {
        const scaleMax = getScaleMax(exam);
        setEditing(exam);
        setForm({
            title: exam.title,
            subject_ids: parseExamSubjectIds(exam),
            description: exam.description || '',
            duration: exam.duration,
            passing_score: exam.passing_score,
            max_score: scaleMax,
            difficulty_level: exam.difficulty_level,
            is_active: exam.is_active,
            question_limit: exam.question_limit || '',
        });
        setShowForm(true);
    };

    const toggleSubjectSelection = (subjectId) => {
        const parsedId = Number(subjectId);
        if (!parsedId) return;
        setForm(prev => {
            const current = Array.isArray(prev.subject_ids) ? prev.subject_ids.map(Number).filter(Boolean) : [];
            if (current.includes(parsedId)) {
                return { ...prev, subject_ids: current.filter(id => id !== parsedId) };
            }
            return { ...prev, subject_ids: [...current, parsedId] };
        });
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus ujian ini?')) return;
        const res = await apiPost('/exams', { action: 'delete_exam', id });
        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            loadData();
        }
    };

    const activeScaleMax = Number(form.max_score) >= 1000 ? 1000 : 100;
    const activeScaleMin = activeScaleMax === 1000 ? 10 : 0;

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div><h1>Kelola Ujian</h1><div className="topbar-sub">Buat dan kelola ujian CBT</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditing(null); setForm(DEFAULT_FORM); }}>+ Tambah Ujian</button>
                </div>

                {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

                {showForm && (
                    <div className="card" style={{ marginBottom: 24, maxWidth: 700 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing ? 'Edit' : 'Tambah'} Ujian</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group"><label className="form-label">Judul Ujian</label>
                                <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Mata Pelajaran (Bisa lebih dari satu)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {subjects.map(s => {
                                            const selected = (form.subject_ids || []).includes(s.id);
                                            return (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    className={`btn btn-sm ${selected ? 'btn-primary' : 'btn-secondary'}`}
                                                    onClick={() => toggleSubjectSelection(s.id)}
                                                >
                                                    {s.icon} {s.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                                        {Array.isArray(form.subject_ids) ? form.subject_ids.length : 0} mapel dipilih
                                    </div>
                                </div>
                                <div className="form-group"><label className="form-label">Durasi (menit)</label>
                                    <input className="input" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} required /></div>
                            </div>
                            <div className="grid-3">
                                <div className="form-group"><label className="form-label">Skala Penilaian</label>
                                    <select className="select" value={activeScaleMax} onChange={e => handleScaleChange(e.target.value)}>
                                        <option value={100}>Standar (0-100)</option>
                                        <option value={1000}>SNBT UTBK (10-1000)</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Passing Score</label>
                                    <input
                                        className="input"
                                        type="number"
                                        min={activeScaleMin}
                                        max={activeScaleMax}
                                        value={form.passing_score}
                                        onChange={e => setForm({ ...form, passing_score: e.target.value })}
                                    />
                                </div>
                                <div className="form-group"><label className="form-label">Tingkat Kesulitan</label>
                                    <select className="select" value={form.difficulty_level} onChange={e => setForm({ ...form, difficulty_level: e.target.value })}>
                                        <option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option><option value="mixed">Campuran</option>
                                    </select></div>
                                <div className="form-group">
                                    <label className="form-label">Jumlah Soal Diujikan</label>
                                    <input
                                        className="input"
                                        type="number"
                                        placeholder="Kosongkan = Semua"
                                        value={form.question_limit}
                                        onChange={e => setForm({ ...form, question_limit: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -6, marginBottom: 12 }}>
                                💡 Tip: Jika diisi 40 tapi tersedia 100 soal, sistem akan memilih 40 soal secara acak untuk setiap siswa. Kosongkan untuk menampilkan semua soal.
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -6, marginBottom: 12 }}>
                                Skor akhir akan dihitung otomatis ke skala {activeScaleMin}-{activeScaleMax}.
                            </div>
                            <div className="form-group"><label className="form-label">Deskripsi</label>
                                <textarea className="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" type="submit">Simpan</button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setShowForm(false); setEditing(null); }}>Batal</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <div className="loading-page"><div className="spinner" /></div> : (
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Ujian</th><th>Mapel</th><th>Durasi</th><th>Skala</th><th>Soal</th><th>Dikerjakan</th><th>Kesulitan</th><th>Status</th><th>Aksi</th></tr></thead>
                            <tbody>
                                {exams.map((exam, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600 }}>{exam.title}</td>
                                        <td>{exam.subject_icon} {exam.subject_name}</td>
                                        <td>{exam.duration} menit</td>
                                        <td>
                                            <span className={`badge ${getScaleMax(exam) === 1000 ? 'badge-warning' : 'badge-info'}`}>
                                                {getScaleMax(exam) === 1000 ? '10-1000' : '0-100'}
                                            </span>
                                        </td>
                                        <td>
                                            <span className="badge badge-info">
                                                {exam.question_limit ? `${exam.question_limit} dari ` : ''}
                                                {exam.question_count || exam.total_questions} soal
                                            </span>
                                        </td>
                                        <td>{exam.attempt_count || 0}x</td>
                                        <td><span className={`badge badge-${exam.difficulty_level === 'hard' ? 'danger' : exam.difficulty_level === 'medium' ? 'warning' : 'success'}`}>{exam.difficulty_level}</span></td>
                                        <td><span className={`badge ${exam.is_active ? 'badge-success' : 'badge-danger'}`}>{exam.is_active ? 'Aktif' : 'Nonaktif'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {(() => {
                                                    const examSubjects = parseExamSubjectIds(exam);
                                                    const firstSubjectId = examSubjects[0] || exam.subject_id || '';
                                                    return (
                                                        <button className="btn btn-info btn-sm" onClick={() => window.location.href = `/admin/questions?exam_id=${exam.id}&subject_id=${firstSubjectId}`}>Kelola Soal</button>
                                                    );
                                                })()}
                                                <button className="btn btn-primary btn-sm" onClick={() => router.push(`/admin/exams/${exam.id}/results`)}>Hasil</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(exam)}>Edit</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(exam.id)}>Hapus</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
