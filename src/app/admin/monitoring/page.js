'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet } from '@/lib/api';

export default function ExamMonitoringPage() {
    const [monitoring, setMonitoring] = useState([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const loadMonitoring = useCallback(async () => {
        const res = await apiGet('/exams?action=monitoring');
        if (res.success) {
            setMonitoring(res.monitoring);
            setLastUpdate(new Date());
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadMonitoring();
        }, 0);
        const interval = setInterval(loadMonitoring, 15000); // Poll every 15s
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [loadMonitoring]);

    const formatTime = (seconds) => {
        if (seconds <= 0) return 'Habis';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div>
                        <h1>🛰️ Live Monitoring</h1>
                        <div className="topbar-sub">Pantau pengerjaan ujian secara real-time</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Berbarui otomatis setiap 15 detik</div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>Update Terakhir: {lastUpdate.toLocaleTimeString('id-ID')}</div>
                    </div>
                </div>

                <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-icon">📡</div>
                        <div className="stat-value">{monitoring.length}</div>
                        <div className="stat-label">Sedang Mengerjakan</div>
                    </div>
                </div>

                {loading && monitoring.length === 0 ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : monitoring.length > 0 ? (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrap" style={{ border: 'none', boxShadow: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Siswa</th>
                                        <th>Detail</th>
                                        <th>Ujian</th>
                                        <th style={{ width: 180 }}>Progres</th>
                                        <th style={{ width: 120 }}>Sisa Waktu</th>
                                        <th style={{ width: 100 }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monitoring.map((m, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.full_name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.school}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{m.grade}</span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.exam_title}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    Mulai: {new Date(m.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ flex: 1, height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                                        <div style={{
                                                            height: '100%',
                                                            width: `${m.progress_percent}%`,
                                                            background: 'var(--accent)',
                                                            transition: 'width 0.5s ease'
                                                        }} />
                                                    </div>
                                                    <div style={{ fontSize: 11, fontWeight: 800, minWidth: 60 }}>
                                                        {m.answered_count}/{m.total_questions}
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{
                                                    fontSize: 14, fontWeight: 800,
                                                    color: m.remaining_seconds < 300 ? 'var(--red)' : 'var(--text-primary)'
                                                }}>
                                                    {formatTime(m.remaining_seconds)}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-success" style={{ animation: 'pulse 2s infinite' }}>Sedang Aktif</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="empty-state card" style={{ padding: '80px 20px' }}>
                        <div className="icon">📡</div>
                        <h3>Tidak ada ujian aktif</h3>
                        <p>Saat ini tidak ada siswa yang sedang mengerjakan ujian.</p>
                        <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={loadMonitoring}>Refresh Data</button>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
