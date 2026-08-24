import { db } from '$lib/server/db';
import { challenges, challengeSteps, games, gameSteps, teams, scoreLedger, teamChallengeCompletions, teamGameCompletions, users, activityLogs, factions } from '$lib/server/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { uuidv7 } from 'uuidv7';
import { ensureStaff } from '$lib/server/auth';
import { assertStaffCanAccessTeam } from '$lib/server/staff-access';
import {
    calculateFlagScore,
    FLAG_SCORING_VERSION,
    resolveFlagScoringConfig,
    type FlagAttackOutcome,
    type FlagScoreRole
} from '$lib/flag-scoring';

export const load: PageServerLoad = async ({ url, locals }) => {
    ensureStaff(locals);

    const challengeId = url.searchParams.get('challenge');

    if (!challengeId) {
        throw redirect(302, '/staff');
    }

    const [programChallenge] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.id, challengeId))
        .limit(1);
    const game = programChallenge
        ? null
        : (await db.select().from(games).where(eq(games.id, challengeId)).limit(1))[0] || null;
    const challenge = programChallenge || (game ? { ...game, phaseId: null, challengeType: 'game' as const } : null);

    if (!challenge) {
        throw error(404, 'Sfida non trovata');
    }

    const targetEventId = challenge.eventId;

    const rawSteps = game
        ? await db.select().from(gameSteps).where(eq(gameSteps.gameId, challengeId)).orderBy(gameSteps.stepOrder)
        : await db.select().from(challengeSteps).where(eq(challengeSteps.challengeId, challengeId)).orderBy(challengeSteps.stepOrder);
    const steps = rawSteps.map((step: any) => ({
        ...step,
        challengeId: step.challengeId || step.gameId
    }));

    // Filter teams by eventId via factions
    const teamsQuery = db
        .select({
            id: teams.id,
            name: teams.name,
            avatarUrl: teams.avatarUrl,
            factionId: factions.id,
            factionName: factions.name,
            factionColor: factions.color
        })
        .from(teams)
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(factions.eventId, targetEventId));

    const allTeams = await teamsQuery.orderBy(teams.name);
    const visibleFactions = await db
        .select({
            id: factions.id,
            name: factions.name,
            color: factions.color,
            avatarUrl: factions.avatarUrl
        })
        .from(factions)
        .where(eq(factions.eventId, targetEventId))
        .orderBy(factions.name);

    // Get detailed list of teams that have already completed this challenge/game
    const completedTeamsList = game ? await db
        .select({
            id: teamGameCompletions.id,
            teamId: teamGameCompletions.teamId,
            teamName: teams.name,
            factionId: teams.factionId,
            factionName: factions.name,
            factionColor: factions.color,
            totalPoints: teamGameCompletions.totalPoints,
            completedAt: teamGameCompletions.completedAt
        })
        .from(teamGameCompletions)
        .innerJoin(teams, eq(teamGameCompletions.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(teamGameCompletions.gameId, challengeId))
        .orderBy(desc(teamGameCompletions.completedAt))
    : await db
        .select({
            id: teamChallengeCompletions.id,
            teamId: teamChallengeCompletions.teamId,
            teamName: teams.name,
            factionId: teams.factionId,
            factionName: factions.name,
            factionColor: factions.color,
            totalPoints: teamChallengeCompletions.totalPoints,
            completedAt: teamChallengeCompletions.completedAt
        })
        .from(teamChallengeCompletions)
        .innerJoin(teams, eq(teamChallengeCompletions.teamId, teams.id))
        .innerJoin(factions, eq(teams.factionId, factions.id))
        .where(eq(teamChallengeCompletions.challengeId, challengeId))
        .orderBy(desc(teamChallengeCompletions.completedAt));

    return {
        challenge,
        steps,
        factions: visibleFactions,
        teams: allTeams,
        completedTeamIds: completedTeamsList.map(c => c.teamId),
        completedTeams: completedTeamsList,
        isGame: Boolean(game),
        eventId: targetEventId
    };
};

