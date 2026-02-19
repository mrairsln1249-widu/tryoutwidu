import { query, queryOne } from '@/lib/db';
import { requireAuth, requireAdmin, jsonError, jsonSuccess } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'student') {
            const user = await requireAuth(request);
            const totalExams = await queryOne(
                `SELECT COUNT(*) as total FROM exam_attempts WHERE user_id = ? AND status = 'completed'`, [user.id]
            );
            const avgScore = await queryOne(
                `SELECT ROUND(AVG(score), 1) as avg_score FROM exam_attempts WHERE user_id = ? AND status = 'completed'`, [user.id]
            );
            const recentAttempts = await query(
                `SELECT ea.*, e.title, e.passing_score, e.max_score, s.name as subject_name, s.icon as subject_icon
         FROM exam_attempts ea JOIN exams e ON ea.exam_id = e.id JOIN subjects s ON e.subject_id = s.id
         WHERE ea.user_id = ? AND ea.status = 'completed' ORDER BY ea.end_time DESC LIMIT 5`, [user.id]
            );
            const availableExams = await query(
                `SELECT e.*, s.name as subject_name, s.icon as subject_icon,
                (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
         FROM exams e JOIN subjects s ON e.subject_id = s.id 
         WHERE e.is_active = 1 AND (s.category = ? OR s.category = 'All')
         ORDER BY e.created_at DESC LIMIT 6`, [user.category || 'SMA']
            );

            const rank = await queryOne(
                `SELECT COUNT(*) + 1 as rank FROM (
           SELECT user_id, AVG(score) as avg FROM exam_attempts WHERE status = 'completed' GROUP BY user_id
           HAVING avg > COALESCE((SELECT AVG(score) FROM exam_attempts WHERE user_id = ? AND status = 'completed'), 0)
         ) as r`, [user.id]
            );

            return jsonSuccess({
                stats: {
                    total_exams: totalExams?.total || 0,
                    avg_score: avgScore?.avg_score || 0,
                    rank: rank?.rank || '-',
                },
                recentAttempts,
                availableExams,
            });
        }

        if (action === 'admin') {
            await requireAdmin(request);
            const totalUsers = await queryOne('SELECT COUNT(*) as total FROM users WHERE role = ?', ['student']);
            const totalExams = await queryOne('SELECT COUNT(*) as total FROM exams');
            const totalQuestions = await queryOne('SELECT COUNT(*) as total FROM questions');
            const totalAttempts = await queryOne(`SELECT COUNT(*) as total FROM exam_attempts WHERE status = 'completed'`);
            const pendingVerifications = await queryOne(`SELECT COUNT(*) as total FROM verification_requests WHERE status = 'pending'`);
            const avgScore = await queryOne(`SELECT ROUND(AVG(score), 1) as avg FROM exam_attempts WHERE status = 'completed'`);

            const recentAttempts = await query(
                `SELECT ea.score, ea.end_time, u.full_name, e.title
         FROM exam_attempts ea JOIN users u ON ea.user_id = u.id JOIN exams e ON ea.exam_id = e.id
         WHERE ea.status = 'completed' ORDER BY ea.end_time DESC LIMIT 10`
            );

            const subjectStats = await query(
                `SELECT s.name, s.icon, COUNT(ea.id) as attempts, ROUND(AVG(ea.score), 1) as avg_score
         FROM subjects s LEFT JOIN exams e ON s.id = e.subject_id
         LEFT JOIN exam_attempts ea ON e.id = ea.exam_id AND ea.status = 'completed'
         GROUP BY s.id ORDER BY attempts DESC LIMIT 8`
            );

            return jsonSuccess({
                stats: {
                    total_users: totalUsers?.total || 0,
                    total_exams: totalExams?.total || 0,
                    total_questions: totalQuestions?.total || 0,
                    total_attempts: totalAttempts?.total || 0,
                    pending_verifications: pendingVerifications?.total || 0,
                    avg_score: avgScore?.avg || 0,
                },
                recentAttempts,
                subjectStats,
            });
        }

        return jsonError('Invalid action');
    } catch (error) {
        if (error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
        if (error.message === 'FORBIDDEN') return jsonError('Forbidden', 403);
        console.error('Dashboard error:', error);
        return jsonError('Server error', 500);
    }
}
