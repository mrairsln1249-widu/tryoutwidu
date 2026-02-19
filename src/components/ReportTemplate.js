'use client';
import { forwardRef } from 'react';
import { RichContentDisplay } from '@/components/RichTextEditor';
import { gradeFromScore, resolveScoreScale, scoreToPercentage } from '@/lib/scoring';

const MAX_ROWS_IN_PDF_BY_MODE = {
    summary: 18,
    answers_only: 26,
    answers_with_explanations: 12,
};

function formatScore(value) {
    const num = Number(value || 0);
    return Number.isInteger(num) ? String(num) : num.toFixed(1);
}

function formatDateLabel(value) {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function buildTrendPoints(trend, fallbackAttempt) {
    const source = Array.isArray(trend) && trend.length
        ? trend
        : [{
            attempt_id: fallbackAttempt.id,
            score: fallbackAttempt.score,
            end_time: fallbackAttempt.end_time || fallbackAttempt.created_at,
            passing_score: fallbackAttempt.passing_score,
            max_score: fallbackAttempt.max_score,
        }];

    return source.slice(-6).map((item) => {
        const rawScore = Number(item.score || 0);
        const scale = resolveScoreScale({
            maxScore: item.max_score,
            passingScore: item.passing_score,
            score: rawScore,
        });
        return {
            attempt_id: item.attempt_id,
            score: rawScore,
            label: formatDateLabel(item.end_time),
            percent: scoreToPercentage(rawScore, scale),
        };
    });
}

const ReportTemplate = forwardRef(({ data, user, options = {} }, ref) => {
    if (!data) return null;
    const { attempt, answers = [], trend = [] } = data;
    const answerMode = ['summary', 'answers_only', 'answers_with_explanations'].includes(options.answerMode)
        ? options.answerMode
        : 'summary';

    const score = Number(attempt.score || 0);
    const scoreScale = resolveScoreScale({
        maxScore: attempt.score_max || attempt.max_score,
        passingScore: attempt.passing_score,
        score,
    });
    const grade = gradeFromScore(score, scoreScale);
    const passed = score >= Number(attempt.passing_score || 60);
    const scorePct = scoreToPercentage(score, scoreScale);
    const correct = answers.filter((a) => a.is_correct).length;
    const total = answers.length;
    const wrong = total - correct;
    const correctPct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const wrongPct = total > 0 ? Math.round((wrong / total) * 100) : 0;

    const trendPoints = buildTrendPoints(trend, attempt);
    const chartW = 700;
    const chartH = 190;
    const padX = 42;
    const padY = 22;
    const innerW = chartW - padX * 2;
    const innerH = chartH - padY * 2;
    const pointsWithCoord = trendPoints.map((point, index) => {
        const ratio = trendPoints.length > 1 ? index / (trendPoints.length - 1) : 0.5;
        const x = padX + ratio * innerW;
        const y = padY + (1 - (point.percent / 100)) * innerH;
        return { ...point, x, y };
    });
    const linePoints = pointsWithCoord.map((p) => `${p.x},${p.y}`).join(' ');
    const areaPath = pointsWithCoord.length > 1
        ? `M ${pointsWithCoord[0].x} ${padY + innerH} L ${linePoints.replace(/,/g, ' ')} L ${pointsWithCoord[pointsWithCoord.length - 1].x} ${padY + innerH} Z`
        : '';
    const trendDelta = pointsWithCoord.length > 1
        ? pointsWithCoord[pointsWithCoord.length - 1].percent - pointsWithCoord[0].percent
        : 0;

    const date = new Date().toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const userName = user?.full_name || 'Peserta Ujian';
    const userGrade = user?.grade || '-';
    const userSchool = user?.school || '-';

    const maxRows = MAX_ROWS_IN_PDF_BY_MODE[answerMode] || MAX_ROWS_IN_PDF_BY_MODE.summary;
    const pdfRows = answers.slice(0, maxRows);
    const hiddenRows = Math.max(0, answers.length - pdfRows.length);

    return (
        <div
            ref={ref}
            style={{
                width: '210mm',
                minHeight: '297mm',
                background: '#ffffff',
                color: '#0f172a',
                padding: '34px',
                fontFamily: '"Segoe UI", Arial, sans-serif',
                boxSizing: 'border-box',
                position: 'relative',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #0f172a',
                    paddingBottom: '18px',
                    marginBottom: '26px',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="TO Wijaya Edu" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '0.2px' }}>TO Wijaya Edu</h1>
                        <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Premium Computer Based Testing</p>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.8px' }}>REPORT CARD</div>
                    <div style={{ fontSize: 14, fontWeight: 700, maxWidth: 330 }}>{attempt.title}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{date}</div>
                </div>
            </div>

            <div
                style={{
                    background: '#f8fafc',
                    padding: '18px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '24px',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                }}
            >
                <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Nama Siswa</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{userName}</div>
                </div>
                <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Kelas / Sekolah</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{userGrade} - {userSchool}</div>
                </div>
                <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Mata Pelajaran</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{attempt.subject_name}</div>
                </div>
                <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Waktu Pengerjaan</div>
                    <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {new Date(attempt.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -
                        {attempt.end_time ? new Date(attempt.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </div>
                </div>
            </div>

            <div
                style={{
                    marginBottom: '22px',
                    padding: '18px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    background: passed ? '#f0fdf4' : '#fff7ed',
                }}
            >
                <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Hasil Akhir</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                    <div>
                        <div style={{ fontSize: '74px', fontWeight: 900, color: passed ? '#059669' : '#dc2626', lineHeight: 1 }}>
                            {formatScore(score)}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>TOTAL SKOR</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Skala {scoreScale.min}-{scoreScale.max} | Akurasi {Math.round(scorePct)}%</div>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', rowGap: '8px', fontSize: 14 }}>
                            <span style={{ color: '#64748b' }}>Grade</span>
                            <strong>{grade}</strong>
                            <span style={{ color: '#64748b' }}>Status</span>
                            <span
                                style={{
                                    width: 'fit-content',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    background: passed ? '#d1fae5' : '#fee2e2',
                                    color: passed ? '#047857' : '#b91c1c',
                                }}
                            >
                                {passed ? 'LULUS' : 'TIDAK LULUS'}
                            </span>
                            <span style={{ color: '#64748b' }}>Persentil</span>
                            <strong>{attempt.percentile ? `Top ${100 - attempt.percentile}%` : '-'}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 10px 0' }}>Grafik Perkembangan</h3>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', background: '#f8fafc' }}>
                    <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
                        <defs>
                            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>
                        {[0, 25, 50, 75, 100].map((v) => (
                            <g key={v}>
                                <line
                                    x1={padX}
                                    x2={padX + innerW}
                                    y1={padY + (1 - v / 100) * innerH}
                                    y2={padY + (1 - v / 100) * innerH}
                                    stroke="#dbeafe"
                                    strokeWidth="1"
                                />
                                <text x={8} y={padY + (1 - v / 100) * innerH + 4} fontSize="10" fill="#64748b">{v}%</text>
                            </g>
                        ))}

                        {pointsWithCoord.length > 1 && (
                            <>
                                <path d={areaPath} fill="url(#trendFill)" />
                                <polyline fill="none" stroke="#0284c7" strokeWidth="3" points={linePoints} />
                            </>
                        )}

                        {pointsWithCoord.length === 1 && (
                            <circle cx={pointsWithCoord[0].x} cy={pointsWithCoord[0].y} r="4.5" fill="#0284c7" />
                        )}

                        {pointsWithCoord.map((point) => (
                            <g key={point.attempt_id || point.label}>
                                <circle cx={point.x} cy={point.y} r="4.2" fill="#ffffff" stroke="#0284c7" strokeWidth="2" />
                                <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fill="#0f172a">
                                    {formatScore(point.score)}
                                </text>
                                <text x={point.x} y={chartH - 6} textAnchor="middle" fontSize="10" fill="#64748b">
                                    {point.label}
                                </text>
                            </g>
                        ))}
                    </svg>
                    <div style={{ marginTop: 6, fontSize: 12, color: trendDelta >= 0 ? '#047857' : '#b91c1c' }}>
                        {pointsWithCoord.length > 1
                            ? `Tren ${trendDelta >= 0 ? 'naik' : 'turun'} ${Math.abs(Math.round(trendDelta))}% dibanding attempt awal.`
                            : 'Belum ada data tren yang cukup, grafik akan terisi setelah beberapa attempt.'}
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '22px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '12px' }}>
                    Analisis Jawaban
                </h3>
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Benar ({correct})</span>
                        <span>{correctPct}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${correctPct}%`, background: '#10b981' }} />
                    </div>
                </div>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span>Salah ({wrong})</span>
                        <span>{wrongPct}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${wrongPct}%`, background: '#ef4444' }} />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '10px' }}>
                    {answerMode === 'summary'
                        ? 'Ringkasan Jawaban'
                        : answerMode === 'answers_only'
                            ? 'Detail Jawaban'
                            : 'Detail Jawaban dan Pembahasan'}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', color: '#64748b' }}>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>No</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Pertanyaan</th>
                            <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Kunci</th>
                            <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Jawaban</th>
                            <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
                            {answerMode === 'answers_with_explanations' && (
                                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Pembahasan</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {pdfRows.map((a, i) => {
                            let correctDisplay = a.correct_answer;
                            let selectedDisplay = a.selected_answer || '-';

                            if (a.question_type === 'true_false') {
                                correctDisplay = a.correct_answer === 'A' ? 'Benar' : 'Salah';
                                selectedDisplay = a.selected_answer === 'A' ? 'Benar' : a.selected_answer === 'B' ? 'Salah' : '-';
                            } else if (a.question_type === 'essay') {
                                correctDisplay = '(Uraian)';
                                selectedDisplay = a.selected_answer ? '(Telah diisi)' : '-';
                            }

                            return (
                                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '8px', color: '#64748b' }}>{i + 1}</td>
                                    <td style={{ padding: '8px', maxWidth: answerMode === 'answers_with_explanations' ? '260px' : '340px' }}>
                                        <div style={{ maxHeight: answerMode === 'summary' ? '80px' : '300px', overflowY: 'auto' }}>
                                            <RichContentDisplay content={a.question_text} />
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600 }}>{correctDisplay}</td>
                                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: a.is_correct ? '#10b981' : '#ef4444' }}>
                                        {selectedDisplay}
                                    </td>
                                    <td style={{ padding: '8px', textAlign: 'center', color: a.is_correct ? '#10b981' : '#ef4444' }}>
                                        {a.is_correct ? 'Benar' : a.question_type === 'essay' ? 'Review' : 'Salah'}
                                    </td>
                                    {answerMode === 'answers_with_explanations' && (
                                        <td style={{ padding: '8px', maxWidth: '260px', color: '#334155' }}>
                                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {a.explanation ? <RichContentDisplay content={a.explanation} /> : '-'}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {hiddenRows > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
                        {hiddenRows} soal tambahan tidak ditampilkan di PDF untuk menjaga ukuran file tetap ringan.
                    </div>
                )}
            </div>

            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    borderTop: '2px solid #e2e8f0',
                    paddingTop: '16px',
                }}
            >
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                    Dicetak otomatis oleh sistem TO Wijaya Edu pada {date}.<br />
                    Validasi dokumen ID: {attempt.id}
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, borderTop: '1px solid #0f172a', paddingTop: '4px', width: '150px' }}>
                        Administrator
                    </div>
                </div>
            </div>
        </div>
    );
});

ReportTemplate.displayName = 'ReportTemplate';
export default ReportTemplate;
