'use client';
import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiPost, getUser, setUser } from '@/lib/api';

export default function ProfilePage() {
    const initialUser = getUser();
    const [user, setUserState] = useState(initialUser);
    const [form, setForm] = useState({
        full_name: initialUser?.full_name || '',
        email: initialUser?.email || '',
        school: initialUser?.school || '',
        grade: initialUser?.grade || '',
        category: initialUser?.category || 'SMA',
        phone: initialUser?.phone || ''
    });
    const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm_password: '' });
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('profile');

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        const res = await apiPost('/users', { action: 'update_profile', ...form });
        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            const updatedUser = { ...user, ...form };
            setUser(updatedUser);
            setUserState(updatedUser);
        } else {
            setMessage({ type: 'error', text: res.message });
        }
        setLoading(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwForm.new_password !== pwForm.confirm_password) {
            setMessage({ type: 'error', text: 'Konfirmasi password tidak cocok' }); return;
        }
        setLoading(true);
        const res = await apiPost('/users', { action: 'change_password', ...pwForm });
        setMessage({ type: res.success ? 'success' : 'error', text: res.message });
        if (res.success) setPwForm({ old_password: '', new_password: '', confirm_password: '' });
        setLoading(false);
    };

    const getClassesForCategory = (cat) => {
        if (cat === 'SD') return ['1', '2', '3', '4', '5', '6'];
        if (cat === 'SMP') return ['7', '8', '9'];
        if (cat === 'SMA') return ['10', '11', '12'];
        if (cat === 'Alumni') return ['Alumni'];
        return [];
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar"><div><h1>👤 Profil Saya</h1><div className="topbar-sub">Kelola informasi akun Anda</div></div></div>

                {user && (
                    <div className="profile-header">
                        <div className="profile-avatar">{user.full_name?.charAt(0)?.toUpperCase()}</div>
                        <div className="profile-info">
                            <h2>{user.full_name}</h2>
                            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>@{user.username} · {user.email}</div>
                            <div style={{ marginTop: 6 }}>
                                <span className="badge badge-info">{user.role === 'admin' ? '🛡️ Administrator' : '🎓 Siswa'}</span>
                                {user.category && <span className="badge badge-accent" style={{ marginLeft: 8 }}>{user.category}</span>}
                                {user.grade && <span className="badge badge-purple" style={{ marginLeft: 8 }}>Kelas {user.grade}</span>}
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button className={`btn ${tab === 'profile' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setTab('profile'); setMessage(null); }}>📋 Edit Profil</button>
                    <button className={`btn ${tab === 'password' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => { setTab('password'); setMessage(null); }}>🔒 Ganti Password</button>
                </div>

                {message && <div className={`alert alert-${message.type}`}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                {tab === 'profile' ? (
                    <div className="card" style={{ maxWidth: 600 }}>
                        <form onSubmit={handleUpdateProfile}>
                            <div className="form-group"><label className="form-label">Nama Lengkap</label>
                                <input className="input" value={form.full_name || ''} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
                            <div className="form-group"><label className="form-label">Email</label>
                                <input className="input" type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>

                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Kategori</label>
                                    <select className="select" value={form.category || 'SMA'} onChange={e => setForm({ ...form, category: e.target.value, grade: '' })}>
                                        <option value="SD">SD</option>
                                        <option value="SMP">SMP</option>
                                        <option value="SMA">SMA</option>
                                        <option value="Alumni">Alumni</option>
                                    </select>
                                </div>
                                <div className="form-group"><label className="form-label">Kelas</label>
                                    <select className="select" value={form.grade || ''} onChange={e => setForm({ ...form, grade: e.target.value })} required>
                                        <option value="">Pilih Kelas</option>
                                        {getClassesForCategory(form.category).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Sekolah / Instansi</label>
                                    <input className="input" value={form.school || ''} onChange={e => setForm({ ...form, school: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">No. WhatsApp / HP</label>
                                    <input className="input" type="tel" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                            </div>

                            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Menyimpan...' : '💾 Simpan Perubahan'}</button>
                        </form>
                    </div>
                ) : (
                    <div className="card" style={{ maxWidth: 460 }}>
                        <form onSubmit={handleChangePassword}>
                            <div className="form-group"><label className="form-label">Password Lama</label>
                                <input className="input" type="password" value={pwForm.old_password} onChange={e => setPwForm({ ...pwForm, old_password: e.target.value })} required /></div>
                            <div className="form-group"><label className="form-label">Password Baru</label>
                                <input className="input" type="password" value={pwForm.new_password} onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} required /></div>
                            <div className="form-group"><label className="form-label">Konfirmasi Password</label>
                                <input className="input" type="password" value={pwForm.confirm_password} onChange={e => setPwForm({ ...pwForm, confirm_password: e.target.value })} required /></div>
                            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Menyimpan...' : '🔒 Ubah Password'}</button>
                        </form>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
