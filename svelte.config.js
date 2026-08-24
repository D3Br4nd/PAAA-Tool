import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  onwarn: (warning, handler) => {
    // Ignore a11y warnings
    if (warning.code.startsWith('a11y-')) return;
    handler(warning);
  },
  kit: {
    adapter: adapter(),
    // CSRF protection enabled (default origin check) with the public URL
    // whitelisted in case ORIGIN is misconfigured behind the reverse proxy.
    csrf: {
      trustedOrigins: ['https://paaa.prolocoventicano.com']
    },
    // SvelteKit generates the CSP header on HTML responses and injects a nonce
    // into its own inline hydration script, so script-src stays nonce-based.
    //
    // style-src deliberately keeps 'unsafe-inline': Svelte emits inline style
    // attributes and Tailwind injects a style element, and a nonce would make
    // the browser ignore 'unsafe-inline' and break both. Keeping it here also
    // tells SvelteKit not to add a style nonce at all (see needs_csp in
    // @sveltejs/kit page/csp.js).
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        // wasm-unsafe-eval is required by @sqlite.org/sqlite-wasm (offline DB).
        'script-src': ['self', 'wasm-unsafe-eval'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
        // blob: is used for client-side photo previews before upload.
        'img-src': ['self', 'data:', 'blob:', 'https://www.transparenttextures.com'],
        'connect-src': ['self'],
        'worker-src': ['self', 'blob:'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'frame-ancestors': ['none']
      }
    }
  }
};

export default config;
