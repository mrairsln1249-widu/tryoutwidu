import { query, queryOne, insert, update, remove } from '@/lib/db';
import { requireAuth, requireAdmin, jsonError, jsonSuccess } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireAuth(request);
        const subjects = await query(
            'SELECT s.*, u.full_name as creator_name, (SELECT COUNT(*) FROM exams WHERE subject_id = s.id) as exam_count FROM subjects s LEFT JOIN users u ON s.created_by = u.id ORDER BY s.name'
        );
        return jsonSuccess({ subjects });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Forbidden', 403);
        console.error('Subjects GET error:', error);
        return jsonError('Server error', 500);
    }
}

export async function POST(request) {
    try {
        const user = await requireAdmin(request);
        const body = await request.json();
        const { action } = body;

        if (action === 'create') {
            const { name, category, level_class, description, icon } = body;
            const normalizedName = typeof name === 'string' ? name.trim() : '';
            if (!normalizedName) return jsonError('Nama mata pelajaran harus diisi');

            const id = await insert('subjects', {
                name: normalizedName,
                category: category || 'Umum',
                level_class: level_class || null,
                description: description || '',
                icon: icon || '📚',
                created_by: user.id
            });
            return jsonSuccess({ message: 'Mata pelajaran berhasil ditambahkan', id }, 201);
        }

        if (action === 'update') {
            const { id, name, category, level_class, description, icon } = body;
            const subjectId = Number(id);
            const normalizedName = typeof name === 'string' ? name.trim() : '';

            if (!Number.isInteger(subjectId) || subjectId <= 0) {
                return jsonError('ID mata pelajaran tidak valid');
            }
            if (!normalizedName) return jsonError('Nama mata pelajaran harus diisi');

            const affectedRows = await update(
                'subjects',
                {
                    name: normalizedName,
                    category: category || 'Umum',
                    level_class: level_class || null,
                    description: description || '',
                    icon: icon || '📚',
                },
                'id = ?',
                [subjectId]
            );
            if (!affectedRows) return jsonError('Mata pelajaran tidak ditemukan', 404);
            return jsonSuccess({ message: 'Mata pelajaran berhasil diupdate' });
        }

        if (action === 'delete') {
            const subjectId = Number(body.id);
            if (!Number.isInteger(subjectId) || subjectId <= 0) {
                return jsonError('ID mata pelajaran tidak valid');
            }

            const [examUsage, questionUsage, teacherUsage] = await Promise.all([
                queryOne('SELECT COUNT(*) as total FROM exams WHERE subject_id = ?', [subjectId]),
                queryOne('SELECT COUNT(*) as total FROM questions WHERE subject_id = ?', [subjectId]),
                queryOne('SELECT COUNT(*) as total FROM teacher_subjects WHERE subject_id = ?', [subjectId]),
            ]);

            const examCount = Number(examUsage?.total || 0);
            const questionCount = Number(questionUsage?.total || 0);
            const teacherCount = Number(teacherUsage?.total || 0);

            if (examCount > 0 || questionCount > 0 || teacherCount > 0) {
                const blockers = [];
                if (examCount > 0) blockers.push(`${examCount} ujian`);
                if (questionCount > 0) blockers.push(`${questionCount} soal`);
                if (teacherCount > 0) blockers.push(`${teacherCount} assignment guru`);
                return jsonError(`Mata pelajaran tidak bisa dihapus karena masih dipakai di ${blockers.join(', ')}`);
            }

            const affectedRows = await remove('subjects', 'id = ?', [subjectId]);
            if (!affectedRows) return jsonError('Mata pelajaran tidak ditemukan', 404);
            return jsonSuccess({ message: 'Mata pelajaran berhasil dihapus' });
        }

        return jsonError('Invalid action');
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Forbidden', 403);
        console.error('Subjects POST error:', error);
        return jsonError('Server error', 500);
    }
}
