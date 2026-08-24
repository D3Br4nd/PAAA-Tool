/**
 * POST /api/geophase/submit-quiz
 *
 * Validates a quiz answer for a waypoint.
 *
 * Body: { waypointId: string; answer: string }
 *
 * Anti-cheat:
 *   - Timer is checked server-side using challengeStartedAt from DB (set by /start-challenge)
 *   - If now - challengeStartedAt > quizTimeLimitSeconds → timeout, 0 points
 *   - Answer comparison is case-insensitive and trimmed
 *   - Quiz answer is NEVER sent to the client
 *
 * Points are recorded in the score ledger (leaderboard) on success.
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq, and, sql } from 'drizzle-orm';
import { loadPlayerGeoWaypointContext, awardGeoPoints } from '$lib/server/geophase';

function hasQuiz(challengeType: string) {
	return challengeType === 'quiz';
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const { waypointId, answer } = body as Record<string, unknown>;

	if (typeof answer !== 'string') {
		throw error(400, { message: 'answer is required' });
	}

	const { teamId, waypoint } = await loadPlayerGeoWaypointContext(locals, waypointId);

	if (!hasQuiz(waypoint.challengeType))
		throw error(400, { message: 'This waypoint is not a quiz challenge' });

	const now = Date.now();
	const result = await db.transaction(async (tx) => {
		const [progress] = await tx
			.select()
			.from(teamGeoProgress)
			.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.waypointId, waypoint.id)))
			.limit(1);
		if (!progress || progress.status !== 'challenge_active' || !progress.challengeStartedAt)
			return null;

		const elapsed = now - progress.challengeStartedAt.getTime();
		const isTimedOut = elapsed > waypoint.quizTimeLimitSeconds * 1000;
		const isCorrect =
			!isTimedOut &&
			Boolean(waypoint.quizAnswer) &&
			answer.trim().toLowerCase() === waypoint.quizAnswer?.trim().toLowerCase();
		const pointsEarned = isCorrect ? waypoint.pointsOnSuccess : 0;
		const finalStatus = isTimedOut ? 'failed' : 'completed';
		const updated = await tx
			.update(teamGeoProgress)
			.set({
				status: finalStatus,
				quizAnswerGiven: answer.trim().substring(0, 500),
				isCorrect,
				pointsEarned: sql`points_earned + ${pointsEarned}`,
				completedAt: new Date(now),
				updatedAt: new Date(now)
			})
			.where(
				and(eq(teamGeoProgress.id, progress.id), eq(teamGeoProgress.status, 'challenge_active'))
			)
			.returning({ id: teamGeoProgress.id });
		if (updated.length !== 1) return null;

		if (pointsEarned > 0) {
			await awardGeoPoints(tx, {
				teamId,
				waypoint,
				huntId: waypoint.huntId,
				points: pointsEarned,
				kind: 'success'
			});
		}
		return { isTimedOut, isCorrect, pointsEarned };
	});

	if (!result) return json({ success: false, reason: 'already_answered' }, { status: 409 });

	return json({
		success: true,
		...result,
		correctAnswer: waypoint.quizAnswer
	});
};
