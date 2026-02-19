'use client';
import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet } from '@/lib/api';
import { gradeFromScore, resolveScoreScale, scoreToPercentage } from '@/lib/scoring';

export default function HistoryPage() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            const res = await apiGet(`/history?page=${page}`);
            if (!active) return;
            if (res.success) {
                setHistory(res.history);
                setTotal(res.total);
            }
            setLoading(false);
        })();
        return () => { active = false; };
    }, [page]);

    const getScoreColor = (percentage) => percentage >= 80 ? 'var(--green)' : percentage >= 60 ? 'var(--yellow)' : 'var(--red)';

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div>
                        <h1>📋 Riwayat Ujian</h1>
                        <div className="topbar-sub">Semua ujian yang telah Anda selesaikan</div>
                    </div>
                    <span className="badge badge-info">{total} ujian selesai</span>
                </div>

                {loading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : history.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Ujian</th>
                                    <th>Mata Pelajaran</th>
                                    <th>Skor</th>
                                    <th>Grade</th>
                                    <th>Persentil</th>
                                    <th>Tanggal</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((h, i) => {
                                    const scale = resolveScoreScale({ maxScore: h.max_score, passingScore: h.passing_score, score: h.score });
                                    const percentage = scoreToPercentage(h.score, scale);
                                    const grade = gradeFromScore(h.score, scale);

                                    return (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600 }}>{h.title}</td>
                                            <td><span>{h.subject_icon} {h.subject_name}</span></td>
                                            <td><span style={{ color: getScoreColor(percentage), fontWeight: 700, fontSize: 16 }}>{h.score}</span></td>
                                            <td><span className={`badge badge-${percentage >= 80 ? 'success' : percentage >= 60 ? 'warning' : 'danger'}`}>{grade}</span></td>
                                            <td>{h.percentile ? `Top ${100 - h.percentile}%` : '-'}</td>
                                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                                {h.end_time ? new Date(h.end_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td>
                                                <a href={`/exam/${h.exam_id}/result?attempt=${h.id}`} className="btn btn-secondary btn-sm">Detail</a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state card"><div className="icon">📋</div><h3>Belum ada riwayat</h3><p>Ikuti ujian untuk melihat riwayat Anda.</p></div>
                )}
            </div>
        </AppLayout>
    );
}
