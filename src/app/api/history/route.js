import { query } from '@/lib/db';
import { requireAuth, jsonError, jsonSuccess } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = 20;
        const offset = (page - 1) * limit;

        const history = await query(
            `SELECT ea.*, e.title, e.duration, e.total_questions, e.passing_score, e.max_score,
              s.name as subject_name, s.icon as subject_icon, s.category
       FROM exam_attempts ea
       JOIN exams e ON ea.exam_id = e.id
       JOIN subjects s ON e.subject_id = s.id
       WHERE ea.user_id = ? AND ea.status = 'completed'
       ORDER BY ea.end_time DESC
       LIMIT ? OFFSET ?`,
            [user.id, limit, offset]
        );

        const countResult = await query(
            `SELECT COUNT(*) as total FROM exam_attempts WHERE user_id = ? AND status = 'completed'`,
            [user.id]
        );

        return jsonSuccess({
            history,
            total: countResult[0]?.total || 0,
            page,
            limit
        });
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        console.error('History error:', error);
        return jsonError('Server error', 500);
    }
}
