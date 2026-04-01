import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type Palette = 'red' | 'amber' | 'green' | 'white' | 'blue' | 'red-light' | 'amber-light' | 'green-light' | 'white-light' | 'blue-light';

interface ThemeState {
	palette: Palette;
	setPalette: (palette: Palette) => void;
}

const STORAGE_KEY = 'dao-palette';

function applyPalette(palette: Palette) {
	if (palette === 'amber') {
		document.documentElement.removeAttribute('data-palette');
	} else {
		document.documentElement.setAttribute('data-palette', palette);
	}
}

// Apply immediately at module load (before React renders)
const stored = (localStorage.getItem(STORAGE_KEY) as Palette) || 'amber';
applyPalette(stored);

export const useThemeStore = create<ThemeState>()(
	devtools(
		(set) => ({
			palette: stored,
			setPalette: (palette) => {
				localStorage.setItem(STORAGE_KEY, palette);
				applyPalette(palette);
				set({ palette });
			},
		}),
		{ name: 'ThemeStore' }
	)
);
