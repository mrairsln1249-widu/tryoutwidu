import { query } from '@/lib/db';
import { jsonError, jsonSuccess } from '@/lib/auth';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const subjectId = searchParams.get('subject_id');
        const limit = parseInt(searchParams.get('limit') || '50');

        let whereClause = "ea.status = 'completed'";
        let params = [];

        if (subjectId) {
            whereClause += ' AND e.subject_id = ?';
            params.push(subjectId);
        }

        const leaderboard = await query(
            `SELECT u.id, u.full_name, u.school, u.grade,
              COUNT(ea.id) as total_exams,
              ROUND(AVG(ea.score), 1) as avg_score,
              MAX(ea.score) as best_score,
              ROUND(AVG(ea.ability_score), 3) as avg_ability,
              MAX(ea.percentile) as best_percentile
       FROM users u
       JOIN exam_attempts ea ON u.id = ea.user_id
       JOIN exams e ON ea.exam_id = e.id
       WHERE u.role = 'student' AND ${whereClause}
       GROUP BY u.id
       ORDER BY avg_score DESC, total_exams DESC
       LIMIT ?`,
            [...params, limit]
        );

        // Calculate Rank Movement (Compare with 24h ago)
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);

        const prevLeaderboard = await query(
            `SELECT u.id, ROUND(AVG(ea.score), 1) as avg_score, COUNT(ea.id) as total_exams
       FROM users u
       JOIN exam_attempts ea ON u.id = ea.user_id
       JOIN exams e ON ea.exam_id = e.id
       WHERE u.role = 'student' AND ${whereClause} AND ea.end_time < ?
       GROUP BY u.id
       ORDER BY avg_score DESC, total_exams DESC`,
            [...params, yesterdayDate]
        );

        const prevRankMap = new Map();
        prevLeaderboard.forEach((lb, index) => {
            prevRankMap.set(lb.id, index + 1);
        });

        const leaderboardWithTrend = leaderboard.map((lb, index) => {
            const currentRank = index + 1;
            const prevRank = prevRankMap.get(lb.id);
            let movement = 0; // 0 = stable/new, >0 = up, <0 = down

            if (prevRank) {
                movement = prevRank - currentRank;
            }

            return { ...lb, rank_movement: movement };
        });

        return jsonSuccess({ leaderboard: leaderboardWithTrend });
    } catch (error) {
        console.error('Leaderboard error:', error);
        return jsonError('Server error', 500);
    }
}
