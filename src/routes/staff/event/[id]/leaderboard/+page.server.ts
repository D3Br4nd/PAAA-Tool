import { db } from '$lib/server/db';
import { teams, factions } from '$lib/server/schema';
import { eq, desc, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { ensureStaff } from '$lib/server/auth';

export const load: PageServerLoad = async ({ params, locals }: any) => {
    ensureStaff(locals);

    const eventId = params.id;

    // Fetch all teams for THIS event with their cached score
    const allTeams = await db
        .select({
            id: teams.id,
            name: teams.name,
            score: teams.scoreCache,
            avatarUrl: teams.avatarUrl,
            factionName: factions.name,
            factionColor: factions.color,
            factionId: factions.id
        })
        .from(teams)
        .leftJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, eventId))
        .orderBy(desc(teams.scoreCache), asc(teams.name));

    // Calculate faction totals for THIS event
    const factionTotalsRaw = await db
        .select({
            name: factions.name,
            color: factions.color,
            id: factions.id
        })
        .from(factions)
        .where(eq(factions.eventId, eventId));

    const factionTotals = factionTotalsRaw.map((f: any) => {
        const teamPoints = allTeams
            .filter((t: any) => t.factionId === f.id)
            .reduce((sum: number, t: any) => sum + (t.score || 0), 0);
        return {
            ...f,
            totalPoints: teamPoints
        };
    }).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

    return {
        teams: allTeams,
        factionTotals,
        eventId
    };
};
