import { query, queryOne, insert, update, remove } from '@/lib/db';
import { requireAuth, requireAdmin, jsonError, jsonSuccess, hashPassword } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'profile') {
            return jsonSuccess({ user });
        }

        if (action === 'list') {
            await requireAdmin(request);
            const search = searchParams.get('search') || '';

            let where = '1=1';
            let params = [];
            if (search) {
                where = '(username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
                params = [`%${search}%`, `%${search}%`, `%${search}%`];
            }

            const users = await query(
                `SELECT id, username, email, full_name, school, grade, role, is_verified, created_at 
                 FROM users WHERE ${where} ORDER BY created_at DESC`,
                params
            );

            // Fetch teacher subjects for each user
            for (let u of users) {
                if (u.role === 'teacher') {
                    const subjects = await query(
                        'SELECT s.id, s.name FROM subjects s JOIN teacher_subjects ts ON s.id = ts.subject_id WHERE ts.teacher_id = ?',
                        [u.id]
                    );
                    u.assigned_subjects = subjects;
                }
            }

            return jsonSuccess({ users });
        }

        if (action === 'pending') {
            await requireAdmin(request);
            const pending = await query(
                `SELECT u.id, u.username, u.email, u.full_name, u.school, u.grade, u.created_at, 
                vr.id as request_id, vr.status, vr.created_at as request_date
         FROM users u 
         JOIN verification_requests vr ON u.id = vr.user_id 
         WHERE vr.status = 'pending' 
         ORDER BY vr.created_at DESC`
            );
            return jsonSuccess({ pending });
        }

        return jsonSuccess({ user });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Forbidden', 403);
        console.error('Users GET error:', error);
        return jsonError('Server error', 500);
    }
}

export async function POST(request) {
    try {
        const user = await requireAuth(request);
        const body = await request.json();
        const { action } = body;

        if (action === 'update_profile') {
            const allowedFields = ['full_name', 'school', 'grade', 'category', 'phone', 'email'];
            const updateData = {};
            for (const field of allowedFields) {
                if (body[field]) updateData[field] = body[field];
            }
            if (Object.keys(updateData).length === 0) {
                return jsonError('Tidak ada data yang diupdate');
            }
            if (updateData.email) {
                const existing = await queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [updateData.email, user.id]);
                if (existing) return jsonError('Email sudah digunakan');
            }
            await update('users', updateData, 'id = ?', [user.id]);
            return jsonSuccess({ message: 'Profil berhasil diperbarui' });
        }

        if (action === 'change_password') {
            const currentUser = await queryOne('SELECT password FROM users WHERE id = ?', [user.id]);
            if (!comparePassword(body.old_password, currentUser.password)) {
                return jsonError('Password lama salah');
            }
            if (!body.new_password || body.new_password.length < 6) {
                return jsonError('Password minimal 6 karakter');
            }
            await update('users', { password: hashPassword(body.new_password) }, 'id = ?', [user.id]);
            return jsonSuccess({ message: 'Password berhasil diubah' });
        }

        if (action === 'verify') {
            await requireAdmin(request);
            const { user_id, status } = body;
            if (status === 'approved') {
                await update('users', { is_verified: 1 }, 'id = ?', [user_id]);
                await update('verification_requests',
                    { status: 'approved', reviewed_by: user.id },
                    'user_id = ? AND status = ?', [user_id, 'pending']
                );
            } else {
                await update('verification_requests',
                    { status: 'rejected', reviewed_by: user.id, notes: body.reason || '' },
                    'user_id = ? AND status = ?', [user_id, 'pending']
                );
                await remove('users', 'id = ? AND role = ?', [user_id, 'student']);
            }
            return jsonSuccess({ message: status === 'approved' ? 'User diverifikasi' : 'User ditolak' });
        }

        if (action === 'delete') {
            await requireAdmin(request);
            await remove('users', 'id = ? AND role != ?', [body.user_id, 'admin']);
            return jsonSuccess({ message: 'User dihapus' });
        }

        if (action === 'create_user') {
            await requireAdmin(request);
            const { username, email, password, full_name, school, grade, role, subjects } = body;

            if (!username || !email || !password || !full_name || !role) {
                return jsonError('Data tidak lengkap');
            }

            const existing = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
            if (existing) return jsonError('Username atau Email sudah digunakan');

            const userId = await insert('users', {
                username, email, password: hashPassword(password),
                full_name, school: school || '', grade: grade || '',
                role, is_verified: 1
            });

            if (role === 'teacher' && Array.isArray(subjects)) {
                const subIds = subjects.slice(0, 3);
                for (const subId of subIds) {
                    await insert('teacher_subjects', { teacher_id: userId, subject_id: subId });
                }
            }

            return jsonSuccess({ message: 'User berhasil dibuat', id: userId });
        }

        if (action === 'update_user') {
            await requireAdmin(request);
            const { id, username, email, full_name, school, grade, role, subjects } = body;

            const existing = await queryOne('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, id]);
            if (existing) return jsonError('Username atau Email sudah digunakan');

            const updateData = { username, email, full_name, school, grade, role };
            if (body.password) updateData.password = hashPassword(body.password);

            await update('users', updateData, 'id = ?', [id]);

            if (role === 'teacher' && Array.isArray(subjects)) {
                await remove('teacher_subjects', 'teacher_id = ?', [id]);
                const subIds = subjects.slice(0, 3);
                for (const subId of subIds) {
                    await insert('teacher_subjects', { teacher_id: id, subject_id: subId });
                }
            } else if (role !== 'teacher') {
                await remove('teacher_subjects', 'teacher_id = ?', [id]);
            }

            return jsonSuccess({ message: 'User berhasil diperbarui' });
        }

        return jsonError('Invalid action');
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Forbidden', 403);
        console.error('Users POST error:', error);
        return jsonError('Server error', 500);
    }
}
