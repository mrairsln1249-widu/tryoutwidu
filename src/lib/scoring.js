export const SCORE_SCALE_STANDARD = { key: 'standard', min: 0, max: 100, label: '0-100' };
export const SCORE_SCALE_UTBK = { key: 'utbk', min: 10, max: 1000, label: '10-1000' };

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

export function resolveScoreScale({ maxScore, passingScore, score } = {}) {
    const parsedMax = toNumber(maxScore);
    const parsedPassing = toNumber(passingScore);
    if ((parsedPassing && parsedPassing > 100) || (parsedMax && parsedMax >= 1000)) {
        return SCORE_SCALE_UTBK;
    }

    if (parsedMax && parsedMax <= 100) return SCORE_SCALE_STANDARD;

    const parsedScore = toNumber(score);
    if (parsedScore && parsedScore > 100) return SCORE_SCALE_UTBK;

    return SCORE_SCALE_STANDARD;
}

export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function scaleRawPercentageToScore(percentage, scale = SCORE_SCALE_STANDARD) {
    const pct = clamp(toNumber(percentage) || 0, 0, 100);
    const raw = scale.min + (pct / 100) * (scale.max - scale.min);
    return Math.round(raw * 10) / 10;
}

export function scoreToPercentage(score, scale = SCORE_SCALE_STANDARD) {
    const value = toNumber(score) || 0;
    const span = scale.max - scale.min;
    if (span <= 0) return 0;
    const pct = ((value - scale.min) / span) * 100;
    return clamp(pct, 0, 100);
}

export function gradeFromPercentage(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'E';
}

export function gradeFromScore(score, scale = SCORE_SCALE_STANDARD) {
    return gradeFromPercentage(scoreToPercentage(score, scale));
}
