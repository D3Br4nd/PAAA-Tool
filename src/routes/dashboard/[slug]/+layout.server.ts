import { db } from '$lib/server/db';
import { events } from '$lib/server/schema';
import { error, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals }: { params: any, locals: any }) => {
    if (!locals.user || locals.user.role !== 'admin') {
        throw redirect(302, '/dashboard');
    }

    const { slug } = params;

    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event) {
        throw error(404, 'Evento non trovato');
    }

    return {
        event
    };
};
