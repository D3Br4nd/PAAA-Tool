import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { releaseGeoPhaseSession } from '$lib/server/geophase-session';

export const load: PageServerLoad = async () => {
	// We don't want to show a logout page, just redirect
	throw redirect(302, '/login');
};

export const actions: Actions = {
	default: async ({ cookies, locals }) => {
		await releaseGeoPhaseSession(locals);
		cookies.delete('session', { path: '/' });
		cookies.delete('auth_method', { path: '/' });
		throw redirect(302, '/login');
	}
};
