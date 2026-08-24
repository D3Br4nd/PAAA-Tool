import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login?redirectTo=/staff');
    }

    if (locals.user.role !== 'staff' && locals.user.role !== 'admin') {
        throw redirect(302, '/game');
    }

    return {
        user: locals.user
    };
};
