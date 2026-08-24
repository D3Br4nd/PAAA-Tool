import { db } from '$lib/server/db';
import { scoreLedger, teams, challenges, games, users, factions, teamChallengeCompletions, teamGameCompletions } from '$lib/server/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { ensureStaff } from '$lib/server/auth';
import { assertStaffCanAccessLedgerEntry } from '$lib/server/staff-access';

export const load: PageServerLoad = async ({ params, locals }: any) => {
    ensureStaff(locals);

    const eventId = params.id;

    const programEntries = await db
        .select({
            id: scoreLedger.id,
            points: scoreLedger.points,
            description: scoreLedger.description,
            createdAt: scoreLedger.createdAt,
            teamName: teams.name,
            challengeName: challenges.name,
            judgeName: users.name
        })
        .from(scoreLedger)
        .leftJoin(teams, eq(scoreLedger.teamId, teams.id))
        .leftJoin(challenges, eq(scoreLedger.challengeId, challenges.id))
        .leftJoin(users, eq(scoreLedger.judgeUserId, users.id))
        .where(eq(challenges.eventId, eventId))
        .orderBy(desc(scoreLedger.createdAt))
        .limit(100);
    const gameEntries = await db
        .select({
            id: scoreLedger.id,
            points: scoreLedger.points,
            description: scoreLedger.description,
            createdAt: scoreLedger.createdAt,
            teamName: teams.name,
            challengeName: games.name,
            judgeName: users.name
        })
        .from(scoreLedger)
        .leftJoin(teams, eq(scoreLedger.teamId, teams.id))
        .leftJoin(games, eq(scoreLedger.gameId, games.id))
        .leftJoin(users, eq(scoreLedger.judgeUserId, users.id))
        .where(eq(games.eventId, eventId))
        .orderBy(desc(scoreLedger.createdAt))
        .limit(100);
    const adjustmentEntries = await db
        .select({
            id: scoreLedger.id,
            points: scoreLedger.points,
            description: scoreLedger.description,
            createdAt: scoreLedger.createdAt,
            teamName: teams.name,
            challengeName: sql<string>`'Correzione manuale'`,
            judgeName: users.name
        })
        .from(scoreLedger)
        .innerJoin(teams, eq(scoreLedger.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .leftJoin(users, eq(scoreLedger.judgeUserId, users.id))
        .where(and(
            eq(factions.eventId, eventId),
            eq(scoreLedger.eventType, 'adjustment'),
            sql`json_extract(${scoreLedger.metadata}, '$.source') = 'manual_score_adjustment'`
        ))
        .orderBy(desc(scoreLedger.createdAt))
        .limit(100);
    const entries = [...programEntries, ...gameEntries, ...adjustmentEntries]
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
        .slice(0, 100);

    return { entries, eventId };
};

export const actions: Actions = {
    deleteEntry: async ({ request, locals, params }) => {
        ensureStaff(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) return fail(400, { message: 'ID mancante' });

        // Without this, any staff member can delete any ledger entry in the
        // system, including other factions' and other events'.
        await assertStaffCanAccessLedgerEntry(locals, id, params.id);

        await db.transaction(async (tx: any) => {
            const [entry] = await tx.select().from(scoreLedger).where(eq(scoreLedger.id, id)).limit(1);
            if (!entry) return;

            // 1. Revert team score cache
            await tx.update(teams)
                .set({
                    scoreCache: sql`score_cache - ${entry.points}`
                })
                .where(eq(teams.id, entry.teamId));

            // 2. Revert challenge completion points if applicable
            if (entry.challengeId) {
                await tx.update(teamChallengeCompletions)
                    .set({
                        totalPoints: sql`total_points - ${entry.points}`
                    })
                    .where(and(
                        eq(teamChallengeCompletions.teamId, entry.teamId),
                        eq(teamChallengeCompletions.challengeId, entry.challengeId)
                    ));
            }
            if (entry.gameId) {
                await tx.update(teamGameCompletions)
                    .set({
                        totalPoints: sql`total_points - ${entry.points}`
                    })
                    .where(and(
                        eq(teamGameCompletions.teamId, entry.teamId),
                        eq(teamGameCompletions.gameId, entry.gameId)
                    ));
            }

            // 3. Delete the entry
            await tx.delete(scoreLedger).where(eq(scoreLedger.id, id));
        });

        return { success: true };
    }
};
