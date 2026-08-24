import { db } from '$lib/server/db';
import { events } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { ensureStaff } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
    ensureStaff(locals);

    // Load active events for staff to select
    const activeEvents = await db
        .select()
        .from(events)
        .where(eq(events.isActive, true))
        .orderBy(events.name);

    return {
        events: activeEvents
    };
};
