import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Players go to game, Staff go to staff portal
	if (locals.user.role === 'player') {
		throw redirect(302, '/game');
	}

	if (locals.user.role === 'staff') {
		throw redirect(302, '/staff');
	}

	// Get theme preference from cookie
	const theme = cookies.get('theme') || 'dark';

	return {
		user: {
			id: locals.user.id,
			email: locals.user.email,
			name: locals.user.name,
			avatarUrl: locals.user.avatarUrl,
			role: locals.user.role,
			teamId: locals.user.teamId
		},
		theme
	};
};
