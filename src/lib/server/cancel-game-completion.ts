import { games, scoreLedger, teamGameCompletions, teams, activityLogs } from '$lib/server/schema';
import { and, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

export interface CancelGameCompletionResult {
	success: boolean;
	pointsRemoved: number;
	teamId: string;
	gameId: string;
	gameName: string;
	teamName: string;
}

async function getDefaultDb() {
	const dbModule = await import('$lib/server/db');
	return dbModule.db;
}

export async function cancelGameCompletion(
	completionId: string,
	customDb?: any
): Promise<CancelGameCompletionResult | null> {
	const activeDb = customDb ?? (await getDefaultDb());

	const [completion] = await activeDb
		.select()
		.from(teamGameCompletions)
		.where(eq(teamGameCompletions.id, completionId))
		.limit(1);

	if (!completion) return null;

	const entries = await activeDb
		.select({ id: scoreLedger.id, points: scoreLedger.points })
		.from(scoreLedger)
		.where(
			and(
				eq(scoreLedger.teamId, completion.teamId),
				eq(scoreLedger.gameId, completion.gameId)
			)
		);

	const pointsToRemove = entries.length > 0
		? entries.reduce((sum: number, entry: any) => sum + entry.points, 0)
		: (completion.totalPoints || 0);

	const [game] = await activeDb
		.select({ id: games.id, name: games.name, eventId: games.eventId })
		.from(games)
		.where(eq(games.id, completion.gameId))
		.limit(1);

	const [team] = await activeDb
		.select({ id: teams.id, name: teams.name })
		.from(teams)
		.where(eq(teams.id, completion.teamId))
		.limit(1);

	await activeDb.transaction(async (tx: any) => {
		if (entries.length > 0) {
			await tx
				.delete(scoreLedger)
				.where(sql`${scoreLedger.id} IN (${sql.join(entries.map((entry: any) => sql`${entry.id}`), sql`, `)})`);
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

		if (game) {
			await tx.insert(activityLogs).values([{
				id: uuidv7(),
				eventId: game.eventId,
				teamId: completion.teamId,
				type: 'score_update',
				content: `Annullato gioco "${game.name}" per la squadra "${team?.name || 'Squadra'}" (punteggio stornato di ${pointsToRemove}pt per permettere di ripeterlo)`,
				createdAt: new Date()
			}]);
		}
	});

	return {
		success: true,
		pointsRemoved: pointsToRemove,
		teamId: completion.teamId,
		gameId: completion.gameId,
		gameName: game?.name || 'Gioco',
		teamName: team?.name || 'Squadra'
	};
}
