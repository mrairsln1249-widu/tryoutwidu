'use client';
import { useState, useEffect } from 'react';
import { apiPost, setToken, setUser, getUser } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';

function EyeIcon({ visible }) {
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 12S5.5 5.5 12 5.5S22 12 22 12S18.5 18.5 12 18.5S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 3L21 21" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 6.2C11 6.1 11.5 6 12 6C18.5 6 22 12 22 12C21.3 13.3 20.4 14.5 19.4 15.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.1 14.2C13.6 14.7 12.8 15 12 15C10.3 15 9 13.7 9 12C9 11.2 9.3 10.4 9.8 9.9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M6.2 6.3C4.3 7.7 2.9 9.8 2 12C2 12 5.5 18 12 18C13.9 18 15.6 17.5 17 16.7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const router = useRouter();

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [regForm, setRegForm] = useState({
    username: '', email: '', phone: '', password: '', confirm_password: '',
    full_name: '', school: '', grade: '', category: 'SMA', role: 'student', subjects: []
  });

  useEffect(() => {
    (async () => {
      const res = await apiPost('/auth', { action: 'subjects_public' });
      if (res.success) setSubjects(res.subjects);
    })();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiPost('/auth', { action: 'login', ...loginForm });
      if (res.success) {
        setToken(res.token);
        setUser(res.user);
        if (res.user.role === 'admin' || res.user.role === 'teacher') router.push('/admin');
        else router.push('/dashboard');
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan koneksi' });
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiPost('/auth', { action: 'register', ...regForm });
      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        setTab('login');
      } else {
        setMessage({ type: 'error', text: res.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'Terjadi kesalahan koneksi' });
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* Premium Minimalist Navbar */}
      <nav className="landing-nav">
        <Image src="/logo.png" alt="Logo" width={160} height={32} style={{ height: '32px', width: 'auto' }} />
        <div className="landing-nav-actions">
          <ThemeToggle />
          <a href="#auth" className="btn btn-primary btn-sm">Mulai Belajar</a>
        </div>
      </nav>

      {/* Marketing Hero Section */}
      <section className="landing-hero fade-in">
        <div className="hero-badge">✨ Platform CBT Standar Nasional</div>
        <h1 className="hero-title">
          Siapkan Masa Depan Unggul di <span>TO Wijaya Edu</span>
        </h1>
        <p className="hero-subtitle">
          Berlatih dengan ribuan soal berkualitas, sistem penilaian IRT akurat, dan analitik performa mendalam untuk kesuksesan akademis Anda.
        </p>
        <div className="hero-stats">
          <div className="h-stat"><span>5000+</span> Soal</div>
          <div className="h-stat"><span>100%</span> Standar IRT</div>
          <div className="h-stat"><span>24/7</span> Akses</div>
        </div>
        <div style={{ marginTop: '40px' }}>
          <button className="btn btn-primary btn-lg" onClick={() => document.getElementById('auth').scrollIntoView({ behavior: 'smooth' })}>
            Mulai Belajar Sekarang 🚀
          </button>
        </div>
      </section>

      {/* Feature Showcase */}
      <section className="features-section">
        <div className="section-hdr">
          <h2 className="section-title">Fitur Unggulan Kami</h2>
          <p style={{ color: 'var(--text-muted)' }}>Teknologi terbaik untuk pengalaman belajar yang luar biasa.</p>
        </div>

        <div className="feature-grid">
          <div className="feature-card slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="f-icon">📐</div>
            <h3 className="f-title">Math & LaTeX Builder</h3>
            <p className="f-desc">Dukungan penuh untuk penulisan rumus matematika kompleks dan simbol ilmiah secara visual dan mudah.</p>
          </div>
          <div className="feature-card slide-up" style={{ animationDelay: '0.2s' }}>
            <div className="f-icon">📊</div>
            <h3 className="f-title">Analitik Radar Chart</h3>
            <p className="f-desc">Visualisasikan penguasaan materi Anda melalui grafik radar yang menunjukkan kekuatan dan kelemahan di setiap topik.</p>
          </div>
          <div className="feature-card slide-up" style={{ animationDelay: '0.3s' }}>
            <div className="f-icon">📱</div>
            <h3 className="f-title">Fleksibilitas Perangkat</h3>
            <p className="f-desc">Kerjakan ujian di mana saja, kapan saja, baik melalui PC, Tablet, maupun Smartphone dengan tampilan yang responsif.</p>
          </div>
          <div className="feature-card slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="f-icon">📜</div>
            <h3 className="f-title">Pembahasan Mendalam</h3>
            <p className="f-desc">Setiap soal dilengkapi dengan pembahasan lengkap yang membantu Anda memahami konsep dasar di balik setiap jawaban.</p>
          </div>
          <div className="feature-card slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="f-icon">🏆</div>
            <h3 className="f-title">Leaderboard Nasional</h3>
            <p className="f-desc">Bandingkan peringkat Anda dengan ribuan siswa lainnya secara nasional dengan sistem skor yang akurat.</p>
          </div>
          <div className="feature-card slide-up" style={{ animationDelay: '0.6s' }}>
            <div className="f-icon">🛡️</div>
            <h3 className="f-title">Sistem Aman & Imersif</h3>
            <p className="f-desc">Antarmuka ujian yang bersih dan imersif, dilengkapi fitur auto-save untuk mencegah kehilangan data saat koneksi tidak stabil.</p>
          </div>
        </div>
      </section>

      {/* Login & Register Section */}
      <section id="auth" className="auth-section">
        <div className="login-container slide-up">
          <div className="login-brand">
            <Image src="/logo.png" alt="TO Wijaya Edu" width={240} height={80} style={{ maxWidth: '240px', height: 'auto', marginBottom: '10px' }} />
            <p>Mulai Perjalanan Belajarmu Hari Ini</p>
          </div>

          <div className="login-card" style={{ boxShadow: 'var(--shadow-glow)' }}>
            <div className="login-tabs">
              <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setMessage(null); }}>
                Masuk
              </button>
              <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setMessage(null); }}>
                Daftar
              </button>
            </div>

            {message && (
              <div className={`alert alert-${message.type}`}>
                {message.type === 'success' ? '✅' : '❌'} {message.text}
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label className="form-label">Username atau Email</label>
                  <input className="input" type="text" placeholder="Masukkan username atau email"
                    value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                    required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showLoginPassword ? 'text' : 'password'} placeholder="Masukkan password"
                      value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      style={{ paddingRight: 44 }}
                      required />
                    <button
                      type="button"
                      aria-label={showLoginPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      title={showLoginPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      onClick={() => setShowLoginPassword(prev => !prev)}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <EyeIcon visible={showLoginPassword} />
                    </button>
                  </div>
                </div>
                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? '⏳ Memproses...' : '🚀 Masuk Sekarang'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister}>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Username</label>
                    <input className="input" type="text" placeholder="username123"
                      value={regForm.username} onChange={e => setRegForm({ ...regForm, username: e.target.value })}
                      required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Email</label>
                    <input className="input" type="email" placeholder="email@contoh.com"
                      value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })}
                      required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Nama Lengkap</label>
                    <input className="input" type="text" placeholder="Nama lengkap Anda"
                      value={regForm.full_name} onChange={e => setRegForm({ ...regForm, full_name: e.target.value })}
                      required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">No. WhatsApp / HP</label>
                    <input className="input" type="tel" placeholder="08123456789"
                      value={regForm.phone} onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                      required />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Daftar Sebagai</label>
                    <select className="select" value={regForm.role} onChange={e => setRegForm({ ...regForm, role: e.target.value })}>
                      <option value="student">Siswa</option>
                      <option value="teacher">Guru / Pengajar</option>
                    </select>
                  </div>
                  {regForm.role === 'student' && (
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Kategori</label>
                      <select className="select" value={regForm.category} onChange={e => setRegForm({ ...regForm, category: e.target.value, grade: '' })}>
                        <option value="SD">SD (Sekolah Dasar)</option>
                        <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
                        <option value="SMA">SMA (Sekolah Menengah Atas)</option>
                        <option value="Alumni">Alumni / Gap Year</option>
                      </select>
                    </div>
                  )}
                </div>

                {regForm.role === 'student' ? (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Kelas</label>
                    <select className="select" value={regForm.grade}
                      onChange={e => setRegForm({ ...regForm, grade: e.target.value })} required>
                      <option value="">Pilih Kelas</option>
                      {regForm.category === 'SD' && (
                        <>
                          <option value="1">Kelas 1</option><option value="2">Kelas 2</option><option value="3">Kelas 3</option>
                          <option value="4">Kelas 4</option><option value="5">Kelas 5</option><option value="6">Kelas 6</option>
                        </>
                      )}
                      {regForm.category === 'SMP' && (
                        <>
                          <option value="7">Kelas 7</option><option value="8">Kelas 8</option><option value="9">Kelas 9</option>
                        </>
                      )}
                      {regForm.category === 'SMA' && (
                        <>
                          <option value="10">Kelas 10</option><option value="11">Kelas 11</option><option value="12">Kelas 12</option>
                        </>
                      )}
                      {regForm.category === 'Alumni' && <option value="Alumni">Alumni</option>}
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Mapel Diampu (Maks 3)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {subjects.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className={`badge ${regForm.subjects.includes(s.id) ? 'badge-primary' : 'badge-secondary'}`}
                          style={{ cursor: 'pointer', border: 'none' }}
                          onClick={() => {
                            const curr = regForm.subjects;
                            if (curr.includes(s.id)) setRegForm({ ...regForm, subjects: curr.filter(x => x !== s.id) });
                            else if (curr.length < 3) setRegForm({ ...regForm, subjects: [...curr, s.id] });
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Asal Sekolah / Instansi</label>
                  <input className="input" type="text" placeholder="Nama sekolah/instansi"
                    value={regForm.school} onChange={e => setRegForm({ ...regForm, school: e.target.value })}
                    required />
                </div>
                <div className="grid-2">
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="input" type={showRegisterPassword ? 'text' : 'password'} placeholder="Min. 6 karakter"
                        value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                        style={{ paddingRight: 44 }}
                        required />
                      <button
                        type="button"
                        aria-label={showRegisterPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        title={showRegisterPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        onClick={() => setShowRegisterPassword(prev => !prev)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <EyeIcon visible={showRegisterPassword} />
                      </button>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label className="form-label">Konfirmasi Password</label>
                    <div style={{ position: 'relative' }}>
                      <input className="input" type={showRegisterConfirmPassword ? 'text' : 'password'} placeholder="Ulangi password"
                        value={regForm.confirm_password} onChange={e => setRegForm({ ...regForm, confirm_password: e.target.value })}
                        style={{ paddingRight: 44 }}
                        required />
                      <button
                        type="button"
                        aria-label={showRegisterConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                        title={showRegisterConfirmPassword ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                        onClick={() => setShowRegisterConfirmPassword(prev => !prev)}
                        style={{
                          position: 'absolute',
                          right: 10,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <EyeIcon visible={showRegisterConfirmPassword} />
                      </button>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
                  {loading ? '⏳ Memproses...' : '📝 Daftar Sekarang'}
                </button>
                <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
                  <p>Butuh bantuan pendaftaran? Hubungi Admin:</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                    <a href="https://wa.me/628567892884" target="_blank" style={{ color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📱 WhatsApp</span>
                    </a>
                    <a href="mailto:wijayaedu@gmail.com" style={{ color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📧 Email</span>
                    </a>
                  </div>
                </div>
              </form>
            )}

            <div className="login-footer">
              {tab === 'login'
                ? <>Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setTab('register'); }}>Daftar di sini</a></>
                : <>Sudah punya akun? <a href="#" onClick={(e) => { e.preventDefault(); setTab('login'); }}>Masuk di sini</a></>
              }
            </div>
          </div>
        </div>
      </section>

      {/* Modern Footer */}
      <footer style={{ background: 'var(--bg-secondary)', padding: '60px 24px 30px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 40 }}>
          <div>
            <Image src="/logo.png" alt="Logo" width={180} height={60} style={{ maxWidth: 180, width: '100%', height: 'auto', marginBottom: 20 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Solusi terbaik untuk persiapan ujian CBT Nasional. Kami menyediakan bank soal terupdate dan sistem analitik berbasis data.
            </p>
          </div>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Tautan Cepat</h4>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Beranda</a></li>
              <li><a href="#auth" style={{ color: 'var(--text-secondary)' }}>Daftar Ujian</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Tentang Kami</a></li>
              <li><a href="#" style={{ color: 'var(--text-secondary)' }}>Hubungi Admin</a></li>
            </ul>
          </div>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Kontak & Media</h4>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <li style={{ color: 'var(--text-secondary)' }}>📧 wijayaedu@gmail.com</li>
              <li style={{ color: 'var(--text-secondary)' }}>📞 +62 856-7892-884</li>
              <li style={{ color: 'var(--text-secondary)' }}>📸 @wijaya.edu</li>
            </ul>
          </div>
        </div>
        <div style={{ textAlign: 'center', paddingTop: 30, borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)' }}>
          © {new Date().getFullYear()} TO Wijaya Edu. Dibuat dengan ❤️ untuk Masa Depan Pendidikan Indonesia.
        </div>
      </footer>
    </div>
  );
}

