'use client';
import { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { apiGet, apiPost } from '@/lib/api';

export default function AdminSubjectsPage() {
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: '', category: 'SMA', level_class: '10', description: '', icon: '📚' });
    const [message, setMessage] = useState(null);

    const getClassesForCategory = (cat) => {
        if (cat === 'SD') return ['1', '2', '3', '4', '5', '6'];
        if (cat === 'SMP') return ['7', '8', '9'];
        if (cat === 'SMA') return ['10', '11', '12'];
        if (cat === 'Alumni') return ['Gapyear'];
        return [];
    };

    const loadData = useCallback(async () => {
        const res = await apiGet('/subjects');
        if (res.success) setSubjects(res.subjects);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const action = editing ? 'update' : 'create';
        const data = editing ? { ...form, id: editing.id } : form;
        const res = await apiPost('/subjects', { action, ...data });
        if (res.success) {
            setMessage({ type: 'success', text: res.message });
            setShowForm(false);
            setEditing(null);
            setForm({ name: '', category: 'SMA', level_class: '10', description: '', icon: '📚' });
            loadData();
        }
        else setMessage({ type: 'error', text: res.message });
    };

    const handleEdit = (s) => {
        setEditing(s);
        setForm({
            name: s.name,
            category: s.category,
            level_class: s.level_class || '',
            description: s.description || '',
            icon: s.icon || '📚'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Yakin ingin menghapus mata pelajaran ini?')) return;
        const res = await apiPost('/subjects', { action: 'delete', id });
        if (res.success) { setMessage({ type: 'success', text: res.message }); loadData(); }
        else setMessage({ type: 'error', text: res.message || 'Gagal menghapus mata pelajaran' });
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div className="topbar">
                    <div><h1>📖 Mata Pelajaran</h1><div className="topbar-sub">Kelola mata pelajaran dan kategori</div></div>
                    <button className="btn btn-primary btn-sm" onClick={() => { setShowForm(true); setEditing(null); setForm({ name: '', category: 'SMA', level_class: '10', description: '', icon: '📚' }); }}>+ Tambah Mapel</button>
                </div>

                {message && <div className={`alert alert-${message.type}`}>{message.type === 'success' ? '✅' : '❌'} {message.text}</div>}

                {showForm && (
                    <div className="card" style={{ marginBottom: 24, maxWidth: 500 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{editing ? '✏️ Edit' : '+ Tambah'} Mata Pelajaran</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Nama</label>
                                    <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Kategori</label>
                                    <select
                                        className="select"
                                        value={form.category}
                                        onChange={e => {
                                            const cat = e.target.value;
                                            const available = getClassesForCategory(cat);
                                            setForm({ ...form, category: cat, level_class: available[0] || '' });
                                        }}
                                    >
                                        <option value="SD">SD</option>
                                        <option value="SMP">SMP</option>
                                        <option value="SMA">SMA</option>
                                        <option value="Alumni">Alumni</option>
                                        <option value="Umum">Umum</option>
                                    </select></div>
                                <div className="form-group"><label className="form-label">Kelas</label>
                                    <select
                                        className="select"
                                        value={form.level_class}
                                        onChange={e => setForm({ ...form, level_class: e.target.value })}
                                        disabled={!form.category || form.category === 'Umum'}
                                    >
                                        <option value="">Pilih Kelas</option>
                                        {getClassesForCategory(form.category).map(c => (
                                            <option key={c} value={c}>Kelas {c}</option>
                                        ))}
                                    </select></div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group"><label className="form-label">Icon (emoji)</label>
                                    <input className="input" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Deskripsi</label>
                                    <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary btn-sm" type="submit">💾 Simpan</button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setShowForm(false); setEditing(null); }}>Batal</button>
                            </div>
                        </form>
                    </div>
                )}

                {loading ? <div className="loading-page"><div className="spinner" /></div> : (
                    <div className="programs-grid">
                        {subjects.map((s) => (
                            <div key={s.id} className="card card-hover">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>{s.icon}</div>
                                        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{s.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                                            {s.category} {s.level_class ? `· Kelas ${s.level_class}` : ''} · {s.exam_count || 0} ujian
                                        </div>
                                        {s.description && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.description}</p>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(s)}>✏️</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>🗑</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
