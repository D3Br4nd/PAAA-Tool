/**
 * GET /api/geophase/photos/[teamId]/[filename]
 *
 * Serves uploaded geo hunt photos. Only accessible to admin/staff or the
 * team that owns the photo.
 */
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { getGeoPhotoPath } from '$lib/server/geophase-photos';

const MIME_MAP: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp'
};

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, { message: 'Authentication required' });

	const { teamId, filename } = params;

	const filePath = getGeoPhotoPath(teamId, filename);
	if (!filePath) throw error(400, { message: 'Invalid photo path' });

	// Access control: admin/staff see all; players see only their own team's photos
	const isStaff = locals.user.role === 'admin' || locals.user.role === 'staff';
	if (!isStaff && locals.user.teamId !== teamId) {
		throw error(403, { message: 'Access denied' });
	}

	if (!existsSync(filePath)) {
		throw error(404, { message: 'Photo not found' });
	}

	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	const contentType = MIME_MAP[ext] ?? 'application/octet-stream';

	const file = await readFile(filePath);

	return new Response(file, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'private, no-store, max-age=0',
			Pragma: 'no-cache'
		}
	});
};
