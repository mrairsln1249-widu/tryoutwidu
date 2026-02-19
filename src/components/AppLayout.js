'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getUser } from '@/lib/api';

export default function AppLayout({ children }) {
    const [user, setUser] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setUser(getUser());
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (hydrated && !user) {
            router.replace('/');
        }
    }, [router, hydrated, user]);

    if (!hydrated || !user) {
        return (
            <div className="loading-page">
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Memuat...</p>
            </div>
        );
    }

    return (
        <div className="app-layout">
            <Sidebar user={user} />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}
