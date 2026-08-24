import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	claimGeoPhaseSession,
	releaseGeoPhaseSession
} from '$lib/server/geophase-session';

export const POST: RequestHandler = async ({ locals }) => {
	await claimGeoPhaseSession(locals);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ locals }) => {
	await releaseGeoPhaseSession(locals);
	return json({ success: true });
};
