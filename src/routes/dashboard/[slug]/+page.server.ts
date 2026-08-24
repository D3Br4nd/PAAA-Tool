import { db } from '$lib/server/db';
import { events, factions, teams, users, phases, activityLogs, challenges, challengeSteps, games, gameSteps, macroPhases, scoreLedger, teamChallengeCompletions, teamGameCompletions, codexJanaraPuzzles, codexDecodeLog, phaseThreeScores, phaseFourProgress, geoHunts, geoWaypoints, teamGeoProgress } from '$lib/server/schema';
import type { ChallengeConfig, StepScoringRule } from '$lib/server/schema';
import { error, fail } from '@sveltejs/kit';
import { eq, sql, and, desc } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { uuidv7 } from 'uuidv7';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCipheriv, randomBytes, createHash } from 'node:crypto';
import { ensureAdmin } from '$lib/server/auth';
import { readValidatedImage } from '$lib/server/uploads';
import { ensureCodexSchema, deriveCodexKey } from '$lib/server/codex';
import { ensurePhaseThreeSchema } from '$lib/server/phase-three';
import { ensurePhaseFourSchema } from '$lib/server/phase-four';
import { buildPhaseOneTimeRows } from '$lib/phase-one-times';
import { buildGameTimeRanking } from '$lib/game-time-ranking';
import { FLAG_SCORING_VERSION } from '$lib/flag-scoring';

const AVATAR_DIR = '/app/uploads/faction_avatars';
const programScoringTypes = ['checklist', 'attempt_based'] as const;
const gameScoringTypes = ['timed_obstacle'] as const;
const programCodes = ['SCRIBA', 'ARCHITETTO'] as const;

async function loadPhaseOneTimeRows(eventId: string) {
    const [phaseTeams, phaseChallenges, phaseCompletions, hunts, bonusRows] = await Promise.all([
        db
            .select({
                id: teams.id,
                name: teams.name,
                factionId: factions.id,
                factionName: factions.name,
                factionColor: factions.color
            })
            .from(teams)
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(eq(factions.eventId, eventId)),
        db
            .select({ id: challenges.id, code: challenges.code })
            .from(challenges)
            .where(and(
                eq(challenges.eventId, eventId),
                eq(challenges.challengeType, 'program'),
                sql`upper(${challenges.code}) IN ('SCRIBA', 'ARCHITETTO')`
            )),
        db
            .select({
                teamId: teamChallengeCompletions.teamId,
                challengeId: teamChallengeCompletions.challengeId,
				totalPoints: teamChallengeCompletions.totalPoints,
				completedAt: teamChallengeCompletions.completedAt
            })
            .from(teamChallengeCompletions)
            .innerJoin(challenges, eq(teamChallengeCompletions.challengeId, challenges.id))
            .where(and(
                eq(challenges.eventId, eventId),
                eq(challenges.challengeType, 'program'),
                sql`upper(${challenges.code}) IN ('SCRIBA', 'ARCHITETTO')`
            )),
        db
            .select({ id: geoHunts.id, factionId: geoHunts.factionId })
            .from(geoHunts)
            .where(eq(geoHunts.eventId, eventId)),
        db
            .select({
                teamId: scoreLedger.teamId,
                points: sql<number>`coalesce(sum(${scoreLedger.points}), 0)`
            })
            .from(scoreLedger)
            .innerJoin(teams, eq(scoreLedger.teamId, teams.id))
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(
                eq(factions.eventId, eventId),
                sql`json_extract(${scoreLedger.metadata}, '$.source') = 'phase_completion_time_bonus'`,
                sql`json_extract(${scoreLedger.metadata}, '$.phaseKey') = 'phase1'`
            ))
            .groupBy(scoreLedger.teamId)
    ]);

    const huntIds = hunts.map((hunt) => hunt.id);
    const [waypoints, geoProgress] = huntIds.length > 0
        ? await Promise.all([
            db
                .select({
                    id: geoWaypoints.id,
                    huntId: geoWaypoints.huntId,
                    challengeType: geoWaypoints.challengeType
                })
                .from(geoWaypoints)
                .where(sql`${geoWaypoints.huntId} IN (${sql.join(huntIds.map((id) => sql`${id}`), sql`, `)})`),
            db
                .select({
                    teamId: teamGeoProgress.teamId,
                    huntId: teamGeoProgress.huntId,
                    waypointId: teamGeoProgress.waypointId,
                    status: teamGeoProgress.status,
                    completedAt: teamGeoProgress.completedAt,
                    updatedAt: teamGeoProgress.updatedAt
                })
                .from(teamGeoProgress)
                .where(sql`${teamGeoProgress.huntId} IN (${sql.join(huntIds.map((id) => sql`${id}`), sql`, `)})`)
        ])
        : [[], []];

    return buildPhaseOneTimeRows({
        teams: phaseTeams,
        challenges: phaseChallenges,
        completions: phaseCompletions,
        hunts,
        waypoints,
        geoProgress,
        extraPointsByTeam: new Map(bonusRows.map((row) => [row.teamId, Number(row.points) || 0]))
    });
}

async function loadTriptychTimeRows(eventId: string) {
    const triptychGames = await db
        .select({ id: games.id, name: games.name })
        .from(games)
        .where(and(eq(games.eventId, eventId), sql`upper(${games.code}) = 'TRITTICO'`));
    const gameIds = triptychGames.map((game) => game.id);
    if (gameIds.length === 0) return [];

    const [completions, ledgerRows, bonusRows] = await Promise.all([
        db
            .select({
                gameId: teamGameCompletions.gameId,
                teamId: teamGameCompletions.teamId,
                teamName: teams.name,
                factionId: factions.id,
                factionName: factions.name,
                factionColor: factions.color,
                completedAt: teamGameCompletions.completedAt,
                totalPoints: teamGameCompletions.totalPoints,
                metadata: teamGameCompletions.metadata
            })
            .from(teamGameCompletions)
            .innerJoin(teams, eq(teamGameCompletions.teamId, teams.id))
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(
                eq(factions.eventId, eventId),
                sql`${teamGameCompletions.gameId} IN (${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)})`
            )),
        db
            .select({
                gameId: scoreLedger.gameId,
                teamId: scoreLedger.teamId,
                metadata: scoreLedger.metadata,
                createdAt: scoreLedger.createdAt
            })
            .from(scoreLedger)
            .where(sql`${scoreLedger.gameId} IN (${sql.join(gameIds.map((id) => sql`${id}`), sql`, `)})`)
            .orderBy(desc(scoreLedger.createdAt)),
        db
            .select({
                teamId: scoreLedger.teamId,
                gameId: sql<string>`json_extract(${scoreLedger.metadata}, '$.gameId')`,
                points: sql<number>`coalesce(sum(${scoreLedger.points}), 0)`
            })
            .from(scoreLedger)
            .innerJoin(teams, eq(scoreLedger.teamId, teams.id))
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(
                eq(factions.eventId, eventId),
                sql`json_extract(${scoreLedger.metadata}, '$.source') = 'game_completion_time_bonus'`,
                sql`json_extract(${scoreLedger.metadata}, '$.rankingKey') = 'triptych'`
            ))
            .groupBy(scoreLedger.teamId, sql`json_extract(${scoreLedger.metadata}, '$.gameId')`)
    ]);

    const gameNameById = new Map(triptychGames.map((game) => [game.id, game.name]));
    const normalized = completions.map((completion) => {
        const completionMetadata = (completion.metadata || {}) as any;
        const ledgerEntry = ledgerRows.find((entry) => {
            if (entry.gameId !== completion.gameId || entry.teamId !== completion.teamId) return false;
            const metadata = (entry.metadata || {}) as any;
            return metadata.elapsedSeconds !== undefined;
        });
        const ledgerMetadata = (ledgerEntry?.metadata || {}) as any;

        return {
            gameId: completion.gameId,
            gameName: gameNameById.get(completion.gameId) || 'Il Trittico del Templare',
            teamId: completion.teamId,
            teamName: completion.teamName,
            factionId: completion.factionId,
            factionName: completion.factionName,
            factionColor: completion.factionColor,
            completedAt: completion.completedAt,
            elapsedSeconds: completionMetadata.elapsedSeconds ?? ledgerMetadata.elapsedSeconds,
            totalPoints: completion.totalPoints
        };
    });

    return buildGameTimeRanking(
        normalized,
        new Map(bonusRows.map((row) => [`${row.gameId}:${row.teamId}`, Number(row.points) || 0]))
    );
}

