'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import AppLayout from '@/components/AppLayout';
import { apiGet } from '@/lib/api';

export default function ExamBulkResults() {
    const { id } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const reportRef = useRef(null);

    const loadData = useCallback(async () => {
        const res = await apiGet(`/exams?action=exam_results&exam_id=${id}`);
        if (res.success) setData(res);
        setLoading(false);
    }, [id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadData]);

    const exportToCSV = () => {
        if (!data) return;
        const headers = ['Nama Lengkap', 'Sekolah', 'Kelas', 'Email', 'Skor', 'Peringkat', 'Waktu Selesai'];
        const rows = data.results.map((r, i) => [
            r.full_name,
            r.school,
            r.grade,
            r.email,
            r.score,
            i + 1,
            new Date(r.end_time).toLocaleString('id-ID')
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Hasil_${data.exam.title}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredResults = data?.results?.filter(r =>
        r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.school.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;
    if (!data) return <AppLayout><div className="card">Data tidak ditemukan</div></AppLayout>;

    return (
        <AppLayout>
            <div className="fade-in no-print">
                <div className="topbar">
                    <div>
                        <h1>📊 Rekap Hasil Ujian</h1>
                        <div className="topbar-sub">{data.exam.title}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={exportToCSV}>📥 Export Excel (.csv)</button>
                        <button className="btn btn-primary btn-sm" onClick={handlePrint}>🖨️ Cetak Laporan</button>
                    </div>
                </div>

                <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-value">{data.results.length}</div>
                        <div className="stat-label">Total Peserta</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📈</div>
                        <div className="stat-value">
                            {data.results.length > 0 ? (data.results.reduce((acc, r) => acc + (Number(r.score) || 0), 0) / data.results.length).toFixed(1) : 0}
                        </div>
                        <div className="stat-label">Rata-rata Skor</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🏆</div>
                        <div className="stat-value">{data.results[0]?.score || 0}</div>
                        <div className="stat-label">Skor Tertinggi</div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 16 }}>
                        <input
                            className="input"
                            placeholder="Cari nama atau sekolah..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ maxWidth: 400 }}
                        />
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Nama Siswa</th>
                                    <th>Asal Sekolah</th>
                                    <th>Kelas</th>
                                    <th>Skor</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredResults.map((r, i) => (
                                    <tr key={r.id}>
                                        <td style={{ fontWeight: 800 }}>#{i + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{r.full_name}</td>
                                        <td>{r.school}</td>
                                        <td><span className="badge badge-info">{r.grade}</span></td>
                                        <td style={{ fontWeight: 800, fontSize: 16, color: r.score >= (data.exam.passing_score || 60) ? 'var(--green)' : 'var(--red)' }}>
                                            {r.score}
                                        </td>
                                        <td>
                                            <span className={`badge ${r.score >= (data.exam.passing_score || 60) ? 'badge-success' : 'badge-danger'}`}>
                                                {r.score >= (data.exam.passing_score || 60) ? 'LULUS' : 'TIDAK LULUS'}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/exam/${id}/result?attempt=${r.id}`)}>Detail</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Hidden printable report area */}
                <div className="print-only" style={{ padding: '20px', color: '#000', background: '#fff', minHeight: '100vh' }}>
                    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '3px double #000', paddingBottom: 15, marginBottom: 20 }}>
                        <Image src="/logo.png" alt="Logo" width={180} height={60} style={{ height: 60, width: 'auto', marginRight: 20 }} />
                        <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: 22 }}>PT WIJAYAEDU BERKAH ABADI</h2>
                        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>TO WIJAYA EDU - PLATFORM CBT</h1>
                        <p style={{ margin: 0, fontSize: 12 }}>Jl. Pendidikan No. 45, Jakarta | Telp: (021) 1234567 | Email: info@wijayaedu.com</p>
                    </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: 30 }}>
                    <h2 style={{ textDecoration: 'underline', marginBottom: 5 }}>LAPORAN HASIL UJIAN SISWA</h2>
                    <h3 style={{ margin: 0 }}>Nama Ujian: {data.exam.title}</h3>
                    <p style={{ margin: 5 }}>Mata Pelajaran: {data.exam.subject_name} | Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 40 }}>
                    <thead>
                        <tr>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>NO</th>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'left' }}>NAMA LENGKAP</th>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'left' }}>SEKOLAH</th>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>KELAS</th>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>SKOR</th>
                            <th style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>KETERANGAN</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.results.map((r, i) => (
                            <tr key={i}>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>{i + 1}</td>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'left', fontWeight: 600 }}>{r.full_name.toUpperCase()}</td>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'left' }}>{r.school}</td>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>{r.grade}</td>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center', fontWeight: 700 }}>{r.score}</td>
                                <td style={{ border: '1px solid #000', padding: 8, textAlign: 'center' }}>{r.score >= (data.exam.passing_score || 60) ? 'LULUS' : 'TIDAK LULUS'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 50 }}>
                    <div style={{ textAlign: 'center', width: 250 }}>
                        <p style={{ marginBottom: 80 }}>Dicetak pada {new Date().toLocaleDateString('id-ID')}<br />Mengetahui, Panitia Ujian</p>
                        <div style={{ borderBottom: '1px solid #000', width: '100%' }}></div>
                        <p style={{ marginTop: 5, fontWeight: 700 }}>TO WIJAYA EDU ADMIN</p>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .sidebar { display: none !important; }
                    .main-content { margin-left: 0 !important; padding: 0 !important; }
                    body { background: #fff !important; }
                }
                .print-only { display: none; }
            `}</style>
        </AppLayout>
    );
}
