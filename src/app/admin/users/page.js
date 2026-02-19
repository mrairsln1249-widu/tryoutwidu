'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('users');
    const [subjects, setSubjects] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({
        username: '', email: '', password: '', full_name: '', school: '', grade: '', role: 'student', subjects: []
    });
    const [message, setMessage] = useState(null);

    const loadData = useCallback(async () => {
        const [usersRes, pendingRes, subRes] = await Promise.all([
            apiGet('/users?action=list'),
            apiGet('/users?action=pending'),
            apiGet('/subjects')
        ]);
        if (usersRes.success) setUsers(usersRes.users);
        if (pendingRes.success) setPending(pendingRes.pending);
        if (subRes.success) setSubjects(subRes.subjects);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    const handleVerify = async (userId, status) => {
        const res = await apiPost('/users', { action: 'verify', user_id: userId, status });
        if (res.success) { setMessage({ type: 'success', text: res.message }); loadData(); }
        else setMessage({ type: 'error', text: res.message });
    };

    const handleDelete = async (userId) => {
        if (!confirm('Yakin ingin menghapus user ini?')) return;
        const res = await apiPost('/users', { action: 'delete', user_id: userId });
        if (res.success) { setMessage({ type: 'success', text: res.message }); loadData(); }
        else setMessage({ type: 'error', text: res.message });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const action = editing ? 'update_user' : 'create_user';
        const data = editing ? { ...form, id: editing.id } : form;
        const res = await apiPost('/users', { action, ...data });
        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            setShowForm(false);
            setEditing(null);
            loadData();
        } else {
            setMessage({ type: 'error', text: res.message });
        }
    };

    const handleEdit = (u) => {
        setEditing(u);
        setForm({
            username: u.username,
            email: u.email,
            password: '',
            full_name: u.full_name,
            school: u.school || '',
            grade: u.grade || '',
            role: u.role,
            subjects: u.assigned_subjects?.map(s => s.id) || []
        });
        setShowForm(true);
    };

    const toggleSubject = (id) => {
        setForm(prev => {
            const curr = prev.subjects || [];
            if (curr.includes(id)) return { ...prev, subjects: curr.filter(x => x !== id) };
            if (curr.length >= 3) return prev;
            return { ...prev, subjects: [...curr, id] };
        });
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div><h1>👥 Kelola Users</h1><div className="topbar-sub">Manajemen akun siswa dan verifikasi</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                        setEditing(null);
                        setForm({ username: '', email: '', password: '', full_name: '', school: '', grade: '', role: 'student', subjects: [] });
                        setShowForm(true);
                    }}>+ Tambah User</button>
                </div>

                {showForm && (
                    <div className="card" style={{ marginBottom: 24, maxWidth: 600 }}>
                        <h3>{editing ? 'Edit' : 'Tambah'} User</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Username</label>
                                    <input className="input" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Email</label>
                                    <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Nama Lengkap</label>
                                    <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Password {editing && '(kosongkan jika tidak ganti)'}</label>
                                    <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editing} /></div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Role</label>
                                    <select className="select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                        <option value="student">Siswa</option>
                                        <option value="teacher">Guru</option>
                                        <option value="admin">Admin</option>
                                    </select></div>
                                {form.role === 'student' && (
                                    <div className="form-group"><label className="form-label">Kelas</label>
                                        <select className="select" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                                            <option value="">Pilih Kelas</option>
                                            <option value="10">10 SMA</option>
                                            <option value="11">11 SMA</option>
                                            <option value="12">12 SMA</option>
                                            <option value="Alumni">Alumni / Gap Year</option>
                                        </select></div>
                                )}
                            </div>
                            <div className="form-group"><label className="form-label">Sekolah / Instansi</label>
                                <input className="input" value={form.school} onChange={e => setForm({ ...form, school: e.target.value })} /></div>

                            {form.role === 'teacher' && (
                                <div className="form-group">
                                    <label className="form-label">Mata Pelajaran Diampu (Maks 3)</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        {subjects.map(s => (
                                            <button
                                                key={s.id}
                                                type="button"
                                                className={`btn btn-sm ${form.subjects.includes(s.id) ? 'btn-primary' : 'btn-secondary'}`}
                                                onClick={() => toggleSubject(s.id)}
                                            >
                                                {s.icon} {s.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                <button className="btn btn-primary" type="submit">Simpan</button>
                                <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>Batal</button>
                            </div>
                        </form>
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                    <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('users')}>👥 Semua Users ({users.length})</button>
                    <button className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setTab('pending')}>
                        ⏳ Verifikasi {pending.length > 0 && <span className="badge badge-warning" style={{ marginLeft: 6 }}>{pending.length}</span>}
                    </button>
                </div>

                {message && <div className={`alert alert-${message.type}`}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                {loading ? <div className="loading-page"><div className="spinner" /></div>
                    : tab === 'pending' ? (
                        pending.length > 0 ? (
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Sekolah</th><th>Kelas</th><th>Tanggal</th><th>Aksi</th></tr></thead>
                                    <tbody>
                                        {pending.map((u, i) => (
                                            <tr key={i}>
                                                <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                                                <td>@{u.username}</td>
                                                <td>{u.email}</td>
                                                <td>{u.school || '-'}</td>
                                                <td><span className="badge badge-info">{u.grade}</span></td>
                                                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button className="btn btn-success btn-sm" onClick={() => handleVerify(u.id, 'approved')}>✅ Terima</button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleVerify(u.id, 'rejected')}>❌ Tolak</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <div className="empty-state card"><div className="icon">✅</div><h3>Tidak ada permintaan pending</h3></div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead><tr><th>Nama</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Sekolah</th><th>Aksi</th></tr></thead>
                                <tbody>
                                    {users.map((u, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                                            <td>@{u.username}</td>
                                            <td>{u.email}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <span className={`badge ${u.role === 'admin' ? 'badge-purple' : u.role === 'teacher' ? 'badge-warning' : 'badge-info'}`}>
                                                        {u.role === 'admin' ? '🛡️ Admin' : u.role === 'teacher' ? '👨‍🏫 Guru' : '🎓 Siswa'}
                                                    </span>
                                                    {u.role === 'teacher' && u.assigned_subjects?.length > 0 && (
                                                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                            {u.assigned_subjects.map(s => <span key={s.id} className="badge" style={{ fontSize: 9, padding: '2px 4px' }}>{s.name}</span>)}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td><span className={`badge ${u.is_verified ? 'badge-success' : 'badge-warning'}`}>{u.is_verified ? '✅ Verified' : '⏳ Pending'}</span></td>
                                            <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{u.school || '-'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(u)}>✏️</button>
                                                    {u.role !== 'admin' && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>🗑</button>}
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
