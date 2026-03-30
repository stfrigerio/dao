import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const apiPort = env.VITE_API_PORT ?? '10001';

	return {
		plugins: [react(), tsconfigPaths()],
		server: {
			port: 5173,
			open: true,
			proxy: {
				'/api': {
					target: `http://localhost:${apiPort}`,
					changeOrigin: true,
				},
				'/uploads': {
					target: `http://localhost:${apiPort}`,
					changeOrigin: true,
				},
			},
		},
		build: {
			outDir: 'build',
			sourcemap: true,
		},
	};
});
