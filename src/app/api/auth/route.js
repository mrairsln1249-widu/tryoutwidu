import { query, queryOne, insert } from '@/lib/db';
import { comparePassword, hashPassword, createToken, jsonError, jsonSuccess } from '@/lib/auth';

export async function POST(request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'login') {
            return handleLogin(body);
        } else if (action === 'subjects_public') {
            const subjects = await query('SELECT id, name FROM subjects ORDER BY name');
            return jsonSuccess({ subjects });
        } else if (action === 'register') {
            return handleRegister(body);
        }

        return jsonError('Invalid action', 400);
    } catch (error) {
        console.error('Auth error:', error);
        return jsonError('Terjadi kesalahan sistem', 500);
    }
}

async function handleLogin({ username, password }) {
    if (!username || !password) {
        return jsonError('Username dan password harus diisi');
    }

    const user = await queryOne(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username, username]
    );

    if (!user || !comparePassword(password, user.password)) {
        return jsonError('Username/Email atau password salah!');
    }

    if (user.role === 'student' && !user.is_verified) {
        return jsonError('Akun Anda belum diverifikasi oleh admin. Silakan tunggu atau hubungi admin.');
    }

    let assignedSubjects = [];
    if (user.role === 'teacher') {
        const subs = await query(
            'SELECT s.id, s.name FROM subjects s JOIN teacher_subjects ts ON s.id = ts.subject_id WHERE ts.teacher_id = ?',
            [user.id]
        );
        assignedSubjects = subs;
    }

    const token = createToken(user);

    const response = jsonSuccess({
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            school: user.school,
            grade: user.grade,
            category: user.category,
            phone: user.phone,
            assigned_subjects: assignedSubjects,
        },
        message: 'Login berhasil!',
    });

    response.headers.set('Set-Cookie', `token=${token}; Path=/; HttpOnly; Max-Age=86400; SameSite=Lax`);
    return response;
}

async function handleRegister({ username, email, phone, password, confirm_password, full_name, school, grade, category, role, subjects }) {
    const errors = [];

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        errors.push('Username hanya boleh huruf, angka, dan underscore (3-20 karakter)');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Format email tidak valid');
    }
    if (!password || password.length < 6 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        errors.push('Password minimal 6 karakter dan mengandung huruf dan angka');
    }
    if (password !== confirm_password) {
        errors.push('Konfirmasi password tidak cocok');
    }
    if (!full_name) errors.push('Nama lengkap harus diisi');
    if (!phone) errors.push('No. HP/WhatsApp harus diisi');
    if (!school) errors.push('Asal sekolah/instansi harus diisi');
    if (role === 'student' && !grade) errors.push('Kelas harus dipilih');
    if (role === 'teacher' && (!Array.isArray(subjects) || subjects.length === 0)) {
        errors.push('Pilih minimal 1 mata pelajaran yang diampu');
    }

    if (errors.length > 0) {
        return jsonError(errors.join('. '));
    }

    const existingUser = await queryOne('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
        return jsonError('Username sudah digunakan');
    }

    const existingEmail = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail) {
        return jsonError('Email sudah terdaftar');
    }

    const hashedPassword = hashPassword(password);
    const userId = await insert('users', {
        username,
        email,
        phone: phone || '',
        password: hashedPassword,
        full_name,
        school,
        grade: grade || '',
        category: category || 'SMA',
        role: role === 'teacher' ? 'teacher' : 'student',
        is_verified: 0,
    });

    if (role === 'teacher' && Array.isArray(subjects)) {
        const subIds = subjects.slice(0, 3);
        for (const subId of subIds) {
            await insert('teacher_subjects', { teacher_id: userId, subject_id: subId });
        }
    }

    await insert('verification_requests', {
        user_id: userId,
        status: 'pending',
    });

    return jsonSuccess({
        message: 'Pendaftaran berhasil! Akun Anda akan diverifikasi oleh admin.',
        user_id: userId,
    }, 201);
}
