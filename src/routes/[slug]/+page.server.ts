import { db } from '$lib/server/db';
import { events, factions, teams, users, challenges, teamChallengeCompletions, games, teamGameCompletions, geoHunts, geoWaypoints, teamGeoProgress } from '$lib/server/schema';
import { error } from '@sveltejs/kit';
import { and, eq, sql, asc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import {
	buildPublicProgramCompletions,
	publicGameCompletionName
} from '$lib/public-completions';

export const load: PageServerLoad = async ({ params }) => {
    await ensureGeoPhaseSchema();
    const { slug } = params;

    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event || !event.isActive) {
        throw error(404, 'Evento non trovato o non attivo');
    }

    // Get stats: faction count and team count
    const [statsResult] = await db
        .select({
            factionCount: sql<number>`count(distinct ${factions.id})`,
            teamCount: sql<number>`count(distinct ${teams.id})`,
            staffCount: sql<number>`(select count(*) from ${users} where role = 'staff')`
        })
        .from(factions)
        .leftJoin(teams, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, event.id));

    // Get real player count (users in teams belonging to factions of this event)
    const [playerResult] = await db
        .select({
            count: sql<number>`count(distinct ${users.id})`
        })
        .from(users)
        .innerJoin(teams, eq(users.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, event.id));

    // Get faction types for display
    const types = await db
        .select({ type: factions.factionType })
        .from(factions)
        .where(eq(factions.eventId, event.id))
        .groupBy(factions.factionType);

    const factionTypes = types.map(t => t.type).filter(Boolean) as string[];
    // If only one type exists in this event, use it as label, else fallback to "Fazioni"
    const factionLabel = factionTypes.length === 1 ? factionTypes[0] : "Fazioni";

    // Get top teams for leaderboard
    // Get top teams for leaderboard
    const eventLeaderboard = await db
        .select({
            name: teams.name,
            avatarUrl: teams.avatarUrl,
            score: teams.scoreCache,
            factionName: factions.name,
            factionColor: factions.color,
            factionId: factions.id,
			teamId: teams.id
        })
        .from(teams)
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, event.id))
        .orderBy(sql`${teams.scoreCache} DESC`, teams.name);

    // Calculate faction scores
    const factionScores = new Map<string, { name: string; color: string; avatarUrl: string | null; score: number; topTeams: any[] }>();

    // Initialize with all factions
    const allFactions = await db
        .select({
            id: factions.id,
            name: factions.name,
            color: factions.color,
            avatarUrl: factions.avatarUrl
        })
        .from(factions)
        .where(eq(factions.eventId, event.id));

    allFactions.forEach(f => {
        factionScores.set(f.id, {
            name: f.name,
            color: f.color || '#000000',
            avatarUrl: f.avatarUrl,
            score: 0,
            topTeams: []
        });
    });

    // Sum team scores and collect top teams
    eventLeaderboard.forEach(team => {
        if (team.factionId && factionScores.has(team.factionId)) {
            const f = factionScores.get(team.factionId)!;
            f.score += team.score || 0;

            // Add to teams list if we have less than 3 or if this could be a candidate (we'll sort later)
            // Actually, eventLeaderboard is already sorted by score DESC.
            // So the first encountered teams for a faction ARE the top teams.
            if (f.topTeams.length < 3) {
                f.topTeams.push({
                    name: team.name,
                    score: team.score,
                    avatarUrl: team.avatarUrl
                });
            }
        }
    });

    const factionLeaderboard = Array.from(factionScores.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.score - a.score)
        .map((f, i) => ({ ...f, rank: i + 1 }));

	const publicProgramDefinitions = await db
		.select({ id: challenges.id, code: challenges.code })
		.from(challenges)
		.where(and(
			eq(challenges.eventId, event.id),
			eq(challenges.challengeType, 'program'),
			sql`upper(${challenges.code}) IN ('SCRIBA', 'ARCHITETTO')`
		));

	const eventCompletions = await db
        .select({
            teamId: teamChallengeCompletions.teamId,
            challengeId: teamChallengeCompletions.challengeId,
			totalPoints: teamChallengeCompletions.totalPoints,
            completedAt: teamChallengeCompletions.completedAt
        })
        .from(teamChallengeCompletions)
        .innerJoin(challenges, eq(teamChallengeCompletions.challengeId, challenges.id))
        .where(and(eq(challenges.eventId, event.id), eq(challenges.challengeType, 'program')));

    type CompletedActivity = {
        key: string;
        name: string;
        completedAt: number;
    };
    const completedActivitiesByTeam = new Map<string, CompletedActivity[]>();
    const addCompletedActivity = (teamId: string, activity: CompletedActivity) => {
        const current = completedActivitiesByTeam.get(teamId) || [];
        const existingIndex = current.findIndex((item) => item.key === activity.key);
        if (existingIndex >= 0) {
			if (activity.completedAt >= current[existingIndex].completedAt) {
				current[existingIndex] = activity;
			}
        } else {
            current.push(activity);
        }
        completedActivitiesByTeam.set(teamId, current);
    };

	for (const activity of buildPublicProgramCompletions(publicProgramDefinitions, eventCompletions)) {
		addCompletedActivity(activity.teamId, activity);
	}

    const latestGameRows = await db
        .select({
            teamId: teamGameCompletions.teamId,
            gameId: teamGameCompletions.gameId,
			gameCode: games.code,
            completedAt: teamGameCompletions.completedAt
        })
        .from(teamGameCompletions)
        .innerJoin(games, eq(teamGameCompletions.gameId, games.id))
        .where(eq(games.eventId, event.id));

    for (const row of latestGameRows) {
		const publicName = publicGameCompletionName(row.gameCode);
		if (!publicName) continue;
        const completedAt = Number(row.completedAt);
        addCompletedActivity(row.teamId, {
			key: `game:${row.gameCode.trim().toLowerCase()}`,
			name: publicName,
            completedAt
        });
    }

    const geoEventHunts = await db
        .select()
        .from(geoHunts)
        .where(eq(geoHunts.eventId, event.id));

    for (const hunt of geoEventHunts) {
        const huntWaypoints = await db
            .select()
            .from(geoWaypoints)
            .where(eq(geoWaypoints.huntId, hunt.id))
            .orderBy(asc(geoWaypoints.sortOrder));

        if (huntWaypoints.length === 0) continue;

        const huntTeams = eventLeaderboard.filter((team) => !hunt.factionId || team.factionId === hunt.factionId);
        for (const team of huntTeams) {
            const progressEntries = await db
                .select()
                .from(teamGeoProgress)
                .where(and(eq(teamGeoProgress.teamId, team.teamId), eq(teamGeoProgress.huntId, hunt.id)));
            if (progressEntries.length === 0) continue;

            const progressMap = new Map(progressEntries.map((p) => [p.waypointId, p]));
            const currentIndex = huntWaypoints.findIndex((wp) => {
                const p = progressMap.get(wp.id);
                return !p || (p.status !== 'completed' && p.status !== 'failed' && p.status !== 'photo_submitted');
            });

            if (currentIndex === -1) {
                const completedAt = Math.max(
                    ...progressEntries.map((progress) =>
                        Number(progress.completedAt || progress.updatedAt || progress.createdAt)
                    )
                );
                addCompletedActivity(team.teamId, {
					key: 'program:cavaliere',
                    name: 'Path del Cavaliere',
                    completedAt
                });
            }
        }
    }

    return {
        event,
        stats: {
            factions: statsResult?.factionCount || 0,
            teams: statsResult?.teamCount || 0,
            players: playerResult?.count || 0,
            staff: statsResult?.staffCount || 0,
            factionLabel
        },
        leaderboard: eventLeaderboard.map((t, i) => {
            const completedActivities = (completedActivitiesByTeam.get(t.teamId) || [])
                .sort((a, b) => a.completedAt - b.completedAt)
                .map(({ name, completedAt }) => ({ name, completedAt }));

            return {
                id: t.teamId,
                rank: i + 1,
                team: t.name,
                avatarUrl: t.avatarUrl,
                faction: t.factionName,
                factionColor: t.factionColor,
                score: t.score,
                completedActivities
            };
        }),
        factionLeaderboard
    };
};
