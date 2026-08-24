import { db } from '$lib/server/db';
import { events, challenges, challengeSteps, games, scoreLedger, teams, macroPhases, phases, eventTimers, factions, teamChallengeCompletions, teamGameCompletions, activityLogs } from '$lib/server/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { ensureStaff } from '$lib/server/auth';
import { assertStaffCanAccessTeam } from '$lib/server/staff-access';
import { uuidv7 } from 'uuidv7';
import { cancelGameCompletion } from '$lib/server/cancel-game-completion';

export const load: PageServerLoad = async ({ params, locals }: any) => {
    ensureStaff(locals);

    const eventId = params.id;

    // Load event with hierarchical macro-phases and phases
    const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        with: {
            macroPhases: {
                orderBy: (mp: any, { asc }: any) => [asc(mp.sortOrder)],
                with: {
                    phases: {
                        orderBy: (p: any, { asc }: any) => [asc(p.sortOrder)]
                    }
                }
            }
        }
    });

    if (!event) {
        throw error(404, 'Evento non trovato');
    }

    // Load current timer for this event (if any)
    const activeTimer = await db.query.eventTimers.findFirst({
        where: eq(eventTimers.eventId, eventId),
        orderBy: (et: any, { desc }: any) => [desc(et.updatedAt)]
    });

    // Get program challenges and standalone games for this event
    const programChallenges = await db
        .select()
        .from(challenges)
        .where(and(eq(challenges.eventId, eventId), eq(challenges.challengeType, 'program')))
        .orderBy(challenges.sortOrder);
    const programChallengeIds = programChallenges.map(challenge => challenge.id);
    const programSteps = programChallengeIds.length > 0
        ? await db
            .select()
            .from(challengeSteps)
            .where(inArray(challengeSteps.challengeId, programChallengeIds))
            .orderBy(challengeSteps.stepOrder)
        : [];
    const eventGames = await db
        .select()
        .from(games)
        .where(eq(games.eventId, eventId))
        .orderBy(games.sortOrder);
    const eventChallenges = [
        ...programChallenges.map(c => ({
            ...c,
            challengeType: 'program' as const,
            steps: programSteps.filter(step => step.challengeId === c.id)
        })),
        ...eventGames.map(g => ({ ...g, phaseId: null, challengeType: 'game' as const }))
    ];

    // Get recent activity for THIS event
    const programActivity = await db
        .select({
            id: teamChallengeCompletions.id,
            points: teamChallengeCompletions.totalPoints,
            description: sql<string | null>`NULL`,
            teamName: teams.name,
            challengeName: challenges.name,
            createdAt: teamChallengeCompletions.completedAt
        })
        .from(teamChallengeCompletions)
        .innerJoin(teams, eq(teamChallengeCompletions.teamId, teams.id))
        .innerJoin(challenges, eq(teamChallengeCompletions.challengeId, challenges.id))
        .where(eq(challenges.eventId, eventId))
        .orderBy(desc(teamChallengeCompletions.completedAt))
        .limit(5);
    const gameActivity = await db
        .select({
            id: teamGameCompletions.id,
            points: teamGameCompletions.totalPoints,
            description: sql<string | null>`NULL`,
            teamName: teams.name,
            challengeName: games.name,
            createdAt: teamGameCompletions.completedAt
        })
        .from(teamGameCompletions)
        .innerJoin(teams, eq(teamGameCompletions.teamId, teams.id))
        .innerJoin(games, eq(teamGameCompletions.gameId, games.id))
        .where(eq(games.eventId, eventId))
        .orderBy(desc(teamGameCompletions.completedAt))
        .limit(5);
    const adjustmentActivity = await db
        .select({
            id: scoreLedger.id,
            points: scoreLedger.points,
            description: scoreLedger.description,
            teamName: teams.name,
            challengeName: sql<string>`'Correzione manuale'`,
            createdAt: scoreLedger.createdAt
        })
        .from(scoreLedger)
        .innerJoin(teams, eq(scoreLedger.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(and(
            eq(factions.eventId, eventId),
            eq(scoreLedger.eventType, 'adjustment'),
            sql`json_extract(${scoreLedger.metadata}, '$.source') = 'manual_score_adjustment'`
        ))
        .orderBy(desc(scoreLedger.createdAt))
        .limit(5);
    const recentActivity = [...programActivity, ...gameActivity, ...adjustmentActivity]
        .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
        .slice(0, 5);

    // Fetch all teams for this event
    const allTeams = await db
        .select({
            id: teams.id,
            name: teams.name,
            factionId: teams.factionId,
            currentPhaseId: teams.currentPhaseId,
            color: teams.color,
            avatarUrl: teams.avatarUrl
        })
        .from(teams)
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, eventId));

    // Determine completion status for each challenge
    // A challenge is "completed" if all teams in the event have completed it.
    const eventTeamIds = allTeams.map(team => team.id);

    const challengeCompletionStatus: Record<string, boolean> = {};

    if (eventTeamIds.length > 0) {
        for (const ch of eventChallenges) {
            const completions = ch.challengeType === 'game' ? await db
                .select({ count: sql`count(*)` })
                .from(teamGameCompletions)
                .where(
                    and(
                        eq(teamGameCompletions.gameId, ch.id),
                        inArray(teamGameCompletions.teamId, eventTeamIds)
                    )
                ) : await db
                .select({ count: sql`count(*)` })
                .from(teamChallengeCompletions)
                .where(
                    and(
                        eq(teamChallengeCompletions.challengeId, ch.id),
                        inArray(teamChallengeCompletions.teamId, eventTeamIds)
                    )
                );

            const count = Number((completions[0] as any)?.count || 0);
            challengeCompletionStatus[ch.id] = count >= eventTeamIds.length;
        }
    }

    // Fetch game completions for this event
    const gameIds = eventGames.map(g => g.id);
    const gameCompletions = (gameIds.length > 0 && eventTeamIds.length > 0)
        ? await db
            .select({
                id: teamGameCompletions.id,
                gameId: teamGameCompletions.gameId,
                teamId: teamGameCompletions.teamId,
                teamName: teams.name,
                factionName: factions.name,
                factionColor: factions.color,
                totalPoints: teamGameCompletions.totalPoints,
                completedAt: teamGameCompletions.completedAt
            })
            .from(teamGameCompletions)
            .innerJoin(teams, eq(teamGameCompletions.teamId, teams.id))
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(
                and(
                    inArray(teamGameCompletions.gameId, gameIds),
                    inArray(teamGameCompletions.teamId, eventTeamIds)
                )
            )
            .orderBy(desc(teamGameCompletions.completedAt))
        : [];

    return {
        event: event as any,
        challenges: eventChallenges,
        recentActivity,
        activeTimer,
        allTeams,
        challengeCompletionStatus,
        gameCompletions
    };
};

export const actions: Actions = {
    cancelGameCompletion: async ({ request, locals, params }: any) => {
        ensureStaff(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { message: 'ID mancante' });

        const [completion] = await db
            .select()
            .from(teamGameCompletions)
            .where(eq(teamGameCompletions.id, id))
            .limit(1);

        if (!completion) return fail(404, { message: 'Completamento non trovato' });

        await assertStaffCanAccessTeam(locals, completion.teamId, params.id);

        await cancelGameCompletion(id);

        return { success: true };
    }
};
