const API_BASE = '/api';

function getToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

export function setToken(token) {
    localStorage.setItem('token', token);
}

export function removeToken() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

export function getUser() {
    if (typeof window === 'undefined') return null;
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
}

export function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

export async function api(endpoint, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await res.json();

    if (res.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
            window.location.href = '/';
        }
    }

    return data;
}

export async function apiGet(endpoint) {
    return api(endpoint, { method: 'GET' });
}

export async function apiPost(endpoint, body) {
    return api(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
