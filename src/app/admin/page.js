'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const loadData = useCallback(async () => {
        const res = await apiGet('/dashboard?action=admin');
        if (res.success) setData(res);
        setLoading(false);
    }, []);

    useEffect(() => {
        const u = getUser();
        if (!u || u.role !== 'admin') { router.push('/dashboard'); return; }
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [router, loadData]);

    return (
        <AppLayout>
            <div className="fade-in">
                {/* Enhanced Staff Welcome Banner */}
                <div className="welcome-banner" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div className="badge badge-accent" style={{ marginBottom: 12 }}>🚀 Staff Control Center</div>
                        <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
                            Selamat Bertugas, {data?.staff_name || 'Admin'}! 👨‍💻
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: 600 }}>
                            Pantau aktivitas pengerjaan ujian dan kelola konten platform secara real-time dari panel kendali Anda.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : data ? (
                    <>
                        {/* Quick Action Hub */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
                            <button className="btn btn-primary" style={{ padding: '20px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }} onClick={() => router.push('/admin/exams')}>
                                <span style={{ fontSize: 24 }}>📝</span>
                                <span style={{ fontWeight: 700 }}>Buat Ujian Baru</span>
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '20px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--bg-glass)' }} onClick={() => router.push('/admin/monitoring')}>
                                <span style={{ fontSize: 24 }}>📡</span>
                                <span style={{ fontWeight: 700 }}>Live Monitoring</span>
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '20px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--bg-glass)' }} onClick={() => router.push('/admin/questions')}>
                                <span style={{ fontSize: 24 }}>❓</span>
                                <span style={{ fontWeight: 700 }}>Bank Soal</span>
                            </button>
                            {data.stats.pending_verifications > 0 && (
                                <button className="btn" style={{ padding: '20px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'var(--yellow-soft)', color: 'var(--yellow)', border: '1px solid var(--yellow)' }} onClick={() => router.push('/admin/users')}>
                                    <span style={{ fontSize: 24 }}>⏳</span>
                                    <span style={{ fontWeight: 700 }}>{data.stats.pending_verifications} Verifikasi</span>
                                </button>
                            )}
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon">👥</div>
                                <div className="stat-value">{data.stats.total_users}</div>
                                <div className="stat-label">Total Siswa</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">📝</div>
                                <div className="stat-value">{data.stats.total_exams}</div>
                                <div className="stat-label">Ujian Aktif</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">📊</div>
                                <div className="stat-value">{data.stats.total_attempts}</div>
                                <div className="stat-label">Total Pengerjaan</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">⭐</div>
                                <div className="stat-value">{data.stats.avg_score || 0}</div>
                                <div className="stat-label">Rata-rata Skor</div>
                            </div>
                        </div>

                        <div className="grid-2" style={{ alignItems: 'start' }}>
                            <div className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>📋 Pengerjaan Terbaru</h3>
                                    <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }} onClick={() => router.push('/admin/exams')}>Lihat Semua</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {data.recentAttempts?.length > 0 ? data.recentAttempts.map((a, i) => (
                                        <div key={i} className="activity-item" onClick={() => router.push(`/admin/exams/${a.exam_id}/results`)}>
                                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                                <div style={{
                                                    width: 44, height: 44, borderRadius: 10,
                                                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                                                }}>
                                                    {a.subject_icon || '👤'}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.full_name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.title}</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: 16, fontWeight: 900,
                                                    color: a.score >= 80 ? 'var(--green)' : a.score >= 60 ? 'var(--yellow)' : 'var(--red)'
                                                }}>{a.score}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.end_time ? new Date(a.end_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="empty-state">
                                            <div className="icon">📋</div>
                                            <p>Belum ada aktivitas pengerjaan.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="card" style={{ padding: '24px' }}>
                                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>📖 Statistik per Mapel</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {data.subjectStats?.map((s, i) => (
                                        <div key={i} style={{ paddingBottom: i < data.subjectStats.length - 1 ? 16 : 0, borderBottom: i < data.subjectStats.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                                                </div>
                                                <span className="badge badge-purple">{s.attempts || 0} pengerjaan</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <div style={{ flex: 1, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%',
                                                        width: `${s.avg_score}%`,
                                                        background: 'var(--gradient-primary)',
                                                        borderRadius: 4
                                                    }} />
                                                </div>
                                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', minWidth: 60 }}>
                                                    Avg: {s.avg_score || 0}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                        <div style={{ fontSize: 40, marginBottom: 20 }}>⚠️</div>
                        <h3 style={{ marginBottom: 10 }}>Gagal Memuat Data</h3>
                        <p style={{ color: 'var(--text-muted)' }}>Sistem tidak dapat mengambil data statistik admin saat ini.</p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
