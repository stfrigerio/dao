import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import styles from './QuestionFocusMode.module.css';

interface QuestionBlock {
	section: string;
	qLabel: string;
	questionBody: string;
	fullQuestionLine: string; // original line(s) with **Q1:** for reconstruction
	options: string[];
}

function parseQuestions(markdown: string): QuestionBlock[] {
	const lines = markdown.split('\n');
	const blocks: QuestionBlock[] = [];
	let currentSection = '';
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.startsWith('## ')) {
			currentSection = line.slice(3).trim();
			i++;
			continue;
		}

		const qMatch = line.match(/^\*\*Q(\d+)[:.]\*\*\s*(.*)/);
		if (qMatch) {
			const qNum = qMatch[1];
			const firstBody = qMatch[2];
			const questionLines = [line];
			i++;

			// Collect continuation lines (wrapped question text)
			while (
				i < lines.length &&
				lines[i] !== '' &&
				!lines[i].startsWith('> ') &&
				!lines[i].match(/^\*\*Q\d+/)
			) {
				questionLines.push(lines[i]);
				i++;
			}

			// Build display body: first line body + continuations
			const bodyParts = [firstBody];
			for (let j = 1; j < questionLines.length; j++) bodyParts.push(questionLines[j]);

			// Skip blank lines before answer
			while (i < lines.length && lines[i] === '') i++;

			// Parse options line if present
			let options: string[] = [];
			if (i < lines.length && lines[i].startsWith('[opt:')) {
				const optMatch = lines[i].match(/^\[opt:\s*(.*)\]$/);
				if (optMatch) options = optMatch[1].split('|').map((s) => s.trim()).filter(Boolean);
				i++;
				while (i < lines.length && lines[i] === '') i++;
			}

			// Skip over blockquote answer
			while (i < lines.length && lines[i].startsWith('> ')) i++;

			blocks.push({
				section: currentSection,
				qLabel: `Q${qNum}`,
				questionBody: bodyParts.join(' ').trim(),
				fullQuestionLine: questionLines.join('\n'),
				options,
			});
			continue;
		}

		i++;
	}

	return blocks;
}

function parseAnswers(markdown: string): string[] {
	const lines = markdown.split('\n');
	const answers: string[] = [];
	let inQuestion = false;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.match(/^\*\*Q\d+[:.]\*\*/)) {
			inQuestion = true;
			i++;
			// Skip continuation lines
			while (
				i < lines.length &&
				lines[i] !== '' &&
				!lines[i].startsWith('> ') &&
				!lines[i].match(/^\*\*Q\d+/)
			) {
				i++;
			}
			// Skip blanks
			while (i < lines.length && lines[i] === '') i++;
			// Skip options line if present
			if (i < lines.length && lines[i].startsWith('[opt:')) {
				i++;
				while (i < lines.length && lines[i] === '') i++;
			}
			// Collect blockquote
			const ansLines: string[] = [];
			while (i < lines.length && lines[i].startsWith('> ')) {
				ansLines.push(lines[i].slice(2));
				i++;
			}
			const raw = ansLines.join('\n').trim();
			answers.push(raw === 'answer here' || raw === '_answer here_' || raw === '' ? '' : raw);
			inQuestion = false;
			continue;
		}

		i++;
	}

	return answers;
}

function reconstruct(markdown: string, answers: string[]): string {
	const lines = markdown.split('\n');
	const result: string[] = [];
	let qIdx = -1;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.match(/^\*\*Q\d+[:.]\*\*/)) {
			qIdx++;
			result.push(line);
			i++;
			// Copy continuation lines
			while (
				i < lines.length &&
				lines[i] !== '' &&
				!lines[i].startsWith('> ') &&
				!lines[i].match(/^\*\*Q\d+/)
			) {
				result.push(lines[i]);
				i++;
			}
			continue;
		}

		if (qIdx >= 0 && line.startsWith('> ')) {
			// Replace old answer blockquote
			while (i < lines.length && lines[i].startsWith('> ')) i++;
			const ans = answers[qIdx]?.trim();
			if (ans) {
				ans.split('\n').forEach((l) => result.push('> ' + l));
			} else {
				result.push('> _answer here_');
			}
			continue;
		}

		result.push(line);
		i++;
	}

	return result.join('\n');
}

interface Props {
	title: string;
	content: string;
	onSave: (content: string) => Promise<void> | void;
	onClose: () => void;
}

