import { db } from '$lib/server/db';
import { teams, phases, messages, factions, events, macroPhases, codexJanaraPuzzles, geoHunts, geoWaypoints, teamGeoProgress, challenges, teamChallengeCompletions, games, teamGameCompletions } from '$lib/server/schema';
import { eq, or, and, desc, asc, sql, isNull, gt } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ensureMessagesSchema } from '$lib/server/messages';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';

export const load: PageServerLoad = async ({ locals }) => {
    await ensureMessagesSchema();
    await ensureGeoPhaseSchema();

    if (!locals.user) {
        throw redirect(302, '/login?redirectTo=/game');
    }

    if (locals.user.role === 'admin' || locals.user.role === 'staff') {
        return {
            user: locals.user,
            team: {
                id: null,
                name: 'Anteprima Giocatori',
                score: 0,
                avatarUrl: null,
                factionName: locals.user.role === 'admin' ? 'Admin' : 'Staff',
                factionColor: locals.user.role === 'admin' ? '#2563eb' : '#d97706',
                phaseName: 'Modalità anteprima',
                rank: null,
                totalTeams: 0,
                activePhaseName: 'Modalità anteprima'
            },
            messages: [],
            codexLink: null,
            isOperatorPreview: true
        };
    }

    const teamId = locals.user.teamId;
    if (!teamId) {
        throw redirect(302, '/login');
    }

    // Get current team with phase and faction
    const [teamData] = await db
        .select({
            id: teams.id,
            name: teams.name,
            score: teams.scoreCache,
            avatarUrl: teams.avatarUrl,
            factionId: teams.factionId,
            eventId: factions.eventId,
            eventSlug: events.slug,
            factionName: factions.name,
            factionColor: factions.color,
            phaseName: phases.name
        })
        .from(teams)
        .leftJoin(factions, eq(teams.factionId, factions.id))
        .leftJoin(events, eq(factions.eventId, events.id))
        .leftJoin(phases, eq(teams.currentPhaseId, phases.id))
        .where(eq(teams.id, teamId))
        .limit(1);

    let rank: number | null = null;
    let totalTeams = 0;
    let activePhaseName = teamData?.phaseName || null;
    let codexLink: string | null = null;

    if (teamData?.eventId) {
        const leaderboard = await db
            .select({
                id: teams.id,
                score: teams.scoreCache
            })
            .from(teams)
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(eq(factions.eventId, teamData.eventId))
            .orderBy(desc(teams.scoreCache), asc(teams.name));

        totalTeams = leaderboard.length;
        const teamIndex = leaderboard.findIndex((entry) => entry.id === teamId);
        rank = teamIndex >= 0 ? teamIndex + 1 : null;

        if (teamData.id) {
            const [currentTeam] = await db
                .select({ currentPhaseId: teams.currentPhaseId })
                .from(teams)
                .where(eq(teams.id, teamData.id))
                .limit(1);

            if (currentTeam?.currentPhaseId) {
                const [activePhase] = await db
                    .select({
                        phaseName: phases.name,
                        macroPhaseName: macroPhases.name
                    })
                    .from(phases)
                    .innerJoin(macroPhases, eq(phases.macroPhaseId, macroPhases.id))
                    .where(eq(phases.id, currentTeam.currentPhaseId))
                    .limit(1);

                if (activePhase) {
                    activePhaseName = activePhase.macroPhaseName
                        ? `${activePhase.macroPhaseName} - ${activePhase.phaseName}`
                        : activePhase.phaseName;
                }

            }
        }

        const [latestProgramCompletion] = await db
            .select({
                challengeName: challenges.name,
                completedAt: teamChallengeCompletions.completedAt
            })
            .from(teamChallengeCompletions)
            .innerJoin(challenges, eq(teamChallengeCompletions.challengeId, challenges.id))
            .where(and(
                eq(teamChallengeCompletions.teamId, teamId),
                eq(challenges.eventId, teamData.eventId),
                eq(challenges.challengeType, 'program')
            ))
            .orderBy(desc(teamChallengeCompletions.completedAt))
            .limit(1);

        if (latestProgramCompletion) {
            activePhaseName = latestProgramCompletion.challengeName;
        }

        const [latestGameCompletion] = await db
            .select({
                gameName: games.name,
                completedAt: teamGameCompletions.completedAt
            })
            .from(teamGameCompletions)
            .innerJoin(games, eq(teamGameCompletions.gameId, games.id))
            .where(and(
                eq(teamGameCompletions.teamId, teamId),
                eq(games.eventId, teamData.eventId)
            ))
            .orderBy(desc(teamGameCompletions.completedAt))
            .limit(1);

        if (
            latestGameCompletion &&
            Number(latestGameCompletion.completedAt) >= Number(latestProgramCompletion?.completedAt || 0)
        ) {
            activePhaseName = latestGameCompletion.gameName;
        }

        const geoEventHunts = await db
            .select()
            .from(geoHunts)
            .where(eq(geoHunts.eventId, teamData.eventId));
        const activeGeoHunt = geoEventHunts.find((hunt) => !hunt.factionId || hunt.factionId === teamData.factionId);

        if (activeGeoHunt) {
            const waypoints = await db
                .select()
                .from(geoWaypoints)
                .where(eq(geoWaypoints.huntId, activeGeoHunt.id))
                .orderBy(asc(geoWaypoints.sortOrder));
            const progressEntries = await db
                .select()
                .from(teamGeoProgress)
                .where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.huntId, activeGeoHunt.id)));

            if (waypoints.length > 0 && progressEntries.length > 0) {
                const progressMap = new Map(progressEntries.map((p) => [p.waypointId, p]));
                const currentIndex = waypoints.findIndex((wp) => {
                    const p = progressMap.get(wp.id);
                    return !p || (p.status !== 'completed' && p.status !== 'failed' && p.status !== 'photo_submitted');
                });

                if (currentIndex === -1) {
                    activePhaseName = 'Path del Cavaliere - completato';
                } else {
                    const currentWaypoint = waypoints[currentIndex];
                    const progress = progressMap.get(currentWaypoint.id);
                    const prefix = `Path del Cavaliere ${currentIndex + 1}/${waypoints.length}`;
                    activePhaseName =
                        progress?.status === 'photo_submitted'
                            ? `${prefix} - foto in validazione`
                            : progress?.status === 'challenge_active'
                              ? `${prefix} - sfida in corso`
                              : progress?.status === 'arrived'
                                ? `${prefix} - arrivati`
                                : `${prefix} - ricerca GPS`;
                }
            }
        }

        if (teamData.factionId && teamData.eventSlug) {
            const [codexPuzzle] = await db
                .select({ id: codexJanaraPuzzles.id })
                .from(codexJanaraPuzzles)
                .where(and(
                    eq(codexJanaraPuzzles.eventId, teamData.eventId),
                    eq(codexJanaraPuzzles.factionId, teamData.factionId)
                ))
                .orderBy(desc(codexJanaraPuzzles.createdAt))
                .limit(1);

            if (codexPuzzle) {
                codexLink = `/${teamData.eventSlug}/codex-janara/${codexPuzzle.id}`;
            }
        }
    }

    // Get messages for this team (including broadcast) - Only if logged in with credentials
    let teamMessages: any[] = [];
    if (locals.user.authMethod === 'password') {
        teamMessages = await db
            .select()
            .from(messages)
            .where(
                and(
                    or(
                        eq(messages.recipientTeamId, teamId),
                        eq(messages.recipientId, locals.user.id),
                        eq(messages.isBroadcast, true)
                    ),
                    or(
                        isNull(messages.expiresAt),
                        gt(messages.expiresAt, sql`(unixepoch() * 1000)`)
                    )
                )
            )
            .orderBy(desc(messages.sentAt))
            .limit(20);
    }

    return {
        user: locals.user,
        team: {
            ...teamData,
            rank,
            totalTeams,
            activePhaseName
        },
        messages: teamMessages,
        codexLink,
        isOperatorPreview: false
    };
};