function buildPhasedGameConfig(formData: FormData): ChallengeConfig {
    const timerMinutes = Math.max(1, parseInt(formData.get('timerMinutes') as string) || 5);
    let submittedSteps: unknown = [];
    try {
        submittedSteps = JSON.parse((formData.get('phasedGameSteps') as string) || '[]');
    } catch {
        submittedSteps = [];
    }

    const steps = (Array.isArray(submittedSteps) ? submittedSteps : [])
        .slice(0, 50)
        .map((step, index) => ({
            name: String(step?.name || '').trim() || `Step ${index + 1}`
        }));

    return {
        mode: 'phased_game',
        timeLimitSeconds: timerMinutes * 60,
        phasedGame: {
            steps: steps.length > 0
                ? steps
                : [{ name: 'Step 1' }, { name: 'Step 2' }, { name: 'Step 3' }]
        }
    };
}

function buildFlagStandardConfig(formData: FormData): ChallengeConfig {
    const timerMinutes = Math.max(1, parseInt(formData.get('flagTimerMinutes') as string) || 3);
    return {
        mode: 'flag_standard',
        timeLimitSeconds: timerMinutes * 60,
        flagStandard: {
            scoringVersion: FLAG_SCORING_VERSION,
            carrierHitLabel: ((formData.get('carrierHitLabel') as string) || 'Portatore colpito').trim(),
            pointsPerHit: Math.max(0, parseInt(formData.get('flagPointsPerHit') as string) || 10),
            attackerBand1Points: Math.max(0, parseInt(formData.get('attackerBand1Points') as string) || 50),
            attackerBand2Points: Math.max(0, parseInt(formData.get('attackerBand2Points') as string) || 100),
            attackerSpawnPoints: Math.max(0, parseInt(formData.get('attackerSpawnPoints') as string) || 150),
            maxCarrierHits: Math.max(1, parseInt(formData.get('maxCarrierHits') as string) || 7),
            maxHitPoints: Math.max(0, parseInt(formData.get('maxHitPoints') as string) || 70)
        }
    } as ChallengeConfig;
}

function buildGameConfig(formData: FormData): ChallengeConfig {
    return formData.get('gameMode') === 'flag_standard'
        ? buildFlagStandardConfig(formData)
        : buildPhasedGameConfig(formData);
}

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