export function QuestionFocusMode({ title, content, onSave, onClose }: Props) {
	const questions = parseQuestions(content);
	const [answers, setAnswers] = useState<string[]>(() => parseAnswers(content));
	const [index, setIndex] = useState(0);
	const [direction, setDirection] = useState<1 | -1>(1);
	const [saving, setSaving] = useState(false);
	const [savedAnswers] = useState<string[]>(() => parseAnswers(content));
	const [focusSlot, setFocusSlot] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Ignore null on unmount — prevents the exiting card from clearing refs that
	// the entering card already claimed (AnimatePresence without mode="wait").
	const setTextareaRef = useCallback((el: HTMLTextAreaElement | null) => {
		if (el !== null) textareaRef.current = el;
	}, []);
	const setChipRef = useCallback((i: number, el: HTMLButtonElement | null) => {
		if (el !== null) chipRefs.current[i] = el;
	}, []);

	const isDirty = answers.some((a, i) => a !== savedAnswers[i]);
	const current = questions[index];
	const total = questions.length;

	// Auto-resize textarea
	useEffect(() => {
		const ta = textareaRef.current;
		if (!ta) return;
		ta.style.height = 'auto';
		ta.style.height = ta.scrollHeight + 'px';
	}, [answers[index], index]);

	// Reset slot on question change
	useEffect(() => {
		setFocusSlot(0);
	}, [index]);

	// Focus correct element when slot or question changes
	useEffect(() => {
		const opts = current?.options ?? [];
		if (focusSlot < opts.length) {
			chipRefs.current[focusSlot]?.focus();
		} else {
			textareaRef.current?.focus();
		}
	}, [focusSlot, index]);

	const goTo = useCallback((next: number, dir: 1 | -1) => {
		setDirection(dir);
		setIndex(next);
	}, []);

	// Keyboard navigation
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') { onClose(); return; }

			const inTextarea = document.activeElement === textareaRef.current;
			const slotCount = questions[index]?.options.length ?? 0; // chips; +1 implicitly for textarea

			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
				e.preventDefault();
				if (index < total - 1) goTo(index + 1, 1);
				return;
			}

			if (inTextarea && e.key === 'ArrowUp' && slotCount > 0) {
				const ta = textareaRef.current!;
				if (ta.selectionStart === 0 && ta.selectionEnd === 0) {
					e.preventDefault();
					setFocusSlot(slotCount - 1);
				}
				return;
			}

			if (!inTextarea) {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					setFocusSlot((s) => Math.min(s + 1, slotCount));
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					setFocusSlot((s) => Math.max(s - 1, 0));
				} else if (e.key === 'ArrowRight') {
					e.preventDefault();
					if (index < total - 1) goTo(index + 1, 1);
				} else if (e.key === 'ArrowLeft') {
					e.preventDefault();
					if (index > 0) goTo(index - 1, -1);
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => window.removeEventListener('keydown', handler);
	}, [index, total, onClose, goTo]);

	const handleSave = async () => {
		setSaving(true);
		try {
			await onSave(reconstruct(content, answers));
		} finally {
			setSaving(false);
		}
	};

	if (!current) return null;

	return createPortal(
		<motion.div
			className={styles.overlay}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.2 }}
		>
			{/* Progress bar */}
			<div className={styles.progressTrack}>
				<motion.div
					className={styles.progressFill}
					animate={{ width: `${((index + 1) / total) * 100}%` }}
					transition={{ duration: 0.3, ease: 'easeInOut' }}
				/>
			</div>

			{/* Top bar */}
			<div className={styles.topBar}>
				<span className={styles.topTitle}>{title}</span>
				<div className={styles.topCenter}>
					{questions.map((_, i) => (
						<button
							key={i}
							className={`${styles.dot} ${i === index ? styles.dotActive : ''} ${answers[i] ? styles.dotAnswered : ''}`}
							onClick={() => goTo(i, i > index ? 1 : -1)}
							title={`Q${i + 1}`}
						/>
					))}
				</div>
				<div className={styles.topRight}>
					<span className={styles.counter}>
						{index + 1} / {total}
					</span>
					<button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
						<X size={16} />
					</button>
				</div>
			</div>

			{/* Question area */}
			<div className={styles.body}>
				<AnimatePresence mode="wait" custom={direction}>
					<motion.div
						key={index}
						custom={direction}
						initial="enter"
						animate="center"
						exit="exit"
						variants={{
							enter: (d: number) => ({ opacity: 0, x: d * 60, scale: 0.98 }),
							center: { opacity: 1, x: 0, scale: 1 },
							exit: (d: number) => ({ opacity: 0, x: d * -60, scale: 0.98 }),
						}}
						transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
						className={styles.questionCard}
					>
						{current.section && (
							<p className={styles.sectionLabel}>{current.section}</p>
						)}
						<div className={styles.questionHeader}>
							<span className={styles.qLabel}>{current.qLabel}</span>
						</div>
						<p className={styles.questionText}>{current.questionBody}</p>

						{current.options.length > 0 && (
							<div className={styles.optionChips}>
								{current.options.map((opt, i) => (
									<button
										key={i}
										ref={(el) => setChipRef(i, el)}
										className={`${styles.optionChip} ${answers[index] === opt ? styles.optionChipSelected : ''} ${focusSlot === i && answers[index] !== opt ? styles.optionChipFocused : ''}`}
										onPointerDown={(e) => {
											e.preventDefault();
											setFocusSlot(i);
											chipRefs.current[i]?.focus();
											const next = [...answers];
											next[index] = answers[index] === opt ? '' : opt;
											setAnswers(next);
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.preventDefault();
												const next = [...answers];
												next[index] = opt;
												setAnswers(next);
												if (index < total - 1) goTo(index + 1, 1);
											} else if (e.key === ' ') {
												e.preventDefault();
												const next = [...answers];
												next[index] = answers[index] === opt ? '' : opt;
												setAnswers(next);
											}
										}}
									>
										{opt}
									</button>
								))}
							</div>
						)}

						<div className={styles.answerWrap}>
							<textarea
								ref={setTextareaRef}
								className={styles.answerTextarea}
								value={answers[index] ?? ''}
								onChange={(e) => {
									const next = [...answers];
									next[index] = e.target.value;
									setAnswers(next);
								}}
								placeholder="Your answer…"
								rows={4}
								spellCheck={false}
							/>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* Bottom bar */}
			<div className={styles.bottomBar}>
				<button
					className={styles.navBtn}
					onClick={() => goTo(index - 1, -1)}
					disabled={index === 0}
				>
					<ChevronLeft size={16} /> Prev
				</button>

				<div className={styles.bottomCenter}>
					{isDirty && (
						<button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
							<Save size={13} /> {saving ? 'Saving…' : 'Save'}
						</button>
					)}
				</div>

				<button
					className={styles.navBtn}
					onClick={() => goTo(index + 1, 1)}
					disabled={index === total - 1}
				>
					Next <ChevronRight size={16} />
				</button>
			</div>
		</motion.div>,
		document.body
	);
}
