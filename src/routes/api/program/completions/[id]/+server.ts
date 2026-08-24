import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { challenges, scoreLedger, teamChallengeCompletions, teams } from '$lib/server/schema';
import { and, eq, sql } from 'drizzle-orm';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const [completion] = await db
		.select()
		.from(teamChallengeCompletions)
		.where(eq(teamChallengeCompletions.id, params.id))
		.limit(1);

	if (!completion) return new Response(null, { status: 204 });

	const entries = await db
		.select({ id: scoreLedger.id, points: scoreLedger.points })
		.from(scoreLedger)
		.where(
			and(
				eq(scoreLedger.teamId, completion.teamId),
				eq(scoreLedger.challengeId, completion.challengeId)
			)
		);

	const pointsToRemove = entries.reduce((sum, entry) => sum + entry.points, 0);
	const [challenge] = await db
		.select({ phaseId: challenges.phaseId })
		.from(challenges)
		.where(eq(challenges.id, completion.challengeId))
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
					currentPhaseId: challenge?.phaseId || sql`current_phase_id`,
					updatedAt: new Date()
				})
				.where(eq(teams.id, completion.teamId));
		} else if (challenge?.phaseId) {
			await tx
				.update(teams)
				.set({ currentPhaseId: challenge.phaseId, updatedAt: new Date() })
				.where(eq(teams.id, completion.teamId));
		}
		await tx.delete(teamChallengeCompletions).where(eq(teamChallengeCompletions.id, params.id));
	});

	return new Response(null, { status: 204 });
};
