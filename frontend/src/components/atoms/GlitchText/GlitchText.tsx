import React, { useEffect, useRef, useState } from 'react';
import styles from './GlitchText.module.css';

interface GlitchState {
	x1: number; y1: number; clip1: string;
	x2: number; y2: number; clip2: string;
	x3: number; clip3: string;
	flicker: boolean;
}

function randomClip() {
	const a = Math.random() * 80;
	const b = a + Math.random() * 20 + 4;
	return `inset(${a}% 0 ${100 - b}% 0)`;
}

function randomState(): GlitchState {
	return {
		x1: Math.random() * 14 - 7, y1: Math.random() * 4 - 2, clip1: randomClip(),
		x2: Math.random() * 14 - 7, y2: Math.random() * 4 - 2, clip2: randomClip(),
		x3: Math.random() * 6 - 3,  clip3: randomClip(),
		flicker: Math.random() < 0.3,
	};
}

interface GlitchTextProps {
	children: React.ReactNode;
	className?: string;
	as?: React.ElementType;
}

export function GlitchText({ children, className, as: Tag = 'span' }: GlitchTextProps) {
	const [active, setActive] = useState(false);
	const [state, setState] = useState<GlitchState>(randomState);
	const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		let intervalId: ReturnType<typeof setInterval>;

		function startGlitch() {
			setActive(true);
			intervalId = setInterval(() => setState(randomState), 50);

			const stop = setTimeout(() => {
				setActive(false);
				clearInterval(intervalId);
				schedule();
			}, 250 + Math.random() * 200);
			timers.current.push(stop);
		}

		function schedule() {
			const t = setTimeout(startGlitch, Math.random() * 3000 + 1500);
			timers.current.push(t);
		}

		schedule();

		return () => {
			timers.current.forEach(clearTimeout);
			clearInterval(intervalId);
		};
	}, []);

	return (
		<Tag className={`${styles.wrapper} ${className ?? ''}`}>
			<span className={`${styles.base} ${active && state.flicker ? styles.flicker : ''}`}>
				{children}
			</span>
			{active && (
				<>
					<span
						className={`${styles.layer} ${styles.layerPrimary}`}
						style={{
							transform: `translate(${state.x1}px, ${state.y1}px)`,
							clipPath: state.clip1,
						}}
						aria-hidden
					>
						{children}
					</span>
					<span
						className={`${styles.layer} ${styles.layerCut}`}
						style={{
							transform: `translate(${state.x2}px, ${state.y2}px)`,
							clipPath: state.clip2,
						}}
						aria-hidden
					>
						{children}
					</span>
					<span
						className={`${styles.layer} ${styles.layerDark}`}
						style={{
							transform: `translate(${state.x3}px, 0px)`,
							clipPath: state.clip3,
						}}
						aria-hidden
					>
						{children}
					</span>
				</>
			)}
		</Tag>
	);
}
