import { createClient } from '@libsql/client';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import {
    challenges,
    challengeSteps,
    games,
    scoreLedger,
    teamChallengeCompletions,
    teamGameCompletions,
    teams
} from '../src/lib/server/schema';

const client = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
});
const db = drizzle(client);

function addToMap(map: Map<string, number>, key: string, points: number) {
    map.set(key, (map.get(key) || 0) + points);
}

function getProgramMaxPoints(challenge: typeof challenges.$inferSelect, steps: Array<typeof challengeSteps.$inferSelect>) {
    if (challenge.scoringType === 'checklist') {
        return challenge.basePoints
            + (challenge.config?.checklistItems || 0) * (challenge.config?.pointsPerItem || 0);
    }

    if (challenge.scoringType === 'attempt_based') {
        const stepsMax = steps.reduce((total, step) => {
            const bestRule = (step.scoringRules || []).reduce(
                (best, rule) => Math.max(best, rule.points || 0),
                0
            );
            return total + bestRule;
        }, 0);
        return challenge.basePoints + stepsMax;
    }

    return challenge.basePoints;
}

async function disableRankingBonuses() {
    const programChallenges = await db
        .select()
        .from(challenges)
        .where(eq(challenges.challengeType, 'program'));
    const programIds = programChallenges.map(challenge => challenge.id);
    const steps = programIds.length > 0
        ? await db.select().from(challengeSteps).where(inArray(challengeSteps.challengeId, programIds))
        : [];
    const activeBonusEntries = await db
        .select({
            id: scoreLedger.id,
            teamId: scoreLedger.teamId,
            challengeId: scoreLedger.challengeId,
            gameId: scoreLedger.gameId,
            points: scoreLedger.points
        })
        .from(scoreLedger)
        .where(and(eq(scoreLedger.eventType, 'ranking_bonus'), ne(scoreLedger.points, 0)));

    const pointsByTeam = new Map<string, number>();
    const pointsByChallengeCompletion = new Map<string, number>();
    const pointsByGameCompletion = new Map<string, number>();

    for (const entry of activeBonusEntries) {
        addToMap(pointsByTeam, entry.teamId, entry.points);
        if (entry.challengeId) {
            addToMap(pointsByChallengeCompletion, `${entry.teamId}:${entry.challengeId}`, entry.points);
        }
        if (entry.gameId) {
            addToMap(pointsByGameCompletion, `${entry.teamId}:${entry.gameId}`, entry.points);
        }
    }

    await db.transaction(async tx => {
        for (const challenge of programChallenges) {
            const config = challenge.config
                ? Object.fromEntries(Object.entries(challenge.config).filter(([key]) => key !== 'rankingBonusTable'))
                : null;
            await tx
                .update(challenges)
                .set({
                    hasRankingBonus: false,
                    maxPoints: getProgramMaxPoints(
                        challenge,
                        steps.filter(step => step.challengeId === challenge.id)
                    ),
                    config,
                    updatedAt: new Date()
                })
                .where(eq(challenges.id, challenge.id));
        }

        await tx
            .update(games)
            .set({ hasRankingBonus: false })
            .where(ne(games.hasRankingBonus, false));

        await tx
            .update(teamChallengeCompletions)
            .set({ arrivalRank: null })
            .where(isNotNull(teamChallengeCompletions.arrivalRank));
        await tx
            .update(teamGameCompletions)
            .set({ arrivalRank: null })
            .where(isNotNull(teamGameCompletions.arrivalRank));

        for (const [teamId, points] of pointsByTeam) {
            await tx
                .update(teams)
                .set({ scoreCache: sql`score_cache - ${points}`, updatedAt: new Date() })
                .where(eq(teams.id, teamId));
        }

        for (const [key, points] of pointsByChallengeCompletion) {
            const [teamId, challengeId] = key.split(':');
            await tx
                .update(teamChallengeCompletions)
                .set({ totalPoints: sql`total_points - ${points}`, updatedAt: new Date() })
                .where(and(
                    eq(teamChallengeCompletions.teamId, teamId),
                    eq(teamChallengeCompletions.challengeId, challengeId)
                ));
        }

        for (const [key, points] of pointsByGameCompletion) {
            const [teamId, gameId] = key.split(':');
            await tx
                .update(teamGameCompletions)
                .set({ totalPoints: sql`total_points - ${points}`, updatedAt: new Date() })
                .where(and(
                    eq(teamGameCompletions.teamId, teamId),
                    eq(teamGameCompletions.gameId, gameId)
                ));
        }

        if (activeBonusEntries.length > 0) {
            await tx
                .update(scoreLedger)
                .set({ points: 0, description: 'Punteggio annullato: regola non più attiva' })
                .where(inArray(scoreLedger.id, activeBonusEntries.map(entry => entry.id)));
        }
    });

    console.log(
        `Bonus classifica disabilitati; ${activeBonusEntries.length} movimenti storici azzerati.`
    );
}

disableRankingBonuses()
    .catch(error => {
        console.error('Disattivazione bonus classifica fallita:', error);
        process.exitCode = 1;
    })
    .finally(() => client.close());
