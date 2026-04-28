import adapter from '@sveltejs/adapter-node';

const base = process.env.VITE_BASE?.replace(/\/$/, '') || '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		paths: { base }
	}
};

export default config;
