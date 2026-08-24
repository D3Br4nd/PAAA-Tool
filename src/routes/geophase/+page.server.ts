import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { claimGeoPhaseSession } from '$lib/server/geophase-session';
import { loadTeamActivityEventContext } from '$lib/server/event-access';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login?redirectTo=/geophase');
	}
	if (locals.user.role === 'admin') {
		throw redirect(302, '/dashboard/geophase');
	}
	if (locals.user.role === 'staff') {
		throw redirect(302, '/staff');
	}
	if (!locals.user.teamId) {
		throw redirect(302, '/login');
	}

	await loadTeamActivityEventContext(locals);
	await claimGeoPhaseSession(locals);

	return {
		user: locals.user
	};
};
