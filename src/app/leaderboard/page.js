'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, getUser } from '@/lib/api';

export default function LeaderboardPage() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentUser = getUser();

    const loadData = useCallback(async () => {
        const res = await apiGet('/leaderboard');
        if (res.success) setLeaderboard(res.leaderboard);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    const getRankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : 'normal';

    const MovementIndicator = ({ movement }) => {
        if (movement > 0) return <span title="Peringkat Naik" style={{ color: 'var(--green)', fontSize: 11, fontWeight: 700 }}>▲ {movement}</span>;
        if (movement < 0) return <span title="Peringkat Turun" style={{ color: 'var(--red)', fontSize: 11, fontWeight: 700 }}>▼ {Math.abs(movement)}</span>;
        return <span title="Peringkat Stabil" style={{ color: 'var(--text-muted)', fontSize: 10 }}>●</span>;
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div>
                        <h1>🏆 Leaderboard</h1>
                        <div className="topbar-sub">Peringkat siswa berdasarkan rata-rata skor</div>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-page"><div className="spinner" /></div>
                ) : leaderboard.length > 0 ? (
                    <>
                        {/* Highlights / Podium */}
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 24, marginBottom: 48, padding: '0 20px', flexWrap: 'wrap' }}>
                            {/* 2nd Place */}
                            {leaderboard[1] && (
                                <div className="podium-item silver" style={{ order: -1 }}>
                                    <div className="podium-avatar">🥈</div>
                                    <div className="podium-name">{leaderboard[1].full_name}</div>
                                    <div className="podium-score">{leaderboard[1].avg_score}</div>
                                    <div className="podium-base" style={{ height: 100 }}>2</div>
                                </div>
                            )}
                            {/* 1st Place */}
                            {leaderboard[0] && (
                                <div className="podium-item gold">
                                    <div className="podium-avatar">🥇</div>
                                    <div className="podium-name">{leaderboard[0].full_name}</div>
                                    <div className="podium-score">{leaderboard[0].avg_score}</div>
                                    <div className="podium-base" style={{ height: 140 }}>1</div>
                                </div>
                            )}
                            {/* 3rd Place */}
                            {leaderboard[2] && (
                                <div className="podium-item bronze">
                                    <div className="podium-avatar">🥉</div>
                                    <div className="podium-name">{leaderboard[2].full_name}</div>
                                    <div className="podium-score">{leaderboard[2].avg_score}</div>
                                    <div className="podium-base" style={{ height: 80 }}>3</div>
                                </div>
                            )}
                        </div>

                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th style={{ width: 80 }}>Rank</th><th>Nama</th><th>Sekolah</th><th>Kelas</th><th>Rata-rata</th><th>Terbaik</th><th>Ujian</th></tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((lb, i) => (
                                        <tr key={i} style={lb.id === currentUser?.id ? { background: 'var(--accent-soft)' } : {}}>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                    <div className={`lb-rank ${getRankClass(i)}`}>
                                                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                                    </div>
                                                    <MovementIndicator movement={lb.rank_movement} />
                                                </div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {lb.full_name}
                                                {lb.id === currentUser?.id && <span className="badge badge-accent" style={{ marginLeft: 8 }}>Anda</span>}
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{lb.school || '-'}</td>
                                            <td><span className="badge badge-info">{lb.grade}</span></td>
                                            <td style={{ fontWeight: 800, fontSize: 16, color: lb.avg_score >= 80 ? 'var(--green)' : lb.avg_score >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                                                {lb.avg_score}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{lb.best_score}</td>
                                            <td><span className="badge badge-purple">{lb.total_exams}x</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : (
                    <div className="empty-state card"><div className="icon">🏆</div><h3>Belum ada data</h3><p>Leaderboard akan muncul setelah ada siswa yang menyelesaikan ujian.</p></div>
                )}
            </div>
        </AppLayout>
    );
}
