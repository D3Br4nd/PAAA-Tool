/**
 * POST /api/geophase/skip
 *
 * Skips either:
 * - navigation: loses arrival points and starts the waypoint challenge
 * - challenge: marks the waypoint as failed, awards no points, and advances
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from '$lib/utils/uuidv7';
import { loadPlayerGeoWaypointContext } from '$lib/server/geophase';
import { parseStoredQuizOptions } from '$lib/utils/quiz-options';

function hasQuiz(challengeType: string) {
	return challengeType === 'quiz';
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const { waypointId, mode } = body as Record<string, unknown>;
	if (mode !== 'navigation' && mode !== 'challenge') {
		throw error(400, { message: 'mode must be navigation or challenge' });
	}
	const { teamId, waypoint } = await loadPlayerGeoWaypointContext(locals, waypointId);
	const now = new Date();
	const targetStatus =
		mode === 'navigation' && waypoint.challengeType !== 'gps' ? 'challenge_active' : 'failed';
	const changed = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(teamGeoProgress)
			.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.waypointId, waypoint.id)))
			.limit(1);
		if (existing && (existing.status === 'completed' || existing.status === 'failed')) return false;
		if (existing && mode === 'navigation' && existing.status === 'challenge_active') return false;

		if (existing) {
			const updated = await tx
				.update(teamGeoProgress)
				.set({
					status: targetStatus,
					challengeStartedAt:
						targetStatus === 'challenge_active'
							? (existing.challengeStartedAt ?? now)
							: existing.challengeStartedAt,
					completedAt: targetStatus === 'failed' ? now : existing.completedAt,
					updatedAt: now
				})
				.where(
					and(eq(teamGeoProgress.id, existing.id), eq(teamGeoProgress.status, existing.status))
				)
				.returning({ id: teamGeoProgress.id });
			return updated.length === 1;
		}

		const inserted = await tx
			.insert(teamGeoProgress)
			.values({
				id: uuidv7(),
				teamId,
				waypointId: waypoint.id,
				huntId: waypoint.huntId,
				status: targetStatus,
				challengeStartedAt: targetStatus === 'challenge_active' ? now : null,
				completedAt: targetStatus === 'failed' ? now : null,
				pointsEarned: 0,
				createdAt: now,
				updatedAt: now
			})
			.onConflictDoNothing({
				target: [teamGeoProgress.teamId, teamGeoProgress.waypointId]
			})
			.returning({ id: teamGeoProgress.id });
		return inserted.length === 1;
	});

	if (!changed) return json({ success: false, reason: 'invalid_state' }, { status: 409 });
	if (mode === 'navigation' && waypoint.challengeType === 'gps') {
		return json({ success: true, mode: 'navigation', completed: true });
	}
	if (mode === 'navigation') {
		return json({
			success: true,
			mode: 'navigation',
			challengeType: waypoint.challengeType,
			enigmaText: waypoint.enigmaText,
			challengeDisclaimerText: waypoint.challengeDisclaimerText,
			quizQuestion: hasQuiz(waypoint.challengeType) ? waypoint.quizQuestion : null,
			quizOptions: hasQuiz(waypoint.challengeType)
				? parseStoredQuizOptions(waypoint.quizOptions)
				: null,
			quizTimeLimitSeconds: hasQuiz(waypoint.challengeType) ? waypoint.quizTimeLimitSeconds : null,
			challengeStartedAt: now
		});
	}
	return json({ success: true });
};
