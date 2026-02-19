// ============================================
// TO WIJAYA EDU - ITEM RESPONSE THEORY (IRT)
// 3PL Model: P(θ) = c + (1-c) / (1 + exp(-a(θ-b)))
// ============================================

export function calculateProbability(theta, a, b, c = 0.25) {
    const exponent = -a * (theta - b);
    const expVal = Math.exp(Math.max(-40, Math.min(40, exponent)));
    return c + (1 - c) / (1 + expVal);
}

export function calculateItemInformation(theta, a, b, c = 0.25) {
    const p = calculateProbability(theta, a, b, c);
    const q = 1 - p;
    if (p <= c || q <= 0) return 0;
    return (a * a * Math.pow(p - c, 2) * q) / (Math.pow(1 - c, 2) * p);
}

export function calculateTestInformation(theta, items) {
    return items.reduce((sum, item) => {
        return sum + calculateItemInformation(theta, item.discrimination, item.difficulty, item.guessing);
    }, 0);
}

export function calculateStandardError(theta, items) {
    const info = calculateTestInformation(theta, items);
    return info > 0 ? 1 / Math.sqrt(info) : 999;
}

export function estimateAbilityMLE(responses, items, maxIterations = 100, tolerance = 0.001) {
    let theta = 0;
    for (let iter = 0; iter < maxIterations; iter++) {
        let numerator = 0;
        let denominator = 0;
        for (let i = 0; i < responses.length; i++) {
            const item = items[i];
            const a = item.discrimination || 1;
            const b = item.difficulty || 0;
            const c = item.guessing || 0.25;
            const p = calculateProbability(theta, a, b, c);
            const q = 1 - p;
            const w = (a * (p - c)) / ((1 - c) * p);
            numerator += w * (responses[i] - p);
            denominator += w * w * p * q;
        }
        if (Math.abs(denominator) < 1e-10) break;
        const delta = numerator / denominator;
        theta += delta;
        theta = Math.max(-4, Math.min(4, theta));
        if (Math.abs(delta) < tolerance) break;
    }
    return theta;
}

export function estimateAbilityEAP(responses, items, points = 30) {
    const thetaRange = [];
    for (let i = 0; i < points; i++) {
        thetaRange.push(-4 + (8 * i) / (points - 1));
    }
    let numerator = 0;
    let denominator = 0;
    for (const t of thetaRange) {
        let logLikelihood = 0;
        for (let i = 0; i < responses.length; i++) {
            const item = items[i];
            const p = calculateProbability(t, item.discrimination || 1, item.difficulty || 0, item.guessing || 0.25);
            logLikelihood += responses[i] * Math.log(Math.max(p, 1e-10)) + (1 - responses[i]) * Math.log(Math.max(1 - p, 1e-10));
        }
        const prior = Math.exp(-0.5 * t * t) / Math.sqrt(2 * Math.PI);
        const posterior = Math.exp(logLikelihood) * prior;
        numerator += t * posterior;
        denominator += posterior;
    }
    return denominator > 0 ? numerator / denominator : 0;
}

export function getAbilityPercentile(theta) {
    const z = theta;
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989422804014327;
    const p = d * Math.exp(-z * z / 2) * (0.3193815 * t - 0.3565638 * t * t + 1.781478 * t * t * t - 1.8212560 * t * t * t * t + 1.3302744 * t * t * t * t * t);
    return Math.round(z > 0 ? (1 - p) * 100 : p * 100);
}

export function convertToUTBKScore(theta) {
    return Math.round(Math.max(200, Math.min(800, 500 + theta * 100)));
}

export function getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
}

export function getGradeInfo(grade) {
    const info = {
        A: { label: 'Luar Biasa', color: '#10B981' },
        B: { label: 'Baik', color: '#3B82F6' },
        C: { label: 'Cukup', color: '#F59E0B' },
        D: { label: 'Kurang', color: '#EF4444' },
        E: { label: 'Sangat Kurang', color: '#6B7280' },
    };
    return info[grade] || info.E;
}