export const load: PageServerLoad = async ({ params, parent }: { params: { slug: string }, parent: any }) => {
    await ensureCodexSchema();
    await ensurePhaseThreeSchema();
    await ensurePhaseFourSchema();
    // Parent load provides the 'event'
    const { event } = await parent();

    // Fetch all factions for THIS event
    const allFactions = await db
        .select({
            id: factions.id,
            eventId: factions.eventId,
            name: factions.name,
            color: factions.color,
            icon: factions.icon,
            avatarUrl: factions.avatarUrl,
            description: factions.description,
            factionType: factions.factionType,
            createdAt: factions.createdAt,
            updatedAt: factions.updatedAt
        })
        .from(factions)
        .where(eq(factions.eventId, event.id))
        .orderBy(factions.name);

    // Fetch Macro Phases and Phases hierarchy
    const allMacroPhases = await db
        .select()
        .from(macroPhases)
        .where(eq(macroPhases.eventId, event.id))
        .orderBy(macroPhases.sortOrder);

    const allPhases = await db
        .select()
        .from(phases)
        .where(sql`${phases.macroPhaseId} IN (SELECT id FROM ${macroPhases} WHERE event_id = ${event.id})`)
        .orderBy(phases.sortOrder);

    const macroPhasesWithPhases = allMacroPhases.map(mp => ({
        ...mp,
        phases: allPhases.filter(p => p.macroPhaseId === mp.id)
    }));

    // Get team counts per faction
    const teamCounts = await db
        .select({
            factionId: teams.factionId,
            count: sql<number>`count(*)`
        })
        .from(teams)
        .groupBy(teams.factionId);

    const teamCountMap = new Map(teamCounts.map((tc) => [tc.factionId, tc.count]));

    // Fetch all teams for assignment
    const allTeams = await db
        .select({
            id: teams.id,
            name: teams.name,
            factionId: teams.factionId,
            joinCode: teams.joinCode,
            color: teams.color,
            avatarUrl: teams.avatarUrl,
            scoreCache: teams.scoreCache
        })
        .from(teams)
        .orderBy(teams.name);

    // Build factions with their teams. All staff/admin users can select any
    // faction from the judge interface, so there are no per-faction managers.
    const factionsWithDetails = allFactions.map((faction) => {
        const factionTeams = allTeams.filter((t) => t.factionId === faction.id);

        return {
            ...faction,
            teamCount: teamCountMap.get(faction.id) || 0,
            teams: factionTeams
        };
    });

    // Get real player count
    const [playerResult] = await db
        .select({
            count: sql<number>`count(distinct ${users.id})`
        })
        .from(users)
        .innerJoin(teams, eq(users.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, event.id));

    // Get recent activity logs
    const recentActivity = await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.eventId, event.id))
        .orderBy(sql`${activityLogs.createdAt} DESC`)
        .limit(5);

    // Get program challenges for this event with their steps
    const eventChallenges = await db
        .select()
        .from(challenges)
        .where(and(eq(challenges.eventId, event.id), eq(challenges.challengeType, 'program')))
        .orderBy(challenges.sortOrder);

    const eventGames = await db
        .select()
        .from(games)
        .where(eq(games.eventId, event.id))
        .orderBy(games.sortOrder);

    // Get all steps for these challenges
    const challengeIds = eventChallenges.map(c => c.id);
    const allSteps = challengeIds.length > 0
        ? await db
            .select()
            .from(challengeSteps)
            .where(sql`${challengeSteps.challengeId} IN (${sql.join(challengeIds.map(id => sql`${id}`), sql`, `)})`)
            .orderBy(challengeSteps.stepOrder)
        : [];

    // Build challenges with steps
    const challengesWithSteps = eventChallenges.map(challenge => ({
        ...challenge,
        challengeType: 'program' as const,
        steps: allSteps.filter(s => s.challengeId === challenge.id)
    }));

    const gameIds = eventGames.map(g => g.id);
    const allGameSteps = gameIds.length > 0
        ? await db
            .select()
            .from(gameSteps)
            .where(sql`${gameSteps.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`)
            .orderBy(gameSteps.stepOrder)
        : [];

    const gamesWithSteps = eventGames.map(game => ({
        ...game,
        phaseId: null,
        challengeType: 'game' as const,
        steps: allGameSteps
            .filter(s => s.gameId === game.id)
            .map(s => ({ ...s, challengeId: s.gameId }))
    }));

    const rawGameCompletions = gameIds.length > 0
        ? await db
            .select({
                id: teamGameCompletions.id,
                teamId: teamGameCompletions.teamId,
                teamName: teams.name,
                factionId: factions.id,
                factionName: factions.name,
                factionColor: factions.color,
                gameId: games.id,
                gameName: games.name,
                completedAt: teamGameCompletions.completedAt,
                totalPoints: teamGameCompletions.totalPoints,
                metadata: teamGameCompletions.metadata
            })
            .from(teamGameCompletions)
            .innerJoin(games, eq(teamGameCompletions.gameId, games.id))
            .innerJoin(teams, eq(teamGameCompletions.teamId, teams.id))
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(eq(games.eventId, event.id))
            .orderBy(desc(teamGameCompletions.completedAt))
        : [];

    const gameLedgerRows = gameIds.length > 0
        ? await db
            .select({
                gameId: scoreLedger.gameId,
                teamId: scoreLedger.teamId,
                points: scoreLedger.points,
                description: scoreLedger.description,
                metadata: scoreLedger.metadata,
                createdAt: scoreLedger.createdAt,
                judgeName: users.name,
                judgeEmail: users.email
            })
            .from(scoreLedger)
            .leftJoin(users, eq(scoreLedger.judgeUserId, users.id))
            .where(sql`${scoreLedger.gameId} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`)
            .orderBy(desc(scoreLedger.createdAt))
        : [];

    const gameCompletions = rawGameCompletions.map((completion) => {
        const ledgerEntries = gameLedgerRows.filter(
            (entry) => entry.gameId === completion.gameId && entry.teamId === completion.teamId
        );
        const detailEntry = ledgerEntries.find((entry) => {
            const metadata = entry.metadata as any;
            return metadata && (Array.isArray(metadata.breakdown) || metadata.elapsedSeconds !== undefined);
        }) || ledgerEntries[0];
        const completionMetadata = (completion.metadata || {}) as any;
        const ledgerMetadata = (detailEntry?.metadata || {}) as any;
        const breakdown = Array.isArray(completionMetadata.breakdown)
            ? completionMetadata.breakdown
            : Array.isArray(ledgerMetadata.breakdown)
                ? ledgerMetadata.breakdown
                : ledgerEntries.map((entry) => ({
                    label: entry.description || 'Punteggio',
                    points: entry.points
                }));
        const elapsedValue = completionMetadata.elapsedSeconds ?? ledgerMetadata.elapsedSeconds;

        return {
            ...completion,
            elapsedSeconds: Number.isFinite(Number(elapsedValue)) ? Math.max(0, Number(elapsedValue)) : null,
            breakdown,
            judgeName: detailEntry?.judgeName || detailEntry?.judgeEmail || null,
            submittedAt: completionMetadata.submittedAt || detailEntry?.createdAt || completion.completedAt
        };
    });

    const programCompletions = await db
        .select({
            id: teamChallengeCompletions.id,
            teamId: teamChallengeCompletions.teamId,
            teamName: teams.name,
            factionId: factions.id,
            factionName: factions.name,
            factionColor: factions.color,
            challengeId: challenges.id,
            challengeName: challenges.name,
            challengeCode: challenges.code,
            completedAt: teamChallengeCompletions.completedAt,
            totalPoints: teamChallengeCompletions.totalPoints
        })
        .from(teamChallengeCompletions)
        .innerJoin(challenges, eq(teamChallengeCompletions.challengeId, challenges.id))
        .innerJoin(teams, eq(teamChallengeCompletions.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(and(eq(challenges.eventId, event.id), eq(challenges.challengeType, 'program')))
        .orderBy(desc(teamChallengeCompletions.completedAt));

    const [phaseOneTimeRows, triptychTimeRows] = await Promise.all([
        loadPhaseOneTimeRows(event.id),
        loadTriptychTimeRows(event.id)
    ]);

    // Fetch Codex Janara Puzzles
    const codexPuzzles = await db
        .select()
        .from(codexJanaraPuzzles)
        .where(eq(codexJanaraPuzzles.eventId, event.id))
        .orderBy(codexJanaraPuzzles.createdAt);

    // Fetch Codex Decode Logs (first-time decodings)
    const codexDecodeLogs = await db
        .select({
            logId: codexDecodeLog.id,
            puzzleId: codexDecodeLog.puzzleId,
            decodedAt: codexDecodeLog.decodedAt,
            teamId: codexDecodeLog.teamId,
            pointsAwarded: codexDecodeLog.pointsAwarded,
            factionId: codexJanaraPuzzles.factionId,
            factionName: factions.name,
            factionColor: factions.color,
            teamName: teams.name
        })
        .from(codexDecodeLog)
        .innerJoin(codexJanaraPuzzles, eq(codexDecodeLog.puzzleId, codexJanaraPuzzles.id))
        .innerJoin(factions, eq(codexJanaraPuzzles.factionId, factions.id))
        .leftJoin(teams, eq(codexDecodeLog.teamId, teams.id))
        .where(eq(codexJanaraPuzzles.eventId, event.id))
        .orderBy(desc(codexDecodeLog.decodedAt));

    const scoreCorrections = await db
        .select({
            id: scoreLedger.id,
            points: scoreLedger.points,
            description: scoreLedger.description,
            createdAt: scoreLedger.createdAt,
            metadata: scoreLedger.metadata,
            teamName: teams.name,
            factionName: factions.name,
            factionColor: factions.color,
            judgeName: users.name,
            judgeEmail: users.email
        })
        .from(scoreLedger)
        .innerJoin(teams, eq(scoreLedger.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .leftJoin(users, eq(scoreLedger.judgeUserId, users.id))
        .where(and(
            eq(factions.eventId, event.id),
            eq(scoreLedger.eventType, 'adjustment'),
            sql`json_extract(${scoreLedger.metadata}, '$.source') = 'manual_score_adjustment'`
        ))
        .orderBy(desc(scoreLedger.createdAt))
        .limit(50);

    const phaseThreeRows = await db
        .select({
            id: phaseThreeScores.id,
            teamId: phaseThreeScores.teamId,
            teamName: teams.name,
            teamAvatarUrl: teams.avatarUrl,
            factionId: factions.id,
            factionName: factions.name,
            factionColor: factions.color,
            score: phaseThreeScores.score,
            updatedAt: phaseThreeScores.updatedAt
        })
        .from(phaseThreeScores)
        .innerJoin(teams, eq(phaseThreeScores.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(phaseThreeScores.eventId, event.id))
        .orderBy(desc(phaseThreeScores.score), teams.name);

    const phaseFourRows = await db
        .select({
            id: phaseFourProgress.id,
            teamId: phaseFourProgress.teamId,
            teamName: teams.name,
            teamAvatarUrl: teams.avatarUrl,
            factionId: factions.id,
            factionName: factions.name,
            factionColor: factions.color,
            percent: phaseFourProgress.percent,
            updatedAt: phaseFourProgress.updatedAt
        })
        .from(phaseFourProgress)
        .innerJoin(teams, eq(phaseFourProgress.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(phaseFourProgress.eventId, event.id))
        .orderBy(desc(phaseFourProgress.percent), teams.name);

    return {
        factions: factionsWithDetails,
        allTeams,
        challenges: [...challengesWithSteps, ...gamesWithSteps],
        programCompletions,
        phaseOneTimeRows,
        triptychTimeRows,
        gameCompletions,
        stats: {
            participantCount: playerResult?.count || 0,
            phaseCount: eventChallenges.length
        },
        recentActivity: recentActivity.map(a => ({
            id: a.id,
            type: a.type,
            content: a.content,
            timestamp: a.createdAt
        })),
        macroPhases: macroPhasesWithPhases,
        codexPuzzles,
        codexDecodeLogs,
        scoreCorrections,
        phaseThreeRows,
        phaseFourRows
    };
};

export const actions: Actions = {
    createFaction: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const name = formData.get('name') as string;
        const color = formData.get('color') as string | null;
        const icon = formData.get('icon') as string | null;
        const factionType = formData.get('factionType') as string | null;
        const description = formData.get('description') as string | null;
        const teamIds = formData.getAll('teamIds') as string[];
        const avatarFile = formData.get('avatar') as File | null;

        if (!name) return fail(400, { error: 'Nome fazione obbligatorio' });

        const factionId = uuidv7();

        let avatarUrl: string | null = null;
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureDir(AVATAR_DIR);
            const filename = `${factionId}-${Date.now()}.${image.ext}`;
            const filePath = join(AVATAR_DIR, filename);
            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/faction_avatars/${filename}`;
        }

        await db.insert(factions).values({
            id: factionId,
            eventId: event.id,
            name,
            color: color || '#6366f1',
            icon: icon || null,
            avatarUrl,
            description: description || null,
            factionType: factionType || null
        });

        if (teamIds.length > 0) {
            for (const teamId of teamIds) {
                await db.update(teams).set({ factionId }).where(eq(teams.id, teamId));
            }
        }

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: event.id,
            type: 'faction_created',
            content: `Nuova fazione creata: ${name}`
        });

        return { success: true };
    },

    updateFaction: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;
        const color = formData.get('color') as string | null;
        const icon = formData.get('icon') as string | null;
        const factionType = formData.get('factionType') as string | null;
        const description = formData.get('description') as string | null;
        const teamIds = formData.getAll('teamIds') as string[];
        const avatarFile = formData.get('avatar') as File | null;

        if (!id || !name) return fail(400, { error: 'Dati incompleti' });

        const [current] = await db.select().from(factions).where(eq(factions.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Fazione non trovata' });

        let avatarUrl = current.avatarUrl;
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureDir(AVATAR_DIR);
            if (avatarUrl?.startsWith('/api/faction_avatars/')) {
                const oldPath = join(AVATAR_DIR, avatarUrl.split('/').pop()!);
                if (existsSync(oldPath)) await unlink(oldPath).catch(() => { });
            }
            const filename = `${id}-${Date.now()}.${image.ext}`;
            const filePath = join(AVATAR_DIR, filename);
            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/faction_avatars/${filename}`;
        }

        await db.update(factions).set({
            name,
            color: color || current.color,
            icon: icon || null,
            avatarUrl,
            description: description || null,
            factionType: factionType || null,
            updatedAt: new Date()
        }).where(eq(factions.id, id));

        await db.update(teams).set({ factionId: null }).where(eq(teams.factionId, id));
        if (teamIds.length > 0) {
            for (const teamId of teamIds) {
                await db.update(teams).set({ factionId: id }).where(eq(teams.id, teamId));
            }
        }

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'faction_updated',
            content: `Fazione aggiornata: ${name}`
        });

        return { success: true };
    },

    deleteFaction: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'ID fazione mancante' });

        const [current] = await db.select().from(factions).where(eq(factions.id, id)).limit(1);
        if (current?.avatarUrl?.startsWith('/api/faction_avatars/')) {
            const avatarPath = join(AVATAR_DIR, current.avatarUrl.split('/').pop()!);
            if (existsSync(avatarPath)) await unlink(avatarPath).catch(() => { });
        }

        await db.update(teams).set({ factionId: null }).where(eq(teams.factionId, id));
        await db.delete(factions).where(eq(factions.id, id));

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'faction_deleted',
            content: `Fazione eliminata: ${current.name}`
        });

        return { success: true };
    },

    // ========== PHASE ACTIONS ==========
    createMacroPhase: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const name = formData.get('name') as string;
        if (!name) return fail(400, { error: 'Nome macro-fase obbligatorio' });

        const [maxOrder] = await db
            .select({ max: sql<number>`coalesce(max(${macroPhases.sortOrder}), 0)` })
            .from(macroPhases)
            .where(eq(macroPhases.eventId, event.id));

        await db.insert(macroPhases).values({
            id: uuidv7(),
            eventId: event.id,
            name,
            sortOrder: (maxOrder?.max || 0) + 1,
            status: 'active'
        });

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: event.id,
            type: 'macro_phase_created',
            content: `Nuova macro-fase creata: ${name}`
        });

        return { success: true };
    },

    deleteMacroPhase: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'ID mancante' });
        const [current] = await db.select().from(macroPhases).where(eq(macroPhases.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Macro-fase non trovata' });

        await db.delete(macroPhases).where(eq(macroPhases.id, id));

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'macro_phase_deleted',
            content: `Macro-fase eliminata: ${current.name}`
        });

        return { success: true };
    },

    updateMacroPhase: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;

        if (!id || !name) return fail(400, { error: 'Dati incompleti' });

        const [current] = await db.select().from(macroPhases).where(eq(macroPhases.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Macro-fase non trovata' });

        await db.update(macroPhases).set({
            name
        }).where(eq(macroPhases.id, id));

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'macro_phase_updated',
            content: `Macro-fase aggiornata: ${name}`
        });

        return { success: true };
    },

    createPhase: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const macroPhaseId = formData.get('macroPhaseId') as string;

        if (!name || !macroPhaseId) return fail(400, { error: 'Dati mancanti' });

        const [maxOrder] = await db
            .select({ max: sql<number>`coalesce(max(${phases.sortOrder}), 0)` })
            .from(phases)
            .where(eq(phases.macroPhaseId, macroPhaseId));

        await db.insert(phases).values({
            id: uuidv7(),
            macroPhaseId,
            name,
            sortOrder: (maxOrder?.max || 0) + 1,
            status: 'active'
        });

        const [mp] = await db.select().from(macroPhases).where(eq(macroPhases.id, macroPhaseId)).limit(1);
        if (mp) {
            await db.insert(activityLogs).values({
                id: uuidv7(),
                eventId: mp.eventId,
                type: 'phase_created',
                content: `Nuova fase creata: ${name} (in ${mp.name})`
            });
        }

        return { success: true };
    },

    deletePhase: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'ID mancante' });

        const [current] = await db.select({
            name: phases.name,
            macroPhaseId: phases.macroPhaseId
        }).from(phases).where(eq(phases.id, id)).limit(1);

        if (current) {
            const [mp] = await db.select().from(macroPhases).where(eq(macroPhases.id, current.macroPhaseId!)).limit(1);
            if (mp) {
                await db.insert(activityLogs).values({
                    id: uuidv7(),
                    eventId: mp.eventId,
                    type: 'phase_deleted',
                    content: `Fase eliminata: ${current.name}`
                });
            }
        }

        await db.delete(phases).where(eq(phases.id, id));
        return { success: true };
    },

    updatePhase: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;

        if (!id || !name) return fail(400, { error: 'Dati incompleti' });

        const [current] = await db.select().from(phases).where(eq(phases.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Fase non trovata' });

        await db.update(phases).set({
            name
        }).where(eq(phases.id, id));

        const [mp] = await db.select().from(macroPhases).where(eq(macroPhases.id, current.macroPhaseId!)).limit(1);
        if (mp) {
            await db.insert(activityLogs).values({
                id: uuidv7(),
                eventId: mp.eventId,
                type: 'phase_updated',
                content: `Fase aggiornata: ${name} (in ${mp.name})`
            });
        }

        return { success: true };
    },

    // ========== CHALLENGE ACTIONS ==========
    createChallenge: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const name = formData.get('name') as string;
        const code = formData.get('code') as string;
        const scoringType = formData.get('scoringType') as 'simple' | 'checklist' | 'attempt_based' | 'timed_obstacle';
        const basePoints = parseInt(formData.get('basePoints') as string) || 0;
        const maxPoints = parseInt(formData.get('maxPoints') as string) || null;
        const description = formData.get('description') as string | null;
        const phaseId = formData.get('phaseId') as string | null;
        const challengeType = (formData.get('challengeType') as 'program' | 'game') || 'program';

        if (!name || !code || !scoringType) return fail(400, { error: 'Dati incompleti' });
        if (challengeType === 'program' && !programCodes.includes(code.toUpperCase() as any)) {
            return fail(400, { error: 'Nel programma puoi creare solo Path dello Scriba o Path dell\'Architetto. Il Cavaliere è gestito da GeoPhase.' });
        }
        if (challengeType === 'program' && !programScoringTypes.includes(scoringType as any)) {
            return fail(400, { error: 'Questo tipo punteggio appartiene ai giochi, non al programma.' });
        }
        if (challengeType === 'game' && !gameScoringTypes.includes(scoringType as any)) {
            return fail(400, { error: 'I giochi supportano il Gioco a fasi e Lo Stendardo.' });
        }

        const [maxOrder] = challengeType === 'game'
            ? await db
                .select({ max: sql<number>`coalesce(max(${games.sortOrder}), 0)` })
                .from(games)
                .where(eq(games.eventId, event.id))
            : await db
                .select({ max: sql<number>`coalesce(max(${challenges.sortOrder}), 0)` })
                .from(challenges)
                .where(eq(challenges.eventId, event.id));

        let config: ChallengeConfig = {};
        if (scoringType === 'checklist') {
            config.checklistItems = parseInt(formData.get('checklistItems') as string) || 5;
            config.pointsPerItem = parseInt(formData.get('pointsPerItem') as string) || 10;
        } else if (scoringType === 'timed_obstacle') {
            config = buildGameConfig(formData);
        }

        // Programs must belong to a phase; games are standalone (no phase)
        const finalPhaseId = challengeType === 'program' ? (phaseId === 'null' || !phaseId ? null : phaseId) : null;

        if (challengeType === 'program' && !finalPhaseId) {
            return fail(400, { error: 'I programmi devono essere associati ad una fase.' });
        }

        const challengeId = uuidv7();

        if (challengeType === 'game') {
            await db.insert(games).values({
                id: challengeId,
                eventId: event.id,
                code: code.toUpperCase(),
                name,
                description,
                scoringType,
                basePoints,
                maxPoints,
                hasRankingBonus: false,
                sortOrder: (maxOrder?.max || 0) + 1,
                config: Object.keys(config).length > 0 ? config : null
            });
        } else {
            await db.insert(challenges).values({
            id: challengeId,
            eventId: event.id,
            code: code.toUpperCase(),
            name,
            description,
            scoringType,
            basePoints,
            maxPoints,
            hasRankingBonus: false,
            sortOrder: (maxOrder?.max || 0) + 1,
            config: Object.keys(config).length > 0 ? config : null,
            phaseId: finalPhaseId,
            challengeType
            });
        }

        if (scoringType === 'attempt_based') {
            const stepsJson = formData.get('steps') as string;
            if (stepsJson) {
                try {
                    const steps = JSON.parse(stepsJson);
                    for (let i = 0; i < steps.length; i++) {
                        const step = steps[i];
                        if (challengeType === 'game') {
                            await db.insert(gameSteps).values({
                                id: uuidv7(),
                                gameId: challengeId,
                                code: step.code.toUpperCase(),
                                name: step.name,
                                stepOrder: i + 1,
                                scoringRules: step.scoringRules,
                                penaltyPoints: step.penaltyPoints || 0,
                                isBlocking: step.isBlocking || false
                            });
                        } else {
                            await db.insert(challengeSteps).values({
                            id: uuidv7(),
                            challengeId,
                            code: step.code.toUpperCase(),
                            name: step.name,
                            stepOrder: i + 1,
                            scoringRules: step.scoringRules,
                            penaltyPoints: step.penaltyPoints || 0,
                            isBlocking: step.isBlocking || false
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error parsing steps:', e);
                }
            }
        }

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: event.id,
            type: 'challenge_created',
            content: `Nuova fase creata: ${name}`
        });

        return { success: true };
    },

    updateChallenge: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;
        const code = formData.get('code') as string;
        const scoringType = formData.get('scoringType') as 'simple' | 'checklist' | 'attempt_based' | 'timed_obstacle';
        const basePoints = parseInt(formData.get('basePoints') as string) || 0;
        const maxPoints = parseInt(formData.get('maxPoints') as string) || null;
        const description = formData.get('description') as string | null;
        const phaseId = formData.get('phaseId') as string | null;

        if (!id || !name || !code || !scoringType) return fail(400, { error: 'Dati incompleti' });

        const [currentChallenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
        const currentGame = currentChallenge
            ? null
            : (await db.select().from(games).where(eq(games.id, id)).limit(1))[0] || null;
        const current = currentChallenge || currentGame;
        if (!current) return fail(404, { error: 'Challenge non trovata' });

        // Use existing challengeType if not explicitly overridden by form
        const challengeType = currentGame ? 'game' : 'program';
        if (challengeType === 'program' && !programCodes.includes(code.toUpperCase() as any)) {
            return fail(400, { error: 'Nel programma puoi gestire solo Path dello Scriba o Path dell\'Architetto. Il Cavaliere è gestito da GeoPhase.' });
        }
        if (challengeType === 'program' && !programScoringTypes.includes(scoringType as any)) {
            return fail(400, { error: 'Questo tipo punteggio appartiene ai giochi, non al programma.' });
        }
        if (challengeType === 'game' && !gameScoringTypes.includes(scoringType as any)) {
            return fail(400, { error: 'I giochi supportano il Gioco a fasi e Lo Stendardo.' });
        }

        let config: ChallengeConfig = {};
        if (scoringType === 'checklist') {
            config.checklistItems = parseInt(formData.get('checklistItems') as string) || 5;
            config.pointsPerItem = parseInt(formData.get('pointsPerItem') as string) || 10;
        } else if (scoringType === 'timed_obstacle') {
            config = buildGameConfig(formData);
        }

        // Programs must belong to a phase; games are standalone (no phase)
        const finalPhaseId = challengeType === 'program' ? (phaseId === 'null' || !phaseId ? null : phaseId) : null;

        if (challengeType === 'program' && !finalPhaseId) {
            return fail(400, { error: 'I programmi devono essere associati ad una fase.' });
        }

        if (challengeType === 'game') {
            await db.update(games).set({
                name,
                code: code.toUpperCase(),
                scoringType,
                basePoints,
                maxPoints,
                hasRankingBonus: false,
                description,
                config: Object.keys(config).length > 0 ? config : null,
                updatedAt: new Date()
            }).where(eq(games.id, id));
        } else {
            await db.update(challenges).set({
            name,
            code: code.toUpperCase(),
            scoringType,
            basePoints,
            maxPoints,
            hasRankingBonus: false,
            description,
            config: Object.keys(config).length > 0 ? config : null,
            updatedAt: new Date(),
            phaseId: finalPhaseId,
            challengeType
            }).where(eq(challenges.id, id));
        }

        if (scoringType === 'attempt_based') {
            if (challengeType === 'game') {
                await db.delete(gameSteps).where(eq(gameSteps.gameId, id));
            } else {
                await db.delete(challengeSteps).where(eq(challengeSteps.challengeId, id));
            }
            const stepsJson = formData.get('steps') as string;
            if (stepsJson) {
                try {
                    const steps = JSON.parse(stepsJson);
                    for (let i = 0; i < steps.length; i++) {
                        const step = steps[i];
                        if (challengeType === 'game') {
                            await db.insert(gameSteps).values({
                                id: uuidv7(),
                                gameId: id,
                                code: step.code.toUpperCase(),
                                name: step.name,
                                stepOrder: i + 1,
                                scoringRules: step.scoringRules,
                                penaltyPoints: step.penaltyPoints || 0,
                                isBlocking: step.isBlocking || false
                            });
                        } else {
                            await db.insert(challengeSteps).values({
                            id: uuidv7(),
                            challengeId: id,
                            code: step.code.toUpperCase(),
                            name: step.name,
                            stepOrder: i + 1,
                            scoringRules: step.scoringRules,
                            penaltyPoints: step.penaltyPoints || 0,
                            isBlocking: step.isBlocking || false
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error parsing steps:', e);
                }
            }
        } else {
            if (challengeType === 'game') {
                await db.delete(gameSteps).where(eq(gameSteps.gameId, id));
            } else {
                await db.delete(challengeSteps).where(eq(challengeSteps.challengeId, id));
            }
        }

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'challenge_updated',
            content: `Fase aggiornata: ${name}`
        });

        return { success: true };
    },

    deleteChallenge: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'ID fase mancante' });

        const [currentChallenge] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
        const currentGame = currentChallenge
            ? null
            : (await db.select().from(games).where(eq(games.id, id)).limit(1))[0] || null;
        const current = currentChallenge || currentGame;
        if (!current) return fail(404, { error: 'Fase non trovata' });

        if (currentGame) {
            await db.delete(games).where(eq(games.id, id));
        } else {
            await db.delete(challenges).where(eq(challenges.id, id));
        }

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: current.eventId,
            type: 'challenge_deleted',
            content: `Fase eliminata: ${current.name}`
        });

        return { success: true };
    },

    reorderChallenge: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const direction = formData.get('direction') as 'up' | 'down';

        if (!id || !direction) return fail(400, { error: 'Dati mancanti' });

        const [target] = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
        if (!target || !target.phaseId) return fail(404, { error: 'Attività non trovata o non assegnata a una fase' });

        // Get all challenges in the same phase, ordered by sortOrder
        const samePhaseChallenges = await db
            .select()
            .from(challenges)
            .where(eq(challenges.phaseId, target.phaseId))
            .orderBy(challenges.sortOrder);

        const currentIndex = samePhaseChallenges.findIndex(c => c.id === id);
        if (currentIndex === -1) return fail(404, { error: 'Attività non trovata' });

        let neighborIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (neighborIndex >= 0 && neighborIndex < samePhaseChallenges.length) {
            const neighbor = samePhaseChallenges[neighborIndex];

            // Swap sort orders
            await db.transaction(async (tx) => {
                await tx.update(challenges)
                    .set({ sortOrder: neighbor.sortOrder })
                    .where(eq(challenges.id, target.id));
                await tx.update(challenges)
                    .set({ sortOrder: target.sortOrder })
                    .where(eq(challenges.id, neighbor.id));
            });
        }

        return { success: true };
    },

    setTeamScore: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const targetScore = Number(formData.get('score'));
        const reason = ((formData.get('reason') as string) || '').trim();

        if (!teamId || !Number.isSafeInteger(targetScore)) {
            return fail(400, { error: 'Seleziona una squadra e inserisci un punteggio intero valido.' });
        }

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const [team] = await db
            .select({
                id: teams.id,
                name: teams.name,
                factionId: teams.factionId,
                scoreCache: teams.scoreCache
            })
            .from(teams)
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(eq(teams.id, teamId), eq(factions.eventId, event.id)))
            .limit(1);

        if (!team) {
            return fail(404, { error: 'Squadra non trovata per questo evento.' });
        }

        const now = new Date();
        const previousScore = team.scoreCache || 0;
        const points = targetScore - previousScore;

        if (points === 0) {
            return { success: true };
        }

        const description = reason || `Punteggio impostato manualmente da ${previousScore} a ${targetScore}`;

        await db.transaction(async (tx) => {
            await tx.insert(scoreLedger).values({
                id: uuidv7(),
                teamId,
                eventType: 'adjustment',
                points,
                description,
                judgeUserId: locals.user?.id,
                metadata: {
                    source: 'manual_score_adjustment',
                    mode: 'absolute_score',
                    eventId: event.id,
                    previousScore,
                    targetScore,
                    reason
                },
                createdAt: now
            });

            await tx.update(teams)
                .set({
                    scoreCache: targetScore,
                    updatedAt: now
                })
                .where(eq(teams.id, teamId));

            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                type: 'score_update',
                content: `Punteggio corretto per ${team.name}: da ${previousScore} a ${targetScore} pt${reason ? ` - ${reason}` : ''}`,
                createdAt: now
            });
        });

        return { success: true };
    },

    setPhaseOneTimeBonus: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = String(formData.get('teamId') || '');
        const targetPoints = Number(formData.get('extraPoints'));

        if (!teamId || !Number.isSafeInteger(targetPoints) || targetPoints < 0 || targetPoints > 9_999) {
            return fail(400, {
                phaseOneBonusError: 'Inserisci un bonus intero compreso tra 0 e 9.999 punti.'
            });
        }

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) {
            return fail(404, { phaseOneBonusError: 'Evento non trovato.' });
        }

        const eligibleRows = await loadPhaseOneTimeRows(event.id);
        const eligibleTeam = eligibleRows.find((row) => row.teamId === teamId);
        if (!eligibleTeam) {
            return fail(404, { phaseOneBonusError: 'Squadra non trovata per questo evento.' });
        }
        if (!eligibleTeam.completed || eligibleTeam.completedAt === null) {
            return fail(409, {
                phaseOneBonusError: 'Il bonus può essere assegnato solo dopo Cavaliere, Architetto e tutti gli step Scriba.'
            });
        }

        const now = new Date();
        const result = await db.transaction(async (tx) => {
            const [currentBonusRow] = await tx
                .select({ points: sql<number>`coalesce(sum(${scoreLedger.points}), 0)` })
                .from(scoreLedger)
                .where(and(
                    eq(scoreLedger.teamId, teamId),
                    sql`json_extract(${scoreLedger.metadata}, '$.source') = 'phase_completion_time_bonus'`,
                    sql`json_extract(${scoreLedger.metadata}, '$.phaseKey') = 'phase1'`
                ));
            const previousPoints = Number(currentBonusRow?.points) || 0;
            const delta = targetPoints - previousPoints;
            if (delta === 0) return { changed: false, previousPoints, delta };

            await tx.insert(scoreLedger).values({
                id: uuidv7(),
                teamId,
                eventType: delta > 0 ? 'special_bonus' : 'adjustment',
                points: delta,
                description: `Bonus classifica tempi Fase 1: ${targetPoints} pt`,
                judgeUserId: locals.user?.id,
                metadata: {
                    source: 'phase_completion_time_bonus',
                    phaseKey: 'phase1',
                    mode: 'absolute_bonus',
                    eventId: event.id,
                    phaseCompletedAt: eligibleTeam.completedAt,
                    previousPoints,
                    targetPoints
                },
                createdAt: now
            });

            await tx.update(teams)
                .set({
                    scoreCache: sql`score_cache + ${delta}`,
                    updatedAt: now
                })
                .where(eq(teams.id, teamId));

            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                type: 'score_update',
                content: `Bonus tempi Fase 1 per ${eligibleTeam.teamName}: ${targetPoints} pt`,
                createdAt: now
            });

            return { changed: true, previousPoints, delta };
        });

        return {
            success: true,
            phaseOneBonusMessage: result.changed
                ? `Bonus aggiornato: ${targetPoints} pt per ${eligibleTeam.teamName}.`
                : `Il bonus di ${targetPoints} pt era già assegnato a ${eligibleTeam.teamName}.`
        };
    },

    setTriptychTimeBonus: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = String(formData.get('teamId') || '');
        const gameId = String(formData.get('gameId') || '');
        const targetPoints = Number(formData.get('extraPoints'));

        if (!teamId || !gameId || !Number.isSafeInteger(targetPoints) || targetPoints < 0 || targetPoints > 9_999) {
            return fail(400, {
                triptychBonusError: 'Inserisci un bonus intero compreso tra 0 e 9.999 punti.'
            });
        }

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { triptychBonusError: 'Evento non trovato.' });

        const timeRows = await loadTriptychTimeRows(event.id);
        const eligibleTeam = timeRows.find((row) => row.teamId === teamId && row.gameId === gameId);
        if (!eligibleTeam) {
            return fail(409, {
                triptychBonusError: 'Il bonus può essere assegnato solo a una squadra con un tempo Trittico registrato.'
            });
        }

        const now = new Date();
        const result = await db.transaction(async (tx) => {
            const [currentBonusRow] = await tx
                .select({ points: sql<number>`coalesce(sum(${scoreLedger.points}), 0)` })
                .from(scoreLedger)
                .where(and(
                    eq(scoreLedger.teamId, teamId),
                    sql`json_extract(${scoreLedger.metadata}, '$.source') = 'game_completion_time_bonus'`,
                    sql`json_extract(${scoreLedger.metadata}, '$.rankingKey') = 'triptych'`,
                    sql`json_extract(${scoreLedger.metadata}, '$.gameId') = ${gameId}`
                ));
            const previousPoints = Number(currentBonusRow?.points) || 0;
            const delta = targetPoints - previousPoints;
            if (delta === 0) return { changed: false };

            await tx.insert(scoreLedger).values({
                id: uuidv7(),
                teamId,
                gameId,
                eventType: delta > 0 ? 'special_bonus' : 'adjustment',
                points: delta,
                description: `Bonus classifica tempi Trittico: ${targetPoints} pt`,
                judgeUserId: locals.user?.id,
                metadata: {
                    source: 'game_completion_time_bonus',
                    rankingKey: 'triptych',
                    mode: 'absolute_bonus',
                    eventId: event.id,
                    gameId,
                    rank: eligibleTeam.rank,
                    previousPoints,
                    targetPoints
                },
                createdAt: now
            });

            await tx.update(teams)
                .set({
                    scoreCache: sql`score_cache + ${delta}`,
                    updatedAt: now
                })
                .where(eq(teams.id, teamId));

            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                type: 'score_update',
                content: `Bonus tempi Trittico per ${eligibleTeam.teamName}: ${targetPoints} pt`,
                createdAt: now
            });

            return { changed: true };
        });

        return {
            success: true,
            triptychBonusMessage: result.changed
                ? `Bonus Trittico aggiornato: ${targetPoints} pt per ${eligibleTeam.teamName}.`
                : `Il bonus Trittico di ${targetPoints} pt era già assegnato a ${eligibleTeam.teamName}.`
        };
    },

    upsertPhaseThreeScore: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensurePhaseThreeSchema();
        const formData = await request.formData();
        const teamId = (formData.get('teamId') as string) || '';
        const rawScore = Number((formData.get('score') as string) || '0');

        if (!teamId) {
            return fail(400, { error: 'Seleziona una squadra per la fase 3.' });
        }
        if (!Number.isSafeInteger(rawScore) || rawScore < 0) {
            return fail(400, { error: 'Inserisci un punteggio intero maggiore o uguale a zero.' });
        }

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const [team] = await db
            .select({
                id: teams.id,
                name: teams.name,
                factionName: factions.name
            })
            .from(teams)
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(eq(teams.id, teamId), eq(factions.eventId, event.id)))
            .limit(1);

        if (!team) {
            return fail(404, { error: 'Squadra non trovata per questo evento.' });
        }

        const now = new Date();

        await db.transaction(async (tx) => {
            await tx.insert(phaseThreeScores).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                score: rawScore,
                createdAt: now,
                updatedAt: now
            }).onConflictDoUpdate({
                target: [phaseThreeScores.eventId, phaseThreeScores.teamId],
                set: {
                    score: rawScore,
                    updatedAt: now
                }
            });

            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                type: 'phase_three_update',
                content: `Fase 3 aggiornata per ${team.name} (${team.factionName}): ${rawScore} pt`,
                createdAt: now
            });
        });

        return { success: true };
    },

    deletePhaseThreeScore: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensurePhaseThreeSchema();
        const formData = await request.formData();
        const id = (formData.get('id') as string) || '';
        if (!id) return fail(400, { error: 'Riga fase 3 mancante.' });

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const [row] = await db
            .select({
                id: phaseThreeScores.id,
                teamId: phaseThreeScores.teamId,
                teamName: teams.name
            })
            .from(phaseThreeScores)
            .innerJoin(teams, eq(phaseThreeScores.teamId, teams.id))
            .where(and(eq(phaseThreeScores.id, id), eq(phaseThreeScores.eventId, event.id)))
            .limit(1);

        if (!row) return fail(404, { error: 'Riga fase 3 non trovata.' });

        const now = new Date();
        await db.transaction(async (tx) => {
            await tx.delete(phaseThreeScores).where(eq(phaseThreeScores.id, id));
            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId: row.teamId,
                type: 'phase_three_update',
                content: `Rimossa ${row.teamName} dal tabellone Fase 3`,
                createdAt: now
            });
        });

        return { success: true };
    },

    upsertPhaseFourProgress: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensurePhaseFourSchema();
        const formData = await request.formData();
        const teamId = (formData.get('teamId') as string) || '';
        const rawPercent = parseInt((formData.get('percent') as string) || '0', 10);
        const percent = Math.max(0, Math.min(100, Number.isNaN(rawPercent) ? 0 : rawPercent));

        if (!teamId) {
            return fail(400, { error: 'Seleziona una squadra per la fase 4.' });
        }

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const [team] = await db
            .select({
                id: teams.id,
                name: teams.name,
                factionName: factions.name
            })
            .from(teams)
            .innerJoin(factions, eq(teams.factionId, factions.id))
            .where(and(eq(teams.id, teamId), eq(factions.eventId, event.id)))
            .limit(1);

        if (!team) {
            return fail(404, { error: 'Squadra non trovata per questo evento.' });
        }

        const now = new Date();

        await db.transaction(async (tx) => {
            await tx.insert(phaseFourProgress).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                percent,
                createdAt: now,
                updatedAt: now
            }).onConflictDoUpdate({
                target: [phaseFourProgress.eventId, phaseFourProgress.teamId],
                set: {
                    percent,
                    updatedAt: now
                }
            });

            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId,
                type: 'phase_four_update',
                content: `Fase 4 aggiornata per ${team.name} (${team.factionName}): ${percent}%`,
                createdAt: now
            });
        });

        return { success: true };
    },

    deletePhaseFourProgress: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensurePhaseFourSchema();
        const formData = await request.formData();
        const id = (formData.get('id') as string) || '';
        if (!id) return fail(400, { error: 'Riga fase 4 mancante.' });

        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const [row] = await db
            .select({
                id: phaseFourProgress.id,
                teamId: phaseFourProgress.teamId,
                teamName: teams.name
            })
            .from(phaseFourProgress)
            .innerJoin(teams, eq(phaseFourProgress.teamId, teams.id))
            .where(and(eq(phaseFourProgress.id, id), eq(phaseFourProgress.eventId, event.id)))
            .limit(1);

        if (!row) return fail(404, { error: 'Riga fase 4 non trovata.' });

        const now = new Date();
        await db.transaction(async (tx) => {
            await tx.delete(phaseFourProgress).where(eq(phaseFourProgress.id, id));
            await tx.insert(activityLogs).values({
                id: uuidv7(),
                eventId: event.id,
                teamId: row.teamId,
                type: 'phase_four_update',
                content: `Rimossa ${row.teamName} dal tabellone Fase 4`,
                createdAt: now
            });
        });

        return { success: true };
    },

    // ========== CODEX JANARA ACTIONS ==========
    createCodexPuzzle: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensureCodexSchema();
        const formData = await request.formData();
        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const factionId = formData.get('factionId') as string;
        const textToEncrypt = formData.get('text') as string;
        const keyword = formData.get('keyword') as string;
        const pointsOnDecode = Math.max(0, parseInt(formData.get('pointsOnDecode') as string) || 0);

        if (!factionId || !textToEncrypt || !keyword) {
            return fail(400, { error: 'Dati incompleti: Fazione, Testo e Chiave sono obbligatori.' });
        }

        // 1. Create 256-bit key from keyword using PBKDF2
        const key = await deriveCodexKey(keyword);

        // 2. Generate random IV
        const iv = randomBytes(16);

        // 3. Encrypt
        const cipher = createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // 4. Calculate plaintext hash for verification
        const plaintextHash = createHash('sha256').update(textToEncrypt).digest('hex');

        await db.insert(codexJanaraPuzzles).values({
            id: uuidv7(),
            eventId: event.id,
            factionId,
            encryptedText: encrypted,
            iv: iv.toString('hex'),
            plaintextHash,
            plaintext: textToEncrypt,
            keyword: keyword,
            pointsOnDecode
        });

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: event.id,
            type: 'codex_puzzle_created',
            content: `Nuovo enigma Codex Janara creato`
        });

        return { success: true };
    },

    updateCodexPuzzle: async ({ request, params, locals }) => {
        ensureAdmin(locals);
        await ensureCodexSchema();
        const formData = await request.formData();
        const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
        if (!event) return fail(404, { error: 'Evento non trovato' });

        const id = formData.get('id') as string;
        const factionId = formData.get('factionId') as string;
        const textToEncrypt = formData.get('text') as string;
        const keyword = formData.get('keyword') as string;
        const pointsOnDecode = Math.max(0, parseInt(formData.get('pointsOnDecode') as string) || 0);

        if (!id || !factionId || !textToEncrypt || !keyword) {
            return fail(400, { error: 'Dati incompleti.' });
        }

        const [current] = await db.select().from(codexJanaraPuzzles).where(eq(codexJanaraPuzzles.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Enigma non trovato' });

        // 1. Create 256-bit key from keyword using PBKDF2
        const key = await deriveCodexKey(keyword);

        // 2. Generate random IV
        const iv = randomBytes(16);

        // 3. Encrypt
        const cipher = createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(textToEncrypt, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // 4. Calculate plaintext hash for verification
        const plaintextHash = createHash('sha256').update(textToEncrypt).digest('hex');

        await db.update(codexJanaraPuzzles).set({
            factionId,
            encryptedText: encrypted,
            iv: iv.toString('hex'),
            plaintextHash,
            plaintext: textToEncrypt,
            keyword: keyword,
            pointsOnDecode
        }).where(eq(codexJanaraPuzzles.id, id));

        await db.insert(activityLogs).values({
            id: uuidv7(),
            eventId: event.id,
            type: 'codex_puzzle_updated',
            content: `Enigma Codex Janara aggiornato`
        });

        return { success: true };
    },

    deleteCodexPuzzle: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'ID mancante' });

        await db.delete(codexJanaraPuzzles).where(eq(codexJanaraPuzzles.id, id));
        return { success: true };
    }
};
