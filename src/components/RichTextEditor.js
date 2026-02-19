'use client';
import { useState, useRef } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

export default function RichTextEditor({ value, onChange, label, height = 150 }) {
    const [preview, setPreview] = useState(false);
    const [uploading, setUploading] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    const [showHelp, setShowHelp] = useState(false);
    const [showMathBuilder, setShowMathBuilder] = useState(false);
    const [mathInput, setMathInput] = useState('');
    const [mathMode, setMathMode] = useState('inline'); // 'inline' or 'block'

    const mathTemplates = [
        { name: 'Pecahan', code: '\\frac{a}{b}', category: 'Basic' },
        { name: 'Akar', code: '\\sqrt{x}', category: 'Basic' },
        { name: 'Akar n', code: '\\sqrt[n]{x}', category: 'Basic' },
        { name: 'Pangkat', code: 'x^{n}', category: 'Basic' },
        { name: 'Subscript', code: 'x_{n}', category: 'Basic' },
        { name: 'Kali', code: '\\times', category: 'Basic' },
        { name: 'Bagi', code: '\\div', category: 'Basic' },
        { name: 'Kurang Lebih', code: '\\pm', category: 'Basic' },

        { name: 'Limit', code: '\\lim_{x \\to \\infty}', category: 'Calculus' },
        { name: 'Turunan', code: '\\frac{dy}{dx}', category: 'Calculus' },
        { name: 'Integral', code: '\\int_{a}^{b} f(x) dx', category: 'Calculus' },
        { name: 'Sigma', code: '\\sum_{i=1}^{n}', category: 'Calculus' },

        { name: 'Alpha', code: '\\alpha', category: 'Greek' },
        { name: 'Beta', code: '\\beta', category: 'Greek' },
        { name: 'Gamma', code: '\\gamma', category: 'Greek' },
        { name: 'Pi', code: '\\pi', category: 'Greek' },
        { name: 'Theta', code: '\\theta', category: 'Greek' },
        { name: 'Omega', code: '\\omega', category: 'Greek' },
        { name: 'Delta', code: '\\Delta', category: 'Greek' },

        { name: 'Matriks 2x2', code: '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', category: 'Matrix' },
        { name: 'Matriks 3x3', code: '\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}', category: 'Matrix' },
    ];

    const insertText = (before, after = '', placeholder = '') => {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const beforeText = text.substring(0, start);
        const selectedText = text.substring(start, end) || placeholder;
        const afterText = text.substring(end);

        const newValue = beforeText + before + selectedText + after + afterText;
        onChange(newValue);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
        }, 0);
    };

    const handleFileUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                insertText(`![Image](${data.url})`);
            } else {
                alert('Upload gagal: ' + data.message);
            }
        } catch (err) {
            alert('Upload error');
        }
        setUploading(false);
    };

    const handlePaste = async (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    await handleFileUpload(file);
                }
            }
        }
    };

    const handleMathInsert = () => {
        const formula = mathMode === 'block' ? `\n$$ ${mathInput} $$\n` : `$${mathInput}$`;
        insertText(formula);
        setShowMathBuilder(false);
        setMathInput('');
    };

    return (
        <div className="rich-editor" style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative' }}>
            {label && <div style={{ padding: '8px 12px', background: 'var(--bg-glass)', borderBottom: '1px solid var(--border-color)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>}

            <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" className="editor-btn" onClick={() => insertText('**', '**')} title="Bold"><b>B</b></button>
                <button type="button" className="editor-btn" onClick={() => insertText('*', '*')} title="Italic"><i>I</i></button>
                <button type="button" className="editor-btn" onClick={() => insertText('`', '`')} title="Inline Code">{'<>'}</button>
                <button type="button" className="editor-btn" onClick={() => insertText('\n```\n', '\n```\n')} title="Code Block">{'{}'}</button>
                <button type="button" className="editor-btn" onClick={() => setShowMathBuilder(true)} title="Math Builder (MathType)"><i>f(x)</i></button>
                <button type="button" className="editor-btn" onClick={() => insertText('\n| Judul 1 | Judul 2 |\n|---------|---------|\n| Baris 1 | Data 1  |\n| Baris 2 | Data 2  |\n')} title="Insert Table">📋</button>
                <button type="button" className="editor-btn" onClick={() => fileInputRef.current?.click()} title="Upload Image" disabled={uploading}>
                    {uploading ? '⏳' : '🖼️'}
                </button>
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleFileUpload(e.target.files[0])} />

                <div style={{ flex: 1 }} />
                <button type="button" className="editor-btn" onClick={async () => {
                    try {
                        const text = await navigator.clipboard.readText();
                        if (text) insertText(text);
                    } catch (e) { alert('Gagal membaca clipboard.'); }
                }} title="Paste from Clipboard">📥 Paste Teks</button>
                <button type="button" className="editor-btn" onClick={() => setShowHelp(true)} title="Help">❓</button>
                <button type="button" className={`editor-btn ${preview ? 'active' : ''}`} onClick={() => setPreview(!preview)}>
                    {preview ? '✏️ Edit' : '👁 Preview'}
                </button>
            </div>

            {preview ? (
                <div style={{ minHeight: height, padding: 12, overflowY: 'auto', background: 'var(--bg-input)' }}>
                    <RichContentDisplay content={value} />
                </div>
            ) : (
                <textarea
                    ref={textareaRef}
                    className="textarea"
                    style={{ height, border: 'none', borderRadius: 0, resize: 'vertical' }}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="Tulis soal di sini... Gunakan Markdown, LaTeX ($$), atau upload gambar."
                />
            )}

            {showMathBuilder && (
                <div className="modal-overlay" style={{ position: 'fixed', zIndex: 9999 }} onClick={() => setShowMathBuilder(false)}>
                    <div className="modal-box" style={{ maxWidth: 700, width: '90%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 className="modal-title" style={{ margin: 0 }}>Math Formula Builder</h3>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className={`btn btn-sm ${mathMode === 'inline' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMathMode('inline')}>Inline ($)</button>
                                <button className={`btn btn-sm ${mathMode === 'block' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMathMode('block')}>Block ($$)</button>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr', gap: 16 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Pilih Simbol/Template:</div>
                                <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                                    {['Basic', 'Calculus', 'Greek', 'Matrix'].map(cat => (
                                        <div key={cat} style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>{cat}</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 4 }}>
                                                {mathTemplates.filter(t => t.category === cat).map(t => (
                                                    <button key={t.name} className="math-pick-btn" onClick={() => setMathInput(prev => prev + t.code)}>
                                                        <div style={{ fontSize: 14 }}><InlineMath math={t.code.includes('pmatrix') ? '\\dots' : t.code} /></div>
                                                        <div style={{ fontSize: 9, marginTop: 4 }}>{t.name}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Input LaTeX:</div>
                                    <textarea
                                        className="textarea"
                                        style={{ height: 100, fontSize: 14, fontFamily: 'monospace' }}
                                        value={mathInput}
                                        onChange={e => setMathInput(e.target.value)}
                                        placeholder="Tulis kode LaTeX di sini..."
                                    />
                                </div>
                                <div style={{ flex: 1, border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, background: 'var(--bg-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100, overflow: 'auto' }}>
                                    {mathInput ? (
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Preview:</div>
                                            <BlockMath math={mathInput} />
                                        </div>
                                    ) : (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Rumus akan muncul di sini</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="modal-actions" style={{ marginTop: 20 }}>
                            <button className="btn btn-secondary" onClick={() => setShowMathBuilder(false)}>Batal</button>
                            <button className="btn btn-primary" onClick={handleMathInsert}>Sematkan Rumus</button>
                        </div>
                    </div>
                </div>
            )}

            {showHelp && (
                <div className="modal-overlay" style={{ position: 'fixed', zIndex: 9999 }} onClick={() => setShowHelp(false)}>
                    <div className="modal-box" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Panduan Editor</h3>
                        <div style={{ fontSize: 13, maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
                            <p><b>Markdown:</b></p>
                            <code style={{ display: 'block', background: 'var(--bg-secondary)', padding: 8, borderRadius: 4, marginBottom: 12 }}>
                                **Tebal**, *Miring*, `Kode`<br />
                                ![Alt](url) untuk gambar<br />
                                | Col 1 | Col 2 | (Tabel)
                            </code>
                            <p><b>Matematika:</b></p>
                            <p>Gunakan tombol <b>f(x)</b> untuk simulasi visual atau ketik manual:</p>
                            <code style={{ display: 'block', background: 'var(--bg-secondary)', padding: 8, borderRadius: 4, marginBottom: 12 }}>
                                $x^2 + y^2 = z^2$ (Inline)<br />
                                {"$$ \\frac{-b \\pm \\sqrt{D}}{2a} $$"} (Blok)
                            </code>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-primary btn-full" onClick={() => setShowHelp(false)}>Tutup</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .editor-btn {
                    padding: 4px 8px; border: 1px solid var(--border-color); background: var(--bg-glass);
                    color: var(--text-secondary); border-radius: 4px; cursor: pointer; font-size: 12px;
                    transition: all 0.2s; min-width: 28px;
                    display: flex; align-items: center; justify-content: center;
                }
                .editor-btn:hover { background: var(--bg-glass-hover); color: var(--text-primary); }
                .editor-btn.active { background: var(--accent); color: white; border-color: var(--accent); }
                .math-pick-btn {
                    padding: 8px 4px; border: 1px solid var(--border-color); background: var(--bg-glass);
                    color: var(--text-primary); border-radius: 6px; cursor: pointer;
                    display: flex; flexDirection: column; align-items: center; justify-content: center;
                    transition: all 0.2s;
                }
                .math-pick-btn:hover { border-color: var(--accent); background: var(--bg-glass-hover); transform: translateY(-1px); }
            `}</style>
        </div>
    );
}

export function RichContentDisplay({ content }) {
    if (!content) return null;

    // Supported delimiters: 
    // Block: $$...$$ or \[...\]
    // Inline: $...$ or \(...\)
    const regex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^$]+\$|\\\([\s\S]*?\\\))/g;
    const parts = content.split(regex);

    return (
        <div className="rich-content" style={{ lineHeight: 1.6, fontSize: 'inherit', wordBreak: 'break-word' }}>
            {parts.map((part, i) => {
                if (!part) return null;

                // Detect Block Math
                if ((part.startsWith('$$') && part.endsWith('$$')) || (part.startsWith('\\[') && part.endsWith('\\]'))) {
                    const math = part.slice(2, -2).trim();
                    return (
                        <div key={i} style={{ margin: '12px 0', textAlign: 'center', overflowX: 'auto', overflowY: 'hidden' }}>
                            <BlockMath math={math} />
                        </div>
                    );
                }

                // Detect Inline Math
                if ((part.startsWith('$') && part.endsWith('$')) || (part.startsWith('\\(') && part.endsWith('\\)'))) {
                    const math = part.startsWith('$') ? part.slice(1, -1).trim() : part.slice(2, -2).trim();
                    return <span key={i} style={{ padding: '0 2px', verticalAlign: 'baseline', display: 'inline-block' }}><InlineMath math={math} /></span>;
                }

                // Standard text / Markdown
                return <span key={i} dangerouslySetInnerHTML={{ __html: parseMarkdown(part) }} />;
            })}
        </div>
    );
}

function parseMarkdown(text) {
    if (!text) return '';

    // 1. Escape HTML (except parts we generate)
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 2. Patterns
    html = html
        // Images
        .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:100%; height:auto; border-radius:8px; margin:8px 0; display:block" />')
        // Code Blocks
        .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-secondary); padding:12px; border-radius:8px; overflow-x:auto; border:1px solid var(--border-color); font-family:monospace; font-size:13px; margin:8px 0;"><code>$1</code></pre>')
        // Inline Code
        .replace(/`([^`]+)`/g, '<code style="background:var(--bg-secondary); padding:2px 6px; border-radius:4px; font-family:monospace; border:1px solid var(--border-color); font-size:0.9em;">$1</code>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Newlines
        .replace(/\n/g, '<br/>');

    // 3. Simple Table Parser (Markdown Table)
    const lines = html.split('<br/>');
    let inTable = false;
    let tableHtml = '<div style="overflow-x:auto; margin:12px 0; border: 1px solid var(--border-color); border-radius: 8px;"><table style="width:100%; border-collapse:collapse; background:var(--bg-glass);">';
    let result = [];

    for (let j = 0; j < lines.length; j++) {
        const line = lines[j].trim();
        if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) inTable = true;
            const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
            const isHeaderDivider = cells.every(c => c.trim().startsWith('-'));

            if (isHeaderDivider) continue;

            const nextLine = lines[j + 1] ? lines[j + 1].trim() : '';
            const isHeader = nextLine.startsWith('|') && nextLine.includes('---');

            tableHtml += '<tr>';
            cells.forEach(c => {
                const tag = isHeader ? 'th' : 'td';
                tableHtml += `<${tag} style="padding:10px 14px; border-bottom: 1px solid var(--border-color); border-right: 1px solid var(--border-color); text-align:left; font-weight:${isHeader ? '700' : '400'}; background:${isHeader ? 'var(--bg-secondary)' : 'transparent'};">${c.trim()}</${tag}>`;
            });
            tableHtml += '</tr>';
        } else {
            if (inTable) {
                tableHtml += '</table></div>';
                result.push(tableHtml);
                inTable = false;
                tableHtml = '<div style="overflow-x:auto; margin:12px 0; border: 1px solid var(--border-color); border-radius: 8px;"><table style="width:100%; border-collapse:collapse; background:var(--bg-glass);">';
            }
            result.push(line);
        }
    }
    if (inTable) {
        tableHtml += '</table></div>';
        result.push(tableHtml);
    }

    return result.join('<br/>');
}
