import React, { useState, useEffect } from 'react';
import { Eye, Pencil, Save } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './DocEditor.module.css';

interface DocEditorProps {
	content: string | null;
	onSave: (content: string) => Promise<void> | void;
	mode?: 'preview' | 'edit';
	onModeChange?: (mode: 'preview' | 'edit') => void;
}

export function DocEditor({ content, onSave, mode: modeProp, onModeChange }: DocEditorProps) {
	const controlled = modeProp !== undefined;
	const [modeInternal, setModeInternal] = useState<'preview' | 'edit'>('preview');
	const mode = controlled ? modeProp! : modeInternal;
	const setMode = controlled ? (m: 'preview' | 'edit') => onModeChange?.(m) : setModeInternal;
	const [draft, setDraft] = useState(content ?? '');
	const [saving, setSaving] = useState(false);

	// Sync draft when content prop changes (e.g. after external save)
	useEffect(() => {
		setDraft(content ?? '');
	}, [content]);

	const isDirty = draft !== (content ?? '');

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave(draft);
			setMode('preview');
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className={styles.editor}>
			{(!controlled || isDirty) && (
				<div className={styles.toolbar}>
					{!controlled && (
						<div className={styles.modeToggle}>
							<button
								className={`${styles.modeBtn} ${mode === 'preview' ? styles.modeBtnActive : ''}`}
								onClick={() => setMode('preview')}
								title="Preview"
							>
								<Eye size={14} />
							</button>
							<button
								className={`${styles.modeBtn} ${mode === 'edit' ? styles.modeBtnActive : ''}`}
								onClick={() => setMode('edit')}
								title="Edit"
							>
								<Pencil size={14} />
							</button>
						</div>
					)}
					{isDirty && (
						<button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
							<Save size={12} /> {saving ? 'Saving…' : 'Save'}
						</button>
					)}
				</div>
			)}

			{mode === 'edit' ? (
				<textarea
					className={styles.textarea}
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					spellCheck={false}
				/>
			) : (
				<div className={styles.preview}>
					{draft ? (
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							components={{
								strong: ({ children }) => (
									<strong className={styles.bold}>{children}</strong>
								),
								h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
								h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
								h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
								p: ({ children }) => <p className={styles.p}>{children}</p>,
								ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
								ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
								li: ({ children }) => <li className={styles.li}>{children}</li>,
								blockquote: ({ children }) => (
									<blockquote className={styles.blockquote}>
										{children}
									</blockquote>
								),
								hr: () => <hr className={styles.hr} />,
								code: ({ children }) => (
									<code className={styles.code}>{children}</code>
								),
								table: ({ children }) => (
									<div className={styles.tableWrapper}>
										<table className={styles.table}>{children}</table>
									</div>
								),
								thead: ({ children }) => <thead>{children}</thead>,
								tbody: ({ children }) => <tbody>{children}</tbody>,
								tr: ({ children }) => <tr className={styles.tr}>{children}</tr>,
								th: ({ children }) => <th className={styles.th}>{children}</th>,
								td: ({ children }) => <td className={styles.td}>{children}</td>,
							}}
						>
							{draft}
						</ReactMarkdown>
					) : (
						<p className={styles.empty}>No content.</p>
					)}
				</div>
			)}
		</div>
	);
}
