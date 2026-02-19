'use client';
import { useEffect, useState } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ compact = false }) {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const titleText = mounted ? (theme === 'dark' ? 'Mode Terang' : 'Mode Gelap') : 'Ganti Tema';
    const labelText = mounted ? (theme === 'dark' ? 'Dark' : 'Light') : 'Theme';

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={titleText}
            aria-label="Toggle theme"
            suppressHydrationWarning
        >
            <div className="theme-toggle-track">
                <span className="theme-icon sun">☀️</span>
                <span className="theme-icon moon">🌙</span>
                <div className="theme-toggle-thumb" />
            </div>
            {!compact && (
                <span className="theme-toggle-label" suppressHydrationWarning>{labelText}</span>
            )}
        </button>
    );
}
