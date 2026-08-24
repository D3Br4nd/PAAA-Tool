import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, teams, events } from '$lib/server/schema';
import { eq, count, sql } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
    // Auth is handled by layout
    const { user } = await parent();

    // Fetch counts
    const [admins] = await db.select({ value: count() }).from(users).where(eq(users.role, 'admin'));
    const [players] = await db.select({ value: count() }).from(users).where(eq(users.role, 'player'));
    const [staff] = await db.select({ value: count() }).from(users).where(eq(users.role, 'staff'));
    const [allTeams] = await db.select({ value: count() }).from(teams);
    const [activeEvents] = await db.select({ value: count() }).from(events).where(eq(events.isActive, true));

    return {
        user,
        stats: {
            admins: admins?.value || 0,
            players: players?.value || 0,
            staff: staff?.value || 0,
            teams: allTeams?.value || 0,
            activeEvents: activeEvents?.value || 0
        }
    };
};
