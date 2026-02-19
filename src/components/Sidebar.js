'use client';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getUser, removeToken } from '@/lib/api';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';

export default function Sidebar({ user }) {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    const isAdmin = user?.role === 'admin';
    const isTeacher = user?.role === 'teacher';
    const isStaff = isAdmin || isTeacher;

    const studentNav = [
        { href: '/dashboard', icon: '🏠', label: 'Dashboard' },
        { href: '/programs', icon: '📚', label: 'Program Ujian' },
        { href: '/history', icon: '📋', label: 'Riwayat Ujian' },
        { href: '/leaderboard', icon: '🏆', label: 'Leaderboard' },
        { href: '/profile', icon: '👤', label: 'Profil Saya' },
    ];

    const teacherNav = [
        { href: '/admin', icon: '📊', label: 'Dashboard' },
        { href: '/admin/monitoring', icon: '📡', label: 'Live Monitor' },
        { href: '/admin/exams', icon: '📝', label: 'Kelola Ujian' },
        { href: '/admin/questions', icon: '❓', label: 'Bank Soal' },
    ];

    const adminNav = [
        { href: '/admin', icon: '📊', label: 'Dashboard' },
        { href: '/admin/monitoring', icon: '📡', label: 'Live Monitor' },
        { href: '/admin/users', icon: '👥', label: 'Kelola Users' },
        { href: '/admin/subjects', icon: '📖', label: 'Mata Pelajaran' },
        { href: '/admin/exams', icon: '📝', label: 'Kelola Ujian' },
        { href: '/admin/questions', icon: '❓', label: 'Bank Soal' },
    ];

    const nav = isAdmin ? adminNav : (isTeacher ? teacherNav : studentNav);

    const handleLogout = () => {
        removeToken();
        router.push('/');
    };

    return (
        <>
            <button className="mobile-menu-btn" onClick={() => setOpen(!open)} style={{ position: 'fixed', top: 16, left: 16, zIndex: 200 }}>
                {open ? '✕' : '☰'}
            </button>

            {open && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setOpen(false)} />}

            <aside className={`sidebar ${open ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div style={{ position: 'relative', width: '100%', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Image
                            src="/logo.png"
                            alt="TO Wijaya Edu"
                            width={160}
                            height={50}
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', width: 'auto', height: '100%' }}
                        />
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {nav.map(item => (
                        <a key={item.href} href={item.href}
                            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                            onClick={(e) => { e.preventDefault(); router.push(item.href); setOpen(false); }}>
                            <span className="icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </a>
                    ))}

                    {isStaff && (
                        <>
                            <div className="nav-divider" />
                            <a href="/dashboard" className="nav-item" onClick={(e) => { e.preventDefault(); router.push('/dashboard'); }}>
                                <span className="icon">🎓</span><span>Mode Siswa</span>
                            </a>
                        </>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                        <ThemeToggle />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, padding: '0 8px' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%', background: 'var(--gradient-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0
                        }}>
                            {user?.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.full_name || 'User'}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isAdmin ? '🛡️ Administrator' : isTeacher ? '👨‍🏫 Guru' : `🎓 ${user?.grade || 'Siswa'}`}</div>
                        </div>
                    </div>
                    <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>
                        <span className="icon">🚪</span><span>Keluar</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
