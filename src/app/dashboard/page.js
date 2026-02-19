'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [user] = useState(() => getUser());
    const router = useRouter();

    const loadDashboard = useCallback(async () => {
        const res = await apiGet('/dashboard?action=student');
        if (res.success) setData(res);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadDashboard();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadDashboard]);

    return (
        <AppLayout>
            <div className="fade-in">
                {/* Enhanced Welcome Banner */}
                <div className="welcome-banner">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1>{data?.greeting || 'Selamat Datang'}, {user?.full_name?.split(' ')[0] || 'Siswa'}! 👋</h1>
                        <p>Ayo lanjutkan belajarmu hari ini. Fokus dan konsisten adalah kunci kesuksesan!</p>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-page">
                        <div className="spinner" />
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Menyelaraskan data belajar Anda...</p>
                    </div>
                ) : data ? (
                    <>
                        {/* Premium Stats Grid */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon">📈</div>
                                <div className="stat-value">{data.stats?.total_exams || 0}</div>
                                <div className="stat-label">Ujian Selesai</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🎯</div>
                                <div className="stat-value">{data.stats?.avg_score || 0}</div>
                                <div className="stat-label">Rata-rata Skor</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🏆</div>
                                <div className="stat-value">#{data.stats?.rank || '-'}</div>
                                <div className="stat-label">Peringkat Global</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🔥</div>
                                <div className="stat-value">{data.stats?.streak || 0}</div>
                                <div className="stat-label">Hari Beruntun</div>
                            </div>
                        </div>

                        <div className="grid-2" style={{ alignItems: 'start' }}>
                            {/* Recent Activity */}
                            <div className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>📋 Riwayat Ujian</h3>
                                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }}>Lihat Semua</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {data.recentAttempts?.length > 0 ? data.recentAttempts.map((a, i) => (
                                        <div key={i} className="activity-item" onClick={() => router.push(`/exam/${a.exam_id}/result`)}>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 12,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                                                }}>
                                                    {a.subject_icon || '📝'}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                        {new Date(a.end_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: 18, fontWeight: 900,
                                                    color: a.score >= 80 ? 'var(--green)' : a.score >= 60 ? 'var(--yellow)' : 'var(--red)'
                                                }}>{a.score}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>SKOR</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="empty-state">
                                            <div className="icon">📝</div>
                                            <h3>Belum ada riwayat</h3>
                                            <p>Semua hasil ujianmu akan muncul di sini.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Available Exams */}
                            <div className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>🚀 Ujian Tersedia</h3>
                                    <div className="badge badge-accent">{data.availableExams?.length || 0} Baru</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {data.availableExams?.length > 0 ? data.availableExams.map((e, i) => (
                                        <div key={i} className="activity-item" onClick={() => router.push(`/exam/${e.id}`)}>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 12,
                                                    background: 'var(--accent-soft)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                                                }}>
                                                    {e.subject_icon || '📚'}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{e.title}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                                                        <span>⏱️ {e.duration} menit</span>
                                                        <span>•</span>
                                                        <span>❓ {e.question_count || e.total_questions} soal</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button className="btn btn-primary btn-sm" style={{ borderRadius: 8, padding: '8px 16px' }}>
                                                Mulai
                                            </button>
                                        </div>
                                    )) : (
                                        <div className="empty-state">
                                            <div className="icon">📚</div>
                                            <h3>Semua Ujian Selesai!</h3>
                                            <p>Kembali lagi nanti untuk ujian baru.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: 40, marginBottom: 20 }}>⚠️</div>
                        <h3 style={{ marginBottom: 10 }}>Koneksi Terputus</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Gagal memuat data dashboard. Silakan refresh halaman atau coba lagi nanti.</p>
                        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => window.location.reload()}>Refresh</button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
