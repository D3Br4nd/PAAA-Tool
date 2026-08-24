import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { constellationAvatarSvg } from '$lib/server/constellation-avatar';
import { isValidLocalAvatarSeed } from '$lib/utils/local-avatar';

export const GET: RequestHandler = ({ params }) => {
	if (!isValidLocalAvatarSeed(params.seed)) {
		throw error(400, 'Invalid avatar seed');
	}

	return new Response(constellationAvatarSvg(params.seed), {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
