/**
 * POST /api/geophase/progress/[id]/validate-photo
 *
 * Admin-only validation for submitted GeoPhase photos.
 * Body: { action: "approve" | "reject" }
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress, geoWaypoints } from '$lib/server/schema';
import { and, eq, sql } from 'drizzle-orm';
import { awardGeoPoints } from '$lib/server/geophase';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}
	await ensureGeoPhaseSchema();

	const body = await request.json().catch(() => null);
	const action = body && typeof body === 'object' ? (body as Record<string, unknown>).action : null;
	if (action !== 'approve' && action !== 'reject') {
		throw error(400, { message: 'action must be approve or reject' });
	}

	const now = new Date();
	const result = await db.transaction(async (tx) => {
		const [progress] = await tx
			.select()
			.from(teamGeoProgress)
			.where(eq(teamGeoProgress.id, params.id))
			.limit(1);
		if (!progress) return 'missing' as const;
		if (progress.status !== 'photo_submitted') return 'invalid_state' as const;

		const [waypoint] = await tx
			.select()
			.from(geoWaypoints)
			.where(eq(geoWaypoints.id, progress.waypointId))
			.limit(1);
		if (!waypoint) return 'missing_waypoint' as const;

		const pointsToAdd = action === 'approve' ? waypoint.pointsOnSuccess : 0;
		const updated = await tx
			.update(teamGeoProgress)
			.set({
				status: action === 'approve' ? 'completed' : 'failed',
				// completedAt is the photo handoff time. Older pending rows did not
				// store it yet, so their last update is the best available timestamp.
				completedAt: progress.completedAt ?? progress.updatedAt ?? now,
				pointsEarned: sql`points_earned + ${pointsToAdd}`,
				updatedAt: now
			})
			.where(
				and(eq(teamGeoProgress.id, progress.id), eq(teamGeoProgress.status, 'photo_submitted'))
			)
			.returning({ id: teamGeoProgress.id });
		if (updated.length !== 1) return 'invalid_state' as const;

		if (pointsToAdd > 0) {
			await awardGeoPoints(tx, {
				teamId: progress.teamId,
				waypoint,
				huntId: progress.huntId,
				points: pointsToAdd,
				kind: 'success'
			});
		}
		return 'ok' as const;
	});

	if (result === 'missing') throw error(404, { message: 'Progress not found' });
	if (result === 'missing_waypoint') throw error(404, { message: 'Waypoint not found' });
	if (result !== 'ok') throw error(409, { message: 'Photo is not pending validation' });

	return json({ success: true });
};
