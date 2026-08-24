import { db } from '$lib/server/db';
import { events, factions, teams } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { slug } = params;

    // Get event by slug
    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event || !event.isActive) {
        throw error(404, 'Evento non trovato o non attivo');
    }

    // Get all teams for this event (via factions)
    const eventTeams = await db
        .select({
            id: teams.id,
            name: teams.name,
            avatarUrl: teams.avatarUrl,
            color: teams.color,
            factionId: teams.factionId,
            factionName: factions.name,
            factionColor: factions.color,
            factionAvatarUrl: factions.avatarUrl
        })
        .from(teams)
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, event.id))
        .orderBy(teams.name);

    // Check if user is admin
    const isAdmin = locals.user?.role === 'admin';

    return {
        event,
        teams: eventTeams,
        isAdmin
    };
};
