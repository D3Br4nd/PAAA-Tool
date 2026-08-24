/**
 * DELETE /api/geophase/progress/[id]
 *
 * Admin-only reset of a team's GeoPhase progress for one waypoint. Removing the
 * progress row re-enables that waypoint in the player PWA.
 */
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { removeGeoPoints } from '$lib/server/geophase';
import { removeGeoPhoto } from '$lib/server/geophase-photos';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const photoPath = await db.transaction(async (tx) => {
		const [progress] = await tx
			.select()
			.from(teamGeoProgress)
			.where(eq(teamGeoProgress.id, params.id))
			.limit(1);
		if (!progress) return null;

		await removeGeoPoints(tx, {
			teamId: progress.teamId,
			waypointId: progress.waypointId
		});
		await tx.delete(teamGeoProgress).where(eq(teamGeoProgress.id, params.id));
		return progress.photoPath;
	});
	await removeGeoPhoto(photoPath);

	return new Response(null, { status: 204 });
};
