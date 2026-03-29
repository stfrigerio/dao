import React, { useEffect, useRef, useState } from 'react';

const CHARS = '0123456789';

interface DecryptTextProps {
	children: string;
	className?: string;
	as?: React.ElementType;
	/** ms before the animation starts on mount */
	delay?: number;
	/** ms to spend scrambling each character before it resolves */
	scrambleDuration?: number;
}

export function DecryptText({
	children,
	className,
	as: Tag = 'span',
	delay = 0,
	scrambleDuration = 25,
}: DecryptTextProps) {
	const target = children;
	const [display, setDisplay] = useState(target);
	const frame = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		const resolved = new Array(target.length).fill(false);
		let iteration = 0;

		function tick() {
			setDisplay(
				target
					.split('')
					.map((char, i) => {
						if (char === ' ') return ' ';
						if (resolved[i]) return char;
						return CHARS[Math.floor(Math.random() * CHARS.length)];
					})
					.join('')
			);

			// Resolve one more character each N ticks
			const resolveAt = Math.floor(iteration / 7);
			if (resolveAt < target.length) {
				for (let i = 0; i <= resolveAt; i++) resolved[i] = true;
			}

			iteration++;

			if (resolved.every(Boolean)) {
				clearInterval(frame.current!);
				setDisplay(target);
			}
		}

		const start = setTimeout(() => {
			frame.current = setInterval(tick, scrambleDuration);
		}, delay);

		return () => {
			clearTimeout(start);
			if (frame.current) clearInterval(frame.current);
		};
	}, [target, delay, scrambleDuration]);

	return <Tag className={className}>{display}</Tag>;
}
