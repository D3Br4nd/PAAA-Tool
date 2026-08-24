/**
 * GET /api/geophase/status
 *
 * Returns the active GeoHunt for the team's event and the team's current
 * waypoint progress. The quiz answer is NEVER sent to the client.
 */
import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { geoWaypoints, teamGeoProgress } from '$lib/server/schema';
import { eq, asc, and } from 'drizzle-orm';
import { loadTeamActivityEventContext } from '$lib/server/event-access';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { loadActiveGeoHuntForTeam } from '$lib/server/geophase';
import { findCurrentGeoWaypoint, isGeoHuntDeadlineExpired } from '$lib/geophase-state';
import { parseStoredQuizOptions } from '$lib/utils/quiz-options';
import { claimGeoPhaseSession } from '$lib/server/geophase-session';

export const GET: RequestHandler = async ({ locals }) => {
	await ensureGeoPhaseSchema();
	await claimGeoPhaseSession(locals);
	const { team, eventId } = await loadTeamActivityEventContext(locals);
	const teamId = team.id;

	const hunt = await loadActiveGeoHuntForTeam(team, eventId);

	if (!hunt) {
		return json({
			data: {
				hunt: null,
				deadlineExpired: false,
				currentWaypoint: null,
				progress: null,
				nextWaypointIndex: 0
			}
		});
	}

	// Get all waypoints ordered
	const waypoints = await db
		.select()
		.from(geoWaypoints)
		.where(eq(geoWaypoints.huntId, hunt.id))
		.orderBy(asc(geoWaypoints.sortOrder), asc(geoWaypoints.id));

	if (waypoints.length === 0) {
		return json({
			data: {
				hunt,
				deadlineExpired: isGeoHuntDeadlineExpired(hunt.deadlineAt),
				currentWaypoint: null,
				progress: null,
				nextWaypointIndex: 0,
				totalWaypoints: 0
			}
		});
	}

	const progressEntries = await db
		.select()
		.from(teamGeoProgress)
		.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.huntId, hunt.id)));

	const progressMap = new Map(progressEntries.map((p) => [p.waypointId, p]));
	const current = findCurrentGeoWaypoint(waypoints, progressEntries);
	const deadlineExpired = isGeoHuntDeadlineExpired(hunt.deadlineAt);
	const currentWaypointIndex = current.index;
	const currentWaypoint = current.waypoint;
	const currentProgress = currentWaypoint ? (progressMap.get(currentWaypoint.id) ?? null) : null;

	// Admin labels and correct answers are never exposed. Quiz content becomes
	// visible only after the server has started the timed challenge.
	const safeWaypoint = currentWaypoint
		? (({
			adminName: _adminName,
			quizAnswer: _quizAnswer,
			quizQuestion,
			quizOptions,
			...waypoint
		}) => ({
			...waypoint,
			quizQuestion: currentProgress?.status === 'challenge_active' ? quizQuestion : null,
			quizOptions:
				currentProgress?.status === 'challenge_active'
					? parseStoredQuizOptions(quizOptions)
					: null
		}))(currentWaypoint)
		: null;

	return json({
		data: {
			hunt,
			deadlineExpired,
			currentWaypoint: safeWaypoint,
			currentWaypointIndex,
			totalWaypoints: waypoints.length,
			progress: currentProgress,
			completedCount: current.completedCount
		}
	});
};