export const actions: Actions = {
    submitScore: async ({ request, locals }) => {
        ensureStaff(locals);

        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const challengeId = formData.get('challengeId') as string;
        const judgeUserId = locals.user?.id;

        if (!teamId || !challengeId) {
            return fail(400, { message: 'Dati mancanti (teamId o challengeId)' });
        }

        const [programChallenge] = await db
            .select()
            .from(challenges)
            .where(eq(challenges.id, challengeId))
            .limit(1);
        const game = programChallenge
            ? null
            : (await db.select().from(games).where(eq(games.id, challengeId)).limit(1))[0] || null;
        const challenge = programChallenge || (game ? { ...game, phaseId: null, challengeType: 'game' as const } : null);

        if (!challenge) return fail(404, { message: 'Sfida non trovata' });

        // Admins and staff can judge every faction, but never a team from a
        // different event than the selected challenge.
        await assertStaffCanAccessTeam(locals, teamId, challenge.eventId);

        try {
            const idField = game ? { gameId: challengeId } : { challengeId };

            const isRefused = formData.get('isRefused') === 'true';
            const submittedAtMs = Date.now();
            const elapsedSeconds = challenge.scoringType === 'timed_obstacle'
                ? Math.max(0, parseInt(String(formData.get('elapsedSeconds'))) || 0)
                : 0;

            const completionTimeStr = formData.get('completionTime') as string;
            let timestampMs = submittedAtMs;

            if (completionTimeStr) {
                const parts = completionTimeStr.split(':').map(Number);
                if (parts.length >= 2) {
                    const hours = parts[0];
                    const minutes = parts[1];
                    const seconds = parts.length > 2 ? parts[2] : 0;

                    if (!isNaN(hours) && !isNaN(minutes)) {
                        const date = new Date();
                        date.setHours(hours, minutes, seconds || 0, 0);
                        timestampMs = date.getTime();
                    }
                }
            }

            const timestamp = new Date(timestampMs);
            const entries: (typeof scoreLedger.$inferInsert)[] = [];
            let gameCompletionMetadata: Record<string, unknown> | null = game
                ? {
                    submittedAt: submittedAtMs,
                    elapsedSeconds,
                    judgeUserId: judgeUserId || null,
                    mode: (challenge.config as any)?.mode || challenge.scoringType
                }
                : null;

            if (isRefused) {
                // If refused, we still want to record a completion but with 0 points
                // We add a virtual entry in the ledger if needed, or just let it be empty
                // but then entries.length === 0 check will fail. 
                // Let's add a "challenge_refused" event type if supported, or just an adjustment with 0 points.
                entries.push({
                    id: uuidv7(),
                    teamId,
                    ...idField,
                    eventType: 'adjustment',
                    points: 0,
                    description: `Prova Rifiutata: ${challenge.name}`,
                    judgeUserId,
                    metadata: { refused: true, elapsedSeconds },
                    createdAt: timestamp
                });
                if (gameCompletionMetadata) {
                    gameCompletionMetadata.refused = true;
                    gameCompletionMetadata.breakdown = [{ label: 'Prova rifiutata', points: 0 }];
                }
            } else if (challenge.scoringType === 'simple' || challenge.scoringType === 'checklist') {
                const basePoints = parseInt(formData.get('basePoints') as string) || 0;
                const extraPoints = parseInt(formData.get('extraPoints') as string) || 0;
                const description = formData.get('description') as string || '';

                if (basePoints !== 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'base',
                        points: basePoints,
                        description: `Punteggio base: ${challenge.name}`,
                        judgeUserId,
                        createdAt: timestamp
                    });
                }

                if (extraPoints !== 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: challenge.scoringType === 'checklist' ? 'checklist_item' : 'adjustment',
                        points: extraPoints,
                        description: description || 'Punteggio extra',
                        judgeUserId,
                        createdAt: timestamp
                    });
                }
            } else if (challenge.scoringType === 'attempt_based') {
                const stepsDataStr = formData.get('stepsData') as string;
                if (!stepsDataStr) throw new Error('Mancano i dati dei tentativi (stepsData)');
                const stepsData = JSON.parse(stepsDataStr);
                for (const step of stepsData) {
                    if (step.points !== 0) {
                        entries.push({
                            id: uuidv7(),
                            teamId,
                            ...idField,
                            ...(game ? { gameStepId: step.stepId } : { stepId: step.stepId }),
                            eventType: step.points > 0 ? 'attempt_bonus' : 'penalty',
                            points: step.points,
                            description: `Step: ${step.name} (Tentativo ${step.attempt})`,
                            judgeUserId,
                            createdAt: timestamp
                        });
                    }
                }

                if (challenge.basePoints > 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'base',
                        points: challenge.basePoints,
                        description: `Punteggio base: ${challenge.name}`,
                        judgeUserId,
                        createdAt: timestamp
                    });
                }
            } else if (challenge.scoringType === 'timed_obstacle') {
                const config = challenge.config as any;

                if (config?.mode === 'flag_standard') {
                    const flagScoreStr = formData.get('flagScoreData') as string;
                    const flagScore = flagScoreStr ? JSON.parse(flagScoreStr) : {};
                    const flagConfig = config.flagStandard || {};
                    const rules = resolveFlagScoringConfig(flagConfig);
                    const maxCarrierHits = rules.maxCarrierHits;
                    const carrierHits = Math.min(Math.max(0, parseInt(String(flagScore.carrierHits)) || 0), maxCarrierHits);
                    const allowedRoles: FlagScoreRole[] = ['attack', 'defense', 'stalemate', 'disqualified'];
                    const role: FlagScoreRole = allowedRoles.includes(flagScore.role)
                        ? flagScore.role
                        : 'stalemate';
                    const rawAttackOutcome = String(flagScore.attackOutcome || '');
                    const attackOutcome: FlagAttackOutcome = rawAttackOutcome === 'spawn' || rawAttackOutcome === 'delivered'
                        ? 'spawn'
                        : rawAttackOutcome === 'band_2' || rawAttackOutcome === 'line'
                            ? 'band_2'
                            : 'band_1';
                    const calculated = calculateFlagScore({
                        role,
                        attackOutcome,
                        carrierHits,
                        ...rules
                    });
                    const flagBreakdown = role === 'disqualified'
                        ? [{ label: 'Squalifica per infrazione', points: 0 }]
                        : role === 'attack'
                            ? [{
                                label: attackOutcome === 'spawn'
                                    ? 'Spawn Point raggiunto'
                                    : attackOutcome === 'band_2'
                                        ? 'Fascia 2 raggiunta'
                                        : 'Fascia 1 raggiunta',
                                points: calculated.basePoints
                            }]
                            : [
                                ...(role === 'stalemate' ? [{ label: 'Base stallo', points: 0 }] : []),
                                {
                                    label: `${flagConfig.carrierHitLabel || 'Portatore avversario colpito'} × ${carrierHits}`,
                                    points: calculated.hitPoints
                                }
                            ];
                    if (gameCompletionMetadata) {
                        gameCompletionMetadata.breakdown = flagBreakdown;
                        gameCompletionMetadata.role = role;
                        gameCompletionMetadata.attackOutcome = role === 'attack' ? attackOutcome : null;
                    }

                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: calculated.total === 0 ? 'adjustment' : 'special_bonus',
                        points: calculated.total,
                        description: role === 'disqualified'
                            ? 'Lo Stendardo: squalifica (0pt)'
                            : `Lo Stendardo: +${calculated.total}pt`,
                        judgeUserId,
                        metadata: {
                            source: 'flag_standard',
                            scoringVersion: FLAG_SCORING_VERSION,
                            elapsedSeconds,
                            carrierHits,
                            role,
                            attackOutcome: role === 'attack' ? attackOutcome : null,
                            pointsPerHit: rules.pointsPerHit,
                            maxCarrierHits,
                            maxHitPoints: rules.maxHitPoints,
                            basePoints: calculated.basePoints,
                            hitPoints: calculated.hitPoints,
                            total: calculated.total,
                            breakdown: flagBreakdown
                        },
                        createdAt: timestamp
                    });
                } else if (config?.mode === 'phased_game' || config?.mode === 'templar_triptych') {
                    const phaseScoresStr = formData.get('phaseScores') as string;
                    let submittedScores: any[] = [];
                    try {
                        submittedScores = phaseScoresStr ? JSON.parse(phaseScoresStr) : [];
                    } catch {
                        submittedScores = [];
                    }

                    const configuredSteps = Array.isArray(config?.phasedGame?.steps) && config.phasedGame.steps.length > 0
                        ? config.phasedGame.steps
                        : Array.from({
                            length: config?.mode === 'templar_triptych'
                                ? ([config?.triptychSections?.archery, config?.triptychSections?.rings, config?.triptychSections?.cans].filter(Boolean).length || 3)
                                : 0
                        }, (_, index) => ({ name: `Step ${index + 1}` }));
                    const phaseScores = configuredSteps.map((step: any, index: number) => ({
                        label: String(step?.name || '').trim() || `Step ${index + 1}`,
                        points: Math.max(0, parseInt(String(submittedScores[index]?.points)) || 0)
                    }));
                    const totalPhasedGamePoints = phaseScores.reduce((sum: number, phase: any) => {
                        return sum + (parseInt(String(phase.points)) || 0);
                    }, 0);
                    if (gameCompletionMetadata) {
                        gameCompletionMetadata.breakdown = phaseScores;
                    }

                    if (totalPhasedGamePoints !== 0) {
                        entries.push({
                            id: uuidv7(),
                            teamId,
                            ...idField,
                            eventType: 'special_bonus',
                            points: totalPhasedGamePoints,
                            description: `${challenge.name}: ${totalPhasedGamePoints}pt`,
                            judgeUserId,
                            metadata: {
                                source: 'phased_game',
                                elapsedSeconds,
                                breakdown: phaseScores
                            },
                            createdAt: timestamp
                        });
                    }
                } else {
                const penaltyCount = parseInt(formData.get('penaltyCount') as string) || 0;
                const bonusPoints = parseInt(formData.get('bonusPoints') as string) || 0;

                const timeBrackets = config?.timeBrackets || [];
                const penaltyPerObstacle = config?.penaltyPerObstacle || 0;

                // Find matching time bracket
                let bracket = { basePoints: 0, timeBonus: 0 };
                for (const b of timeBrackets) {
                    if (elapsedSeconds <= b.maxSeconds) {
                        bracket = { basePoints: b.basePoints, timeBonus: b.timeBonus };
                        break;
                    }
                }
                // If no bracket matched (exceeded all), use last bracket's malus
                if (timeBrackets.length > 0 && elapsedSeconds > timeBrackets[timeBrackets.length - 1].maxSeconds) {
                    bracket = { basePoints: 0, timeBonus: timeBrackets[timeBrackets.length - 1].timeBonus };
                }

                const timeScore = bracket.basePoints + bracket.timeBonus;
                const penaltyTotal = penaltyCount * penaltyPerObstacle;

                // Time-based score
                if (timeScore !== 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'time_bonus',
                        points: timeScore,
                        description: `Tempo: ${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60).toString().padStart(2, '0')} (base ${bracket.basePoints} + bonus ${bracket.timeBonus})`,
                        judgeUserId,
                        metadata: { elapsedSeconds, basePoints: bracket.basePoints, timeBonus: bracket.timeBonus },
                        createdAt: timestamp
                    });
                }

                // Penalty for obstacles
                if (penaltyTotal !== 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'obstacle_penalty',
                        points: penaltyTotal,
                        description: `Penalità: ${penaltyCount} ostacoli × ${penaltyPerObstacle}pt`,
                        judgeUserId,
                        metadata: { penaltyCount, penaltyPerObstacle },
                        createdAt: timestamp
                    });
                }

                // Bonus (Quintana)
                if (bonusPoints !== 0) {
                    const bonusName = config?.bonusOptions?.name || 'Bonus';
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'special_bonus',
                        points: bonusPoints,
                        description: `${bonusName}: ${bonusPoints > 0 ? '+' : ''}${bonusPoints}pt`,
                        judgeUserId,
                        metadata: { bonusName, bonusPoints },
                        createdAt: timestamp
                    });
                }

                // If total would be negative, add adjustment to bring to 0
                const rawTotal = timeScore + penaltyTotal + bonusPoints;
                if (rawTotal < 0) {
                    entries.push({
                        id: uuidv7(),
                        teamId,
                        ...idField,
                        eventType: 'adjustment',
                        points: -rawTotal, // Add positive amount to bring to 0
                        description: `Correzione minimo 0pt`,
                        judgeUserId,
                        createdAt: timestamp
                    });
                }
                }
            }

            if (game && entries.length === 0) {
                entries.push({
                    id: uuidv7(),
                    teamId,
                    ...idField,
                    eventType: 'adjustment',
                    points: 0,
                    description: `${challenge.name}: 0pt`,
                    judgeUserId,
                    metadata: {
                        source: 'game_completion',
                        elapsedSeconds
                    },
                    createdAt: timestamp
                });
            }

            if (entries.length === 0) {
                return fail(400, { message: 'Nessun punteggio da inviare' });
            }

            if (gameCompletionMetadata && !Array.isArray(gameCompletionMetadata.breakdown)) {
                gameCompletionMetadata.breakdown = entries.map((entry) => ({
                    label: entry.description || 'Punteggio',
                    points: entry.points
                }));
            }

            // Transactional insert
            await db.transaction(async (tx) => {
                // 1. Insert ledger entries
                for (const entry of entries) {
                    await tx.insert(scoreLedger).values(entry);
                }

                // 2. Update completion status
                const totalPoints = entries.reduce((acc, e) => acc + e.points, 0);

                if (game) {
                    await tx.insert(teamGameCompletions).values([{
                        id: uuidv7(),
                        teamId,
                        gameId: challengeId,
                        completedAt: timestamp,
                        arrivalRank: null,
                        totalPoints,
                        metadata: gameCompletionMetadata,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    }]).onConflictDoUpdate({
                        target: [teamGameCompletions.teamId, teamGameCompletions.gameId],
                        set: {
                            completedAt: timestamp,
                            arrivalRank: null,
                            totalPoints: sql`total_points + ${totalPoints}`,
                            metadata: gameCompletionMetadata,
                            updatedAt: timestamp
                        }
                    });
                } else {
                    await tx.insert(teamChallengeCompletions).values([{
                        id: uuidv7(),
                        teamId,
                        challengeId,
                        completedAt: timestamp,
                        arrivalRank: null,
                        totalPoints,
                        createdAt: timestamp,
                        updatedAt: timestamp
                    }]).onConflictDoUpdate({
                        target: [teamChallengeCompletions.teamId, teamChallengeCompletions.challengeId],
                        set: {
                            completedAt: timestamp,
                            arrivalRank: null,
                            totalPoints: sql`total_points + ${totalPoints}`,
                            updatedAt: timestamp
                        }
                    });
                }

                // 3. Update team score cache and CURRENT PHASE for leaderboard
                await tx.update(teams)
                    .set({
                        scoreCache: sql`score_cache + ${totalPoints}`,
                        currentPhaseId: challenge.phaseId || sql`current_phase_id`,
                        updatedAt: timestamp
                    })
                    .where(eq(teams.id, teamId));

                // 4. Activity log
                const [team] = await tx.select({ name: teams.name }).from(teams).where(eq(teams.id, teamId)).limit(1);
                await tx.insert(activityLogs).values([{
                    id: uuidv7(),
                    eventId: challenge.eventId,
                    teamId: teamId,
                    type: 'score_update',
                    content: isRefused
                        ? `Prova RIFIUTATA per ${team?.name || 'Squadra'}: 0pt in ${challenge.name}`
                        : `Inviato punteggio per ${team?.name || 'Squadra'}: ${totalPoints}pt in ${challenge.name}`,
                    createdAt: timestamp
                }]);
            });

            return { success: true };
        } catch (err: any) {
            console.error('Error in submitScore:', err);
            return fail(500, { message: `Errore Interno: ${err.message}` });
        }
    },
    cancelScore: async ({ request, locals }) => {
        ensureStaff(locals);
        const formData = await request.formData();
        const completionId = formData.get('completionId') as string;
        const challengeId = formData.get('challengeId') as string;

        if (!completionId || !challengeId) {
            return fail(400, { message: 'Dati mancanti (completionId o challengeId)' });
        }

        const [programChallenge] = await db
            .select()
            .from(challenges)
            .where(eq(challenges.id, challengeId))
            .limit(1);
        const game = programChallenge
            ? null
            : (await db.select().from(games).where(eq(games.id, challengeId)).limit(1))[0] || null;

        if (game) {
            const [completion] = await db
                .select()
                .from(teamGameCompletions)
                .where(eq(teamGameCompletions.id, completionId))
                .limit(1);
            if (!completion) return fail(404, { message: 'Completamento non trovato' });

            await assertStaffCanAccessTeam(locals, completion.teamId, game.eventId);

            const entries = await db
                .select({ id: scoreLedger.id, points: scoreLedger.points })
                .from(scoreLedger)
                .where(
                    and(
                        eq(scoreLedger.teamId, completion.teamId),
                        eq(scoreLedger.gameId, completion.gameId)
                    )
                );

            const pointsToRemove = entries.length > 0
                ? entries.reduce((sum, entry) => sum + entry.points, 0)
                : (completion.totalPoints || 0);

            const [team] = await db
                .select({ id: teams.id, name: teams.name })
                .from(teams)
                .where(eq(teams.id, completion.teamId))
                .limit(1);

            await db.transaction(async (tx) => {
                if (entries.length > 0) {
                    await tx
                        .delete(scoreLedger)
                        .where(sql`${scoreLedger.id} IN (${sql.join(entries.map((entry) => sql`${entry.id}`), sql`, `)})`);
                }
                if (pointsToRemove !== 0) {
                    await tx
                        .update(teams)
                        .set({
                            scoreCache: sql`score_cache - ${pointsToRemove}`,
                            updatedAt: new Date()
                        })
                        .where(eq(teams.id, completion.teamId));
                }
                await tx.delete(teamGameCompletions).where(eq(teamGameCompletions.id, completionId));

                await tx.insert(activityLogs).values([{
                    id: uuidv7(),
                    eventId: game.eventId,
                    teamId: completion.teamId,
                    type: 'score_update',
                    content: `Annullato gioco "${game.name}" per la squadra "${team?.name || 'Squadra'}" (punteggio stornato di ${pointsToRemove}pt per permettere di ripeterlo)`,
                    createdAt: new Date()
                }]);
            });
        } else if (programChallenge) {
            const [completion] = await db
                .select()
                .from(teamChallengeCompletions)
                .where(eq(teamChallengeCompletions.id, completionId))
                .limit(1);
            if (!completion) return fail(404, { message: 'Completamento non trovato' });

            await assertStaffCanAccessTeam(locals, completion.teamId, programChallenge.eventId);

            const entries = await db
                .select({ id: scoreLedger.id, points: scoreLedger.points })
                .from(scoreLedger)
                .where(
                    and(
                        eq(scoreLedger.teamId, completion.teamId),
                        eq(scoreLedger.challengeId, completion.challengeId)
                    )
                );

            const pointsToRemove = entries.length > 0
                ? entries.reduce((sum, entry) => sum + entry.points, 0)
                : (completion.totalPoints || 0);

            const [team] = await db
                .select({ id: teams.id, name: teams.name })
                .from(teams)
                .where(eq(teams.id, completion.teamId))
                .limit(1);

            await db.transaction(async (tx) => {
                if (entries.length > 0) {
                    await tx
                        .delete(scoreLedger)
                        .where(sql`${scoreLedger.id} IN (${sql.join(entries.map((entry) => sql`${entry.id}`), sql`, `)})`);
                }
                if (pointsToRemove !== 0) {
                    await tx
                        .update(teams)
                        .set({
                            scoreCache: sql`score_cache - ${pointsToRemove}`,
                            currentPhaseId: programChallenge.phaseId || sql`current_phase_id`,
                            updatedAt: new Date()
                        })
                        .where(eq(teams.id, completion.teamId));
                }
                await tx.delete(teamChallengeCompletions).where(eq(teamChallengeCompletions.id, completionId));

                await tx.insert(activityLogs).values([{
                    id: uuidv7(),
                    eventId: programChallenge.eventId,
                    teamId: completion.teamId,
                    type: 'score_update',
                    content: `Annullata attività "${programChallenge.name}" per la squadra "${team?.name || 'Squadra'}" (punteggio stornato di ${pointsToRemove}pt)`,
                    createdAt: new Date()
                }]);
            });
        }

        return { success: true, cancelled: true };
    }
};
