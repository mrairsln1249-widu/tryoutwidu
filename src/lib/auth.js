import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { queryOne } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'to-wijaya-edu-secret';

export function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            full_name: user.full_name,
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

export function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

export function comparePassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

export function getTokenFromRequest(request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    const cookie = request.headers.get('cookie');
    if (cookie) {
        const match = cookie.match(/token=([^;]+)/);
        if (match) return match[1];
    }
    return null;
}

export async function getCurrentUser(request) {
    const token = getTokenFromRequest(request);
    if (!token) return null;
    const decoded = verifyToken(token);
    if (!decoded) return null;
    const user = await queryOne(
        'SELECT id, username, email, full_name, school, grade, role, is_verified, created_at FROM users WHERE id = ?',
        [decoded.id]
    );
    return user;
}

export async function requireAuth(request) {
    const user = await getCurrentUser(request);
    if (!user) {
        throw new Error('UNAUTHORIZED');
    }
    return user;
}

export async function requireAdmin(request) {
    const user = await requireAuth(request);
    if (user.role !== 'admin') {
        throw new Error('FORBIDDEN');
    }
    return user;
}

export async function requireTeacher(request) {
    const user = await requireAuth(request);
    if (user.role !== 'teacher' && user.role !== 'admin') {
        throw new Error('FORBIDDEN');
    }
    return user;
}

export async function requireStaff(request) {
    const user = await requireAuth(request);
    if (user.role !== 'admin' && user.role !== 'teacher') {
        throw new Error('FORBIDDEN');
    }
    return user;
}

export function jsonError(message, status = 400) {
    return Response.json({ success: false, message }, { status });
}

export function jsonSuccess(data, status = 200) {
    return Response.json({ success: true, ...data }, { status });
}
