/**
 * geo.ts — GeoPhase utilities
 * Haversine distance, compass bearing, and client-side image preparation.
 * Math functions are pure TS (SSR-safe). compressImage is browser-only.
 */

const EARTH_RADIUS_M = 6_371_000;
export const MAX_GEO_PHOTO_BYTES = 12 * 1024 * 1024;
const GEO_PHOTO_PASSTHROUGH_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/gif'
]);

export type GeoPoint = { lat: number; lng: number };

export function parseLatitude(value: unknown): number | null {
	if (
		(typeof value !== 'number' && typeof value !== 'string') ||
		(typeof value === 'string' && !value.trim())
	)
		return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= -90 && parsed <= 90 ? parsed : null;
}

export function parseLongitude(value: unknown): number | null {
	if (
		(typeof value !== 'number' && typeof value !== 'string') ||
		(typeof value === 'string' && !value.trim())
	)
		return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= -180 && parsed <= 180 ? parsed : null;
}

export function parseGeoPoint(lat: unknown, lng: unknown): GeoPoint | null {
	const parsedLat = parseLatitude(lat);
	const parsedLng = parseLongitude(lng);
	return parsedLat === null || parsedLng === null ? null : { lat: parsedLat, lng: parsedLng };
}

export function maxAcceptableGpsAccuracy(radiusMeters: number): number {
	return Math.min(50, Math.max(20, radiusMeters));
}

/** Convert degrees to radians */
function toRad(deg: number): number {
	return deg * (Math.PI / 180);
}

/**
 * Haversine distance between two lat/lng points, in metres.
 * Safe to call on server or client.
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
	const φ1 = toRad(a.lat);
	const φ2 = toRad(b.lat);
	const Δφ = toRad(b.lat - a.lat);
	const Δλ = toRad(b.lng - a.lng);

	const raw =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const x = Math.min(1, Math.max(0, raw));

	return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Compass bearing (0–360°) from point `from` to point `to`.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 * Safe to call on server or client.
 */
export function getBearing(from: GeoPoint, to: GeoPoint): number {
	const φ1 = toRad(from.lat);
	const φ2 = toRad(to.lat);
	const Δλ = toRad(to.lng - from.lng);

	const y = Math.sin(Δλ) * Math.cos(φ2);
	const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

	return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Check whether position `pos` is within `radiusMeters` of `target`.
 * Returns true if inside the geofence.
 */
export function isWithinRadius(pos: GeoPoint, target: GeoPoint, radiusMeters: number): boolean {
	return haversineDistance(pos, target) <= radiusMeters;
}

/**
 * Tilt-compensated heading for absolute DeviceOrientation readings.
 * Formula from the W3C Device Orientation specification, appendix A.1.
 */
export function getCompassHeading(alpha: number, beta: number, gamma: number): number {
	if (![alpha, beta, gamma].every(Number.isFinite)) return Number.NaN;
	const x = toRad(beta);
	const y = toRad(gamma);
	const z = toRad(alpha);
	const cX = Math.cos(x);
	const cY = Math.cos(y);
	const cZ = Math.cos(z);
	const sX = Math.sin(x);
	const sY = Math.sin(y);
	const sZ = Math.sin(z);
	const vectorX = -cZ * sY - sZ * sX * cY;
	const vectorY = -sZ * sY + cZ * sX * cY;

	if (Math.abs(vectorX) < Number.EPSILON && Math.abs(vectorY) < Number.EPSILON) {
		return (((360 - alpha) % 360) + 360) % 360;
	}

	return ((Math.atan2(vectorX, vectorY) * 180) / Math.PI + 360) % 360;
}

/**
 * Format a distance in metres as a human-readable string.
 * e.g. 47 → "47 m", 1234 → "1.2 km"
 */
export function formatDistance(meters: number): string {
	if (meters < 1000) {
		return `${Math.round(meters)} m`;
	}
	return `${(meters / 1000).toFixed(1)} km`;
}

// ---------------------------------------------------------------------------
// Browser-only: image compression via Canvas API
// ---------------------------------------------------------------------------

/**
 * Compress an image File to JPEG, scaling it down to maxSizePx if needed.
 * Returns a Blob ready for upload.
 * Only call this in browser context (inside onMount / $effect).
 *
 * @param file       - Source File (from <input type="file">)
 * @param maxSizePx  - Max width or height in pixels (default 2560)
 * @param quality    - JPEG quality 0–1 (default 0.92)
 */
export async function compressImage(file: File, maxSizePx = 2560, quality = 0.92): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		const url = URL.createObjectURL(file);

		img.onload = () => {
			URL.revokeObjectURL(url);

			const scale = Math.min(maxSizePx / img.width, maxSizePx / img.height, 1);
			const w = Math.round(img.width * scale);
			const h = Math.round(img.height * scale);

			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;

			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Canvas 2D context not available'));
				return;
			}
			ctx.drawImage(img, 0, 0, w, h);

			canvas.toBlob(
				(blob) => {
					if (blob) resolve(blob);
					else reject(new Error('Canvas toBlob returned null'));
				},
				'image/jpeg',
				quality
			);
		};

		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Failed to load image'));
		};

		img.src = url;
	});
}

export function canUploadGeoPhotoOriginal(file: Pick<File, 'size' | 'type'>) {
	return file.size > 0 && file.size <= MAX_GEO_PHOTO_BYTES && GEO_PHOTO_PASSTHROUGH_TYPES.has(file.type);
}

/** Preserves camera detail whenever the server can accept the original file. */
export async function prepareGeoPhoto(file: File): Promise<Blob> {
	if (canUploadGeoPhotoOriginal(file)) return file;
	return compressImage(file, 3200, 0.95);
}

/**
 * Request iOS DeviceOrientationEvent permission (required on iOS 13+).
 * Returns true if granted or not needed (non-iOS).
 * Call this only from a direct user gesture (button click).
 */
export async function requestOrientationPermission(): Promise<boolean> {
	if (typeof DeviceOrientationEvent === 'undefined') return false;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const DOE = DeviceOrientationEvent as any;
	if (typeof DOE.requestPermission === 'function') {
		try {
			const result: string = await DOE.requestPermission(true);
			return result === 'granted';
		} catch {
			try {
				const result: string = await DOE.requestPermission();
				return result === 'granted';
			} catch {
				return false;
			}
		}
	}
	// Non-iOS: permission not needed
	return true;
}
