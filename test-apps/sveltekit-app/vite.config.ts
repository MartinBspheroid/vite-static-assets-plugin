import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import staticAssets from 'vite-static-assets-plugin';

const baseEnv = process.env.VITE_BASE?.replace(/\/$/, '') || '';
const base = baseEnv ? `${baseEnv}/` : '/';

export default defineConfig({
	base,
	plugins: [sveltekit(), staticAssets({ directory: 'static' })]
});
