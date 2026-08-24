/**
 * POST /api/geophase/start-challenge
 *
 * Called after the player confirms the disclaimer (or immediately if none).
 * This is the moment the quiz timer officially starts (challengeStartedAt = SERVER time).
 *
 * Body: { waypointId: string }
 *
 * On success:
 *   - Sets status = 'challenge_active'
 *   - Sets challengeStartedAt = Date.now() (SERVER time, anti-cheat)
 *   - Returns quiz question (if quiz type) — answer is NEVER sent
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';
import { loadPlayerGeoWaypointContext } from '$lib/server/geophase';
import { uuidv7 } from '$lib/utils/uuidv7';
import { parseStoredQuizOptions } from '$lib/utils/quiz-options';

function hasQuiz(challengeType: string) {
	return challengeType === 'quiz';
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const { waypointId } = body as Record<string, unknown>;

	const { teamId, waypoint } = await loadPlayerGeoWaypointContext(locals, waypointId);

	const nowDate = new Date(Date.now());
	if (waypoint.challengeType === 'gps') {
		throw error(400, {
			message: 'GPS waypoints do not have a separate challenge'
		});
	}

	const result = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(teamGeoProgress)
			.values({
				id: uuidv7(),
				teamId,
				waypointId: waypoint.id,
				huntId: waypoint.huntId,
				status: 'challenge_active',
				challengeStartedAt: nowDate,
				pointsEarned: 0,
				createdAt: nowDate,
				updatedAt: nowDate
			})
			.onConflictDoNothing({
				target: [teamGeoProgress.teamId, teamGeoProgress.waypointId]
			})
			.returning({ id: teamGeoProgress.id });
		if (inserted.length === 1) return { success: true, alreadyActive: false, startedAt: nowDate };

		const [progress] = await tx
			.select()
			.from(teamGeoProgress)
			.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.waypointId, waypoint.id)))
			.limit(1);
		if (!progress) return { success: false, alreadyActive: false, startedAt: null };
		if (progress.status === 'challenge_active') {
			return {
				success: true,
				alreadyActive: true,
				startedAt: progress.challengeStartedAt
			};
		}
		if (progress.status !== 'arrived' && progress.status !== 'navigating') {
			return { success: false, alreadyActive: false, startedAt: null };
		}

		const updated = await tx
			.update(teamGeoProgress)
			.set({
				status: 'challenge_active',
				challengeStartedAt: nowDate,
				updatedAt: nowDate
			})
			.where(and(eq(teamGeoProgress.id, progress.id), eq(teamGeoProgress.status, progress.status)))
			.returning({ id: teamGeoProgress.id });
		return {
			success: updated.length === 1,
			alreadyActive: false,
			startedAt: nowDate
		};
	});

	if (!result.success) return json({ success: false, reason: 'invalid_state' }, { status: 409 });

	return json({
		success: true,
		alreadyActive: result.alreadyActive,
		challengeType: waypoint.challengeType,
		enigmaText: waypoint.enigmaText,
		quizQuestion: hasQuiz(waypoint.challengeType) ? waypoint.quizQuestion : null,
		quizOptions: hasQuiz(waypoint.challengeType)
			? parseStoredQuizOptions(waypoint.quizOptions)
			: null,
		quizTimeLimitSeconds: hasQuiz(waypoint.challengeType) ? waypoint.quizTimeLimitSeconds : null,
		challengeStartedAt: result.startedAt
	});
};
