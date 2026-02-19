'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import AppLayout from '@/components/AppLayout';
import { apiGet, getUser } from '@/lib/api';
import ReportTemplate from '@/components/ReportTemplate';
import { RichContentDisplay } from '@/components/RichTextEditor';
import { gradeFromScore, resolveScoreScale, scoreToPercentage } from '@/lib/scoring';

const Radar = dynamic(() => import('react-chartjs-2').then((mod) => mod.Radar), { ssr: false });

const PDF_QUALITY_PRESETS = {
    low: { scale: 1.1, jpegQuality: 0.65, windowWidth: 980 },
    medium: { scale: 1.35, jpegQuality: 0.8, windowWidth: 1080 },
    high: { scale: 1.75, jpegQuality: 0.9, windowWidth: 1200 },
};

export default function ExamResultPage() {
    const { id } = useParams();
    const searchParams = useSearchParams();
    const attemptId = searchParams.get('attempt');
    const router = useRouter();
    const [data, setData] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [showAnswers, setShowAnswers] = useState(false);
    const [reviewMode, setReviewMode] = useState('answers_with_explanations');
    const [pdfQuality, setPdfQuality] = useState('medium');
    const [pdfAnswerMode, setPdfAnswerMode] = useState('summary');
    const [chartReady, setChartReady] = useState(false);
    const reportRef = useRef(null);

    useEffect(() => {
        const loadResult = async () => {
            const res = await apiGet(`/exams?action=result&attempt_id=${attemptId}`);
            if (res.success) setData(res);
            setLoading(false);
        };
        loadResult();
        const u = getUser();
        if (u) setUser(u);
    }, [attemptId]);

    useEffect(() => {
        let active = true;

        const registerChart = async () => {
            const {
                Chart: ChartJS,
                RadialLinearScale,
                PointElement,
                LineElement,
                Filler,
                Tooltip,
                Legend,
            } = await import('chart.js');

            ChartJS.register(
                RadialLinearScale,
                PointElement,
                LineElement,
                Filler,
                Tooltip,
                Legend
            );

            if (active) setChartReady(true);
        };

        registerChart();
        return () => { active = false; };
    }, []);

    const handleDownloadPDF = async () => {
        if (!reportRef.current) {
            alert('Template laporan belum dimuat. Mohon tunggu sebentar.');
            return;
        }
        setDownloading(true);
        try {
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import('html2canvas'),
                import('jspdf'),
            ]);
            const quality = PDF_QUALITY_PRESETS[pdfQuality] || PDF_QUALITY_PRESETS.medium;
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(reportRef.current, {
                scale: quality.scale,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: quality.windowWidth,
            });

            const imgData = canvas.toDataURL('image/jpeg', quality.jpegQuality);
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const scaledImgHeight = (imgHeight * pdfWidth) / imgWidth;

            let renderedHeight = 0;
            while (renderedHeight < scaledImgHeight) {
                if (renderedHeight > 0) pdf.addPage();
                const yOffset = -renderedHeight;
                pdf.addImage(imgData, 'JPEG', 0, yOffset, pdfWidth, scaledImgHeight, undefined, 'FAST');
                renderedHeight += pageHeight;
            }
            pdf.save(`TO-Wijaya-Edu_Report_${data.attempt.title}.pdf`);
        } catch (error) {
            console.error('PDF generation failed', error);
            alert(`Gagal mengunduh laporan PDF: ${error.message}`);
        } finally {
            setDownloading(false);
        }
    };

    const getGradeLabel = (grade) => ({
        A: 'Luar Biasa',
        B: 'Sangat Baik',
        C: 'Cukup Baik',
        D: 'Perlu Belajar Lagi',
        E: 'Tingkatkan Belajar',
    }[grade] || 'Tingkatkan Belajar');

    const getGradeColor = (grade) => ({
        A: 'var(--green)',
        B: 'var(--blue)',
        C: 'var(--yellow)',
        D: 'var(--red)',
        E: 'var(--text-muted)',
    }[grade] || 'var(--text-muted)');

    const formatScore = (value) => {
        const num = Number(value || 0);
        return Number.isInteger(num) ? String(num) : num.toFixed(1);
    };

    if (loading) return <AppLayout><div className="loading-page"><div className="spinner" /></div></AppLayout>;
    if (!data) return <AppLayout><div className="card"><p>Hasil tidak ditemukan.</p></div></AppLayout>;

    const { attempt, answers } = data;
    const score = Number(attempt.score || 0);
    const scoreScale = resolveScoreScale({
        maxScore: attempt.score_max || attempt.max_score,
        passingScore: attempt.passing_score,
        score,
    });
    const grade = gradeFromScore(score, scoreScale);
    const accuracyPct = scoreToPercentage(score, scoreScale);
    const correct = answers?.filter(a => a.is_correct).length || 0;
    const total = answers?.length || 0;
    const passed = score >= Number(attempt.passing_score || 60);
    const progressPct = total > 0 ? (correct / total) * 100 : 0;

    // Subject-Wise Analysis (Topic-Based)
    const topicAnalysis = {};
    answers?.forEach(ans => {
        const topic = ans.topic || 'Lainnya';
        if (!topicAnalysis[topic]) {
            topicAnalysis[topic] = { total: 0, correct: 0 };
        }
        topicAnalysis[topic].total += 1;
        if (ans.is_correct) topicAnalysis[topic].correct += 1;
    });

    const topicLabels = Object.keys(topicAnalysis);
    const topicScores = topicLabels.map(t => Math.round((topicAnalysis[t].correct / topicAnalysis[t].total) * 100));

    const radarData = {
        labels: topicLabels,
        datasets: [
            {
                label: 'Penguasaan Materi (%)',
                data: topicScores,
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                borderColor: 'rgba(56, 189, 248, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(56, 189, 248, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(56, 189, 248, 1)',
            },
        ],
    };

    const radarOptions = {
        scales: {
            r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { color: 'var(--text-primary)', font: { size: 12, weight: 'bold' } },
                ticks: { backdropColor: 'transparent', color: 'var(--text-muted)', stepSize: 20 },
                suggestedMin: 0,
                suggestedMax: 100
            }
        },
        plugins: {
            legend: { display: false }
        }
    };

    return (
        <AppLayout>
            <div className="fade-in">
                <div style={{ position: 'absolute', top: 0, left: -9999, zIndex: -100, overflow: 'hidden', height: 0 }}>
                    <div style={{ position: 'relative' }}>
                        <ReportTemplate ref={reportRef} data={data} user={user} options={{ answerMode: pdfAnswerMode }} />
                    </div>
                </div>

                <div className="topbar">
                    <div>
                        <h1>Hasil Ujian</h1>
                        <div className="topbar-sub">{attempt.title} - {attempt.subject_name}</div>
                    </div>
                    <div className="result-topbar-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/history')}>Riwayat</button>
                        <button className="btn btn-success btn-sm" onClick={handleDownloadPDF} disabled={downloading}>
                            {downloading ? 'Generating...' : 'Download PDF'}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => router.push(`/exam/${id}`)}>Coba Lagi</button>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="result-pdf-controls">
                        <div className="form-group result-pdf-field" style={{ marginBottom: 0 }}>
                            <label className="form-label">Kualitas PDF</label>
                            <select className="select" value={pdfQuality} onChange={(e) => setPdfQuality(e.target.value)}>
                                <option value="low">Ringan (Kecil)</option>
                                <option value="medium">Sedang (Rekomendasi)</option>
                                <option value="high">Tinggi (Lebih Tajam)</option>
                            </select>
                        </div>
                        <div className="form-group result-pdf-field" style={{ marginBottom: 0 }}>
                            <label className="form-label">Tampilan Jawaban di PDF</label>
                            <select className="select" value={pdfAnswerMode} onChange={(e) => setPdfAnswerMode(e.target.value)}>
                                <option value="summary">Ringkasan Jawaban</option>
                                <option value="answers_only">Jawaban Saja</option>
                                <option value="answers_with_explanations">Jawaban + Pembahasan</option>
                            </select>
                        </div>
                        <span className="badge badge-info" style={{ alignSelf: 'center' }}>
                            {pdfQuality === 'low' ? 'File kecil' : pdfQuality === 'high' ? 'Kualitas tinggi' : 'Seimbang'}
                        </span>
                    </div>
                </div>

                <div className="result-hero">
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{attempt.subject_icon} {attempt.subject_name}</div>
                        <div className="result-score" style={{ color: getGradeColor(grade) }}>{formatScore(score)}</div>
                        <div className="result-grade" style={{ background: `${getGradeColor(grade)}20`, color: getGradeColor(grade) }}>
                            Grade {grade} - {getGradeLabel(grade)}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                            Skala {scoreScale.min}-{scoreScale.max} | Akurasi {Math.round(accuracyPct)}%
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <span className={`badge ${passed ? 'badge-success' : 'badge-danger'}`}>
                                {passed ? 'LULUS' : 'TIDAK LULUS'}
                            </span>
                        </div>
                    </div>

                    <div className="result-details">
                        <div className="result-detail">
                            <div className="result-detail-value" style={{ color: 'var(--green)' }}>{correct}</div>
                            <div className="result-detail-label">Benar</div>
                        </div>
                        <div className="result-detail">
                            <div className="result-detail-value" style={{ color: 'var(--red)' }}>{total - correct}</div>
                            <div className="result-detail-label">Salah</div>
                        </div>
                        <div className="result-detail">
                            <div className="result-detail-value">{total}</div>
                            <div className="result-detail-label">Total Soal</div>
                        </div>
                        <div className="result-detail">
                            <div className="result-detail-value">{attempt.percentile ? `${attempt.percentile}%` : '-'}</div>
                            <div className="result-detail-label">Persentil</div>
                        </div>
                        <div className="result-detail">
                            <div className="result-detail-value">{attempt.ability_score ? Number(attempt.ability_score).toFixed(2) : '-'}</div>
                            <div className="result-detail-label">Skor IRT (theta)</div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Persentase Jawaban</h3>
                    <div className="progress-bar" style={{ height: 12 }}>
                        <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'var(--green)' }} />
                    </div>
                    <div className="result-progress-meta" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                        <span>Benar: {correct} ({total > 0 ? Math.round((correct / total) * 100) : 0}%)</span>
                        <span>Salah: {total - correct} ({total > 0 ? Math.round(((total - correct) / total) * 100) : 0}%)</span>
                    </div>
                </div>

                {topicLabels.length > 0 && (
                    <div className="grid-2" style={{ marginBottom: 24 }}>
                        <div className="card">
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Analitik Performa Materi</h3>
                            <div style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                                {chartReady ? <Radar data={radarData} options={radarOptions} /> : <div>Memuat grafik...</div>}
                            </div>
                        </div>
                        <div className="card">
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Detail Per Materi</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {topicLabels.map((topic, i) => {
                                    const stats = topicAnalysis[topic];
                                    const pct = Math.round((stats.correct / stats.total) * 100);
                                    let color = 'var(--red)';
                                    if (pct >= 80) color = 'var(--green)';
                                    else if (pct >= 50) color = 'var(--yellow)';

                                    return (
                                        <div key={i}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                                <span style={{ fontWeight: 600 }}>{topic}</span>
                                                <span style={{ color, fontWeight: 700 }}>{pct}%</span>
                                            </div>
                                            <div className="progress-bar" style={{ height: 6, background: 'var(--bg-secondary)' }}>
                                                <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                                {stats.correct} dari {stats.total} soal benar
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                <div className="card">
                    <div className="result-review-header" style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Review Jawaban</h3>
                        <div className="result-review-actions">
                            <select className="select result-review-select" value={reviewMode} onChange={(e) => setReviewMode(e.target.value)}>
                                <option value="answers_only">Jawaban Saja</option>
                                <option value="explanations_only">Pembahasan Saja</option>
                                <option value="answers_with_explanations">Jawaban + Pembahasan</option>
                            </select>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowAnswers(!showAnswers)}>
                                {showAnswers ? 'Sembunyikan' : 'Tampilkan'}
                            </button>
                        </div>
                    </div>

                    {showAnswers && answers?.map((answer, i) => (
                        <div
                            key={i}
                            className={`card ${answer.is_correct ? 'card-success' : 'card-danger'}`}
                            style={{
                                padding: 20,
                                marginBottom: 20,
                                borderLeft: `4px solid ${answer.is_correct ? 'var(--green)' : 'var(--red)'}`,
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <span style={{
                                        background: 'var(--bg-glass)',
                                        padding: '4px 12px',
                                        borderRadius: 20,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        border: '1px solid var(--border-color)'
                                    }}>Soal {i + 1}</span>
                                    {answer.topic && <span className="badge badge-info">{answer.topic}</span>}
                                    <span className={`badge ${answer.difficulty_level === 'hard' ? 'badge-danger' :
                                        answer.difficulty_level === 'medium' ? 'badge-warning' : 'badge-success'
                                        }`}>
                                        {answer.difficulty_level?.toUpperCase() || 'MEDIUM'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ fontSize: 13, color: answer.is_correct ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                                        {answer.is_correct ? '✓ Terjawab Benar' : '✗ Terjawab Salah'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ fontSize: 16, marginBottom: 20, lineHeight: 1.8, fontWeight: 500 }}>
                                <RichContentDisplay content={answer.question_text} />
                            </div>

                            {reviewMode !== 'explanations_only' && (
                                <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
                                    {(answer.question_type === 'multiple_choice' || answer.question_type === 'multiple_choice_complex') && (() => {
                                        let opts = [];
                                        try {
                                            if (answer.options) {
                                                opts = typeof answer.options === 'string' ? JSON.parse(answer.options) : answer.options;
                                            }
                                        } catch (e) { }

                                        if (Array.isArray(opts) && opts.length > 0) {
                                            return opts.map((opt, idx) => {
                                                const isCorrect = (answer.question_type === 'multiple_choice_complex')
                                                    ? (answer.correct_answer || '').split(',').includes(opt.label)
                                                    : opt.label === answer.correct_answer;

                                                const isSelected = (answer.question_type === 'multiple_choice_complex')
                                                    ? (answer.selected_answer || '').split(',').includes(opt.label)
                                                    : opt.label === answer.selected_answer;

                                                let bgColor = 'var(--bg-glass)';
                                                let borderColor = 'var(--border-color)';
                                                if (isCorrect) {
                                                    bgColor = 'rgba(16, 185, 129, 0.1)';
                                                    borderColor = 'var(--green)';
                                                } else if (isSelected && !isCorrect) {
                                                    bgColor = 'rgba(239, 68, 68, 0.1)';
                                                    borderColor = 'var(--red)';
                                                }

                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'flex-start',
                                                            gap: 12,
                                                            padding: '12px 16px',
                                                            borderRadius: 'var(--radius-md)',
                                                            fontSize: 14,
                                                            border: `1px solid ${borderColor}`,
                                                            background: bgColor,
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        <strong style={{
                                                            minWidth: 24,
                                                            height: 24,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: '50%',
                                                            background: isCorrect ? 'var(--green)' : isSelected ? 'var(--red)' : 'var(--bg-secondary)',
                                                            color: (isCorrect || isSelected) ? '#fff' : 'var(--text-secondary)',
                                                            fontSize: 12
                                                        }}>{opt.label}</strong>
                                                        <div style={{ flex: 1, marginTop: 1 }}><RichContentDisplay content={opt.text} /></div>
                                                        {isCorrect && <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Benar</span>}
                                                        {isSelected && !isCorrect && <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>Pilihan Anda</span>}
                                                    </div>
                                                );
                                            });
                                        }

                                        // Fallback A-E
                                        return ['A', 'B', 'C', 'D', 'E'].map(letter => {
                                            const optKey = `option_${letter.toLowerCase()}`;
                                            if (!answer[optKey]) return null;

                                            const isCorrect = (answer.question_type === 'multiple_choice_complex')
                                                ? (answer.correct_answer || '').split(',').includes(letter)
                                                : letter === answer.correct_answer;

                                            const isSelected = (answer.question_type === 'multiple_choice_complex')
                                                ? (answer.selected_answer || '').split(',').includes(letter)
                                                : letter === answer.selected_answer;

                                            let bgColor = 'var(--bg-glass)';
                                            let borderColor = 'var(--border-color)';
                                            if (isCorrect) {
                                                bgColor = 'rgba(16, 185, 129, 0.1)';
                                                borderColor = 'var(--green)';
                                            } else if (isSelected && !isCorrect) {
                                                bgColor = 'rgba(239, 68, 68, 0.1)';
                                                borderColor = 'var(--red)';
                                            }

                                            return (
                                                <div
                                                    key={letter}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'flex-start',
                                                        gap: 12,
                                                        padding: '12px 16px',
                                                        borderRadius: 'var(--radius-md)',
                                                        fontSize: 14,
                                                        border: `1px solid ${borderColor}`,
                                                        background: bgColor,
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <strong style={{
                                                        minWidth: 24,
                                                        height: 24,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        borderRadius: '50%',
                                                        background: isCorrect ? 'var(--green)' : isSelected ? 'var(--red)' : 'var(--bg-secondary)',
                                                        color: (isCorrect || isSelected) ? '#fff' : 'var(--text-secondary)',
                                                        fontSize: 12
                                                    }}>{letter}</strong>
                                                    <div style={{ flex: 1, marginTop: 1 }}><RichContentDisplay content={answer[optKey]} /></div>
                                                    {isCorrect && <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Benar</span>}
                                                    {isSelected && !isCorrect && <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>Pilihan Anda</span>}
                                                </div>
                                            );
                                        });
                                    })()}

                                    {answer.question_type === 'true_false' && [
                                        { l: 'A', t: 'Benar' },
                                        { l: 'B', t: 'Salah' }
                                    ].map(item => {
                                        const isCorrect = item.l === answer.correct_answer;
                                        const isSelected = item.l === answer.selected_answer;
                                        let bgColor = 'var(--bg-glass)';
                                        let borderColor = 'var(--border-color)';
                                        if (isCorrect) {
                                            bgColor = 'rgba(16, 185, 129, 0.1)';
                                            borderColor = 'var(--green)';
                                        } else if (isSelected && !isCorrect) {
                                            bgColor = 'rgba(239, 68, 68, 0.1)';
                                            borderColor = 'var(--red)';
                                        }

                                        return (
                                            <div key={item.l} style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 'var(--radius-md)', border: `1px solid ${borderColor}`, background: bgColor, fontSize: 14
                                            }}>
                                                <strong style={{
                                                    minWidth: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
                                                    background: isCorrect ? 'var(--green)' : isSelected ? 'var(--red)' : 'var(--bg-secondary)',
                                                    color: '#fff', fontSize: 14
                                                }}>{item.l === 'A' ? '✓' : '✗'}</strong>
                                                <div style={{ flex: 1 }}>{item.t}</div>
                                                {isCorrect && <span style={{ color: 'var(--green)', fontWeight: 'bold' }}>Kunci</span>}
                                                {isSelected && !isCorrect && <span style={{ color: 'var(--red)', fontWeight: 'bold' }}>Anda</span>}
                                            </div>
                                        );
                                    })}

                                    {(answer.question_type === 'short_answer' || answer.question_type === 'essay') && (
                                        <div className="result-answer-compare">
                                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Jawaban Anda</div>
                                                <div style={{ fontSize: 15, fontWeight: 600 }}>{answer.selected_answer || <i style={{ color: 'var(--text-muted)' }}>(Tidak dijawab)</i>}</div>
                                            </div>
                                            <div style={{ padding: 16, borderRadius: 12, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--green)' }}>
                                                <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Kunci Jawaban</div>
                                                <div style={{ fontSize: 15, fontWeight: 600 }}><RichContentDisplay content={answer.correct_answer} /></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {reviewMode !== 'answers_only' && answer.explanation && (
                                <div style={{
                                    marginTop: 12,
                                    padding: '16px 20px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: 4,
                                        height: '100%',
                                        background: 'var(--accent)'
                                    }} />
                                    <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginBottom: 8, textTransform: 'uppercase' }}>Pembahasan Lengkap:</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                                        <RichContentDisplay content={answer.explanation} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </AppLayout>
    );
}
