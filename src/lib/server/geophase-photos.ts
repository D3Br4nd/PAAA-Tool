import { rm, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export const GEO_PHOTO_UPLOAD_BASE = '/app/uploads/geohunt_photos';

function isSafePathSegment(value: string): boolean {
	return Boolean(value) && !value.includes('..') && !value.includes('/') && !value.includes('\\');
}

export function getGeoPhotoPath(teamId: string, filename: string): string | null {
	if (!isSafePathSegment(teamId) || !isSafePathSegment(filename)) return null;
	return join(GEO_PHOTO_UPLOAD_BASE, teamId, filename);
}

export function getGeoPhotoPathFromRelative(relativePath: string): string | null {
	const parts = relativePath.split('/');
	if (parts.length !== 2) return null;
	return getGeoPhotoPath(parts[0], parts[1]);
}

export async function removeGeoPhoto(relativePath: string | null): Promise<void> {
	if (!relativePath) return;
	const filePath = getGeoPhotoPathFromRelative(relativePath);
	if (!filePath) return;
	try {
		await unlink(filePath);
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') throw cause;
	}
}

export async function removeAllGeoPhotos(): Promise<void> {
	await rm(GEO_PHOTO_UPLOAD_BASE, { recursive: true, force: true });
}
