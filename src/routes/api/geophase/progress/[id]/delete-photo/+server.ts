/**
 * DELETE /api/geophase/progress/[id]/delete-photo
 *
 * Removes only an already-reviewed GeoPhase photo. Progress, status and points
 * remain untouched; pending submissions must first be approved or rejected.
 */
import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { removeGeoPhoto } from '$lib/server/geophase-photos';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}
	await ensureGeoPhaseSchema();

	const result = await db.transaction(async (tx) => {
		const [progress] = await tx
			.select()
			.from(teamGeoProgress)
			.where(eq(teamGeoProgress.id, params.id))
			.limit(1);
		if (!progress) return { status: 'missing' as const, photoPath: null };
		if (progress.status === 'photo_submitted') {
			return { status: 'pending' as const, photoPath: progress.photoPath };
		}
		if (!progress.photoPath) return { status: 'no_photo' as const, photoPath: null };

		await tx
			.update(teamGeoProgress)
			.set({ photoPath: null, updatedAt: new Date() })
			.where(eq(teamGeoProgress.id, progress.id));
		return { status: 'ok' as const, photoPath: progress.photoPath };
	});

	if (result.status === 'missing') throw error(404, { message: 'Progress not found' });
	if (result.status === 'pending') {
		throw error(409, { message: 'Approva o respingi la foto prima di cancellarla' });
	}
	if (result.status === 'no_photo') throw error(404, { message: 'Foto non presente' });

	try {
		await removeGeoPhoto(result.photoPath);
	} catch (cause) {
		await db
			.update(teamGeoProgress)
			.set({ photoPath: result.photoPath, updatedAt: new Date() })
			.where(eq(teamGeoProgress.id, params.id));
		throw error(500, { message: 'Impossibile cancellare il file della foto' });
	}

	return json({ success: true });
};
