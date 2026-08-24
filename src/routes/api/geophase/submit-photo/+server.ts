/**
 * POST /api/geophase/submit-photo
 *
 * Accepts a multipart/form-data upload with fields:
 *   - photo: File (JPEG/PNG/WebP, should be pre-compressed client-side)
 *   - waypointId: string
 *
 * Validates the image by magic bytes (not just the declared MIME type).
 * Generates a UUID-based filename (no path traversal possible).
 * Saves to /app/uploads/geohunt_photos/{teamId}/{uuid}.{ext}
 * Updates progress → photo_submitted. Points are awarded later by admin
 * validation from the GeoPhase dashboard.
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teamGeoProgress } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';
import { uuidv7 } from '$lib/utils/uuidv7';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadPlayerGeoWaypointContext } from '$lib/server/geophase';
import { readValidatedImage } from '$lib/server/uploads';
import { getGeoPhotoPath, removeGeoPhoto } from '$lib/server/geophase-photos';

function hasPhoto(challengeType: string) {
	return challengeType === 'photo';
}

const MAX_GEO_PHOTO_SIZE = 12 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
	let formData: FormData;
	try {
		formData = await request.formData();
	} catch {
		throw error(400, { message: 'Invalid multipart form data' });
	}

	const waypointId = formData.get('waypointId');
	const photo = formData.get('photo');

	if (!(photo instanceof File)) {
		throw error(400, { message: 'photo file is required' });
	}

	const { teamId, waypoint } = await loadPlayerGeoWaypointContext(locals, waypointId);

	if (!hasPhoto(waypoint.challengeType))
		throw error(400, { message: 'This waypoint is not a photo challenge' });

	// Content validation: magic bytes + size (client MIME type is not trusted)
	const image = await readValidatedImage(photo, MAX_GEO_PHOTO_SIZE);
	if (!image) {
		throw error(400, {
			message: 'Sono ammesse immagini JPEG, PNG, GIF o WebP fino a 12 MB'
		});
	}

	// Check progress exists and is in the right state
	const [progress] = await db
		.select()
		.from(teamGeoProgress)
		.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.waypointId, waypoint.id)))
		.limit(1);

	if (!progress || progress.status !== 'challenge_active') {
		return json({ success: false, reason: 'challenge_not_active' }, { status: 409 });
	}

	// Save file: /app/uploads/geohunt_photos/{teamId}/{uuid}.{ext}
	const fileName = `${uuidv7()}.${image.ext}`;
	// Safe path — teamId comes from session (not user input), fileName is UUID
	const relativePath = `${teamId}/${fileName}`;
	const filePath = getGeoPhotoPath(teamId, fileName);
	if (!filePath) throw error(500, { message: 'Unable to build upload path' });

	let fileWritten = false;
	try {
		await mkdir(dirname(filePath), { recursive: true });
		await writeFile(filePath, image.buffer, { flag: 'wx' });
		fileWritten = true;
		const submittedAt = new Date();
		const updated = await db
			.update(teamGeoProgress)
			.set({
				status: 'photo_submitted',
				photoPath: relativePath,
				// Preserve the actual handoff time. Admin approval may happen later
				// and must not make the team's Phase 1 delivery look slower.
				completedAt: submittedAt,
				updatedAt: submittedAt
			})
			.where(
				and(eq(teamGeoProgress.id, progress.id), eq(teamGeoProgress.status, 'challenge_active'))
			)
			.returning({ id: teamGeoProgress.id });
		if (updated.length !== 1) {
			await removeGeoPhoto(relativePath);
			fileWritten = false;
			return json({ success: false, reason: 'challenge_not_active' }, { status: 409 });
		}
	} catch (cause) {
		if (fileWritten) await removeGeoPhoto(relativePath).catch(() => undefined);
		throw cause;
	}

	return json({
		success: true,
		photoUrl: `/api/geophase/photos/${relativePath}`,
		pointsEarned: 0,
		pendingValidation: true
	});
};
