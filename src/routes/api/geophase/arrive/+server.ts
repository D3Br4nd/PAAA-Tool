/**
 * POST /api/geophase/arrive
 *
 * Called when the client thinks it has entered the waypoint radius.
 * The server re-validates the distance using Haversine — client position is
 * accepted as input but arrival is only confirmed if distance ≤ radiusMeters.
 *
 * Body: { waypointId, lat, lng, accuracy, positionTimestamp }
 *
 * On success:
 *   - Creates team_geo_progress with status = 'completed'
 *   - Awards arrival points to the score ledger (first arrival only)
 *   - Returns the points earned
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { haversineDistance, maxAcceptableGpsAccuracy, parseGeoPoint } from '$lib/utils/geo';
import { uuidv7 } from '$lib/utils/uuidv7';
import { loadPlayerGeoWaypointContext, awardGeoPoints } from '$lib/server/geophase';
import { GEO_LIMITS } from '$lib/geophase-state';

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const { waypointId, lat, lng, accuracy, positionTimestamp } = body as Record<string, unknown>;
	if (typeof lat !== 'number' || typeof lng !== 'number') {
		throw error(400, { message: 'Valid numeric lat/lng are required' });
	}
	const clientPoint = parseGeoPoint(lat, lng);
	if (!clientPoint)
		throw error(400, {
			message: 'Latitude or longitude is outside the valid range'
		});
	if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0) {
		throw error(400, { message: 'Valid GPS accuracy is required' });
	}
	if (typeof positionTimestamp !== 'number' || !Number.isFinite(positionTimestamp)) {
		throw error(400, { message: 'Valid GPS position timestamp is required' });
	}
	const positionAgeMs = Date.now() - positionTimestamp;
	if (
		positionAgeMs > GEO_LIMITS.maxPositionAgeMs ||
		positionAgeMs < -GEO_LIMITS.maxPositionFutureSkewMs
	) {
		return json({ success: false, reason: 'stale_position' });
	}

	const { teamId, waypoint } = await loadPlayerGeoWaypointContext(locals, waypointId);
	if (waypoint.challengeType !== 'gps') {
		throw error(400, { message: 'This step is not a GPS module' });
	}

	const targetPoint = parseGeoPoint(waypoint.lat, waypoint.lng);
	if (!targetPoint) throw error(500, { message: 'Waypoint coordinates are invalid' });
	const acceptedAccuracy = maxAcceptableGpsAccuracy(waypoint.radiusMeters);
	if (accuracy > acceptedAccuracy) {
		return json({
			success: false,
			reason: 'low_accuracy',
			accuracy,
			acceptedAccuracy
		});
	}

	// This verifies geofence consistency, but browser-provided GPS data is not attestable.
	const distance = haversineDistance(clientPoint, targetPoint);
	if (!Number.isFinite(distance)) throw error(400, { message: 'Unable to calculate GPS distance' });

	if (distance > waypoint.radiusMeters) {
		return json({
			success: false,
			reason: 'too_far',
			distance: Math.round(distance),
			radiusMeters: waypoint.radiusMeters
		});
	}

	const nowDate = new Date();
	const changed = await db.transaction(async (tx) => {
		const [existing] = await tx
			.select()
			.from(teamGeoProgress)
			.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.waypointId, waypoint.id)))
			.limit(1);

		let transitionApplied = false;
		if (existing) {
			if (existing.status !== 'navigating') return false;
			const updated = await tx
				.update(teamGeoProgress)
				.set({
					status: 'completed',
					arrivedAt: nowDate,
					completedAt: nowDate,
					pointsEarned: waypoint.pointsOnArrival,
					updatedAt: nowDate
				})
				.where(
					and(
						eq(teamGeoProgress.id, existing.id),
						eq(teamGeoProgress.status, 'navigating'),
						isNull(teamGeoProgress.arrivedAt)
					)
				)
				.returning({ id: teamGeoProgress.id });
			transitionApplied = updated.length === 1;
		} else {
			const inserted = await tx
				.insert(teamGeoProgress)
				.values({
					id: uuidv7(),
					teamId,
					waypointId: waypoint.id,
					huntId: waypoint.huntId,
					status: 'completed',
					arrivedAt: nowDate,
					completedAt: nowDate,
					pointsEarned: waypoint.pointsOnArrival,
					createdAt: nowDate,
					updatedAt: nowDate
				})
				.onConflictDoNothing({
					target: [teamGeoProgress.teamId, teamGeoProgress.waypointId]
				})
				.returning({ id: teamGeoProgress.id });
			transitionApplied = inserted.length === 1;
		}

		if (!transitionApplied) return false;
		await awardGeoPoints(tx, {
			teamId,
			waypoint,
			huntId: waypoint.huntId,
			points: waypoint.pointsOnArrival,
			kind: 'arrival',
			metadata: {
				distanceMeters: Math.round(distance),
				gpsAccuracyMeters: Math.round(accuracy),
				positionAgeMs: Math.max(0, Math.round(positionAgeMs))
			}
		});
		return true;
	});

	if (!changed) return json({ success: false, reason: 'already_done' });

	return json({
		success: true,
		alreadyArrived: false,
		challengeType: waypoint.challengeType,
		enigmaText: waypoint.enigmaText,
		challengeDisclaimerText: waypoint.challengeDisclaimerText,
		quizTimeLimitSeconds: null,
		pointsOnArrivalEarned: waypoint.pointsOnArrival,
		currentStatus: 'completed'
	});
};
