import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return;

	if (locals.user.role === 'player') {
		throw redirect(302, '/game');
	}

	if (locals.user.role === 'staff') {
		throw redirect(302, '/staff');
	}

	throw redirect(302, '/dashboard');
};
