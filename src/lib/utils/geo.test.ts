import { describe, expect, test } from 'bun:test';
import {
	MAX_GEO_PHOTO_BYTES,
	canUploadGeoPhotoOriginal,
	getBearing,
	getCompassHeading,
	haversineDistance,
	isWithinRadius,
	maxAcceptableGpsAccuracy,
	parseGeoPoint,
	parseLatitude,
	parseLongitude
} from './geo';

describe('GeoPhase coordinate validation', () => {
	test('accepts finite WGS84 coordinates', () => {
		expect(parseGeoPoint('41.9028', 12.4964)).toEqual({
			lat: 41.9028,
			lng: 12.4964
		});
		expect(parseLatitude(-90)).toBe(-90);
		expect(parseLongitude(180)).toBe(180);
	});

	test('rejects empty, non-finite and out-of-range coordinates', () => {
		expect(parseGeoPoint('', 12)).toBeNull();
		expect(parseGeoPoint('Infinity', 12)).toBeNull();
		expect(parseGeoPoint(91, 12)).toBeNull();
		expect(parseGeoPoint(41, -181)).toBeNull();
	});
});

describe('GeoPhase geodesy', () => {
	const rome = { lat: 41.9028, lng: 12.4964 };
	const milan = { lat: 45.4642, lng: 9.19 };

	test('calculates known distances and bearings', () => {
		expect(haversineDistance(rome, rome)).toBe(0);
		expect(haversineDistance(rome, milan)).toBeWithin(476_000, 478_000);
		expect(getBearing(rome, milan)).toBeWithin(326, 328);
	});

	test('stays finite for antipodal points', () => {
		const distance = haversineDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
		expect(Number.isFinite(distance)).toBe(true);
		expect(distance).toBeWithin(20_000_000, 20_020_000);
	});

	test('checks event-scale geofences', () => {
		expect(isWithinRadius(rome, { lat: 41.9029, lng: 12.4964 }, 20)).toBe(true);
		expect(isWithinRadius(rome, { lat: 41.904, lng: 12.4964 }, 20)).toBe(false);
	});

	test('uses bounded GPS accuracy thresholds', () => {
		expect(maxAcceptableGpsAccuracy(5)).toBe(20);
		expect(maxAcceptableGpsAccuracy(30)).toBe(30);
		expect(maxAcceptableGpsAccuracy(500)).toBe(50);
	});

	test('calculates tilt-compensated absolute headings', () => {
		expect(getCompassHeading(90, 0, 0)).toBeCloseTo(270, 5);
		expect(getCompassHeading(90, 90, 0)).toBeCloseTo(270, 5);
		expect(Number.isNaN(getCompassHeading(Number.NaN, 0, 0))).toBe(true);
	});
});

describe('GeoPhase photo preparation', () => {
	test('preserves supported originals within the upload limit', () => {
		expect(canUploadGeoPhotoOriginal({ type: 'image/jpeg', size: 4 * 1024 * 1024 })).toBe(true);
		expect(canUploadGeoPhotoOriginal({ type: 'image/png', size: MAX_GEO_PHOTO_BYTES })).toBe(true);
	});

	test('re-encodes unsupported or oversized originals', () => {
		expect(canUploadGeoPhotoOriginal({ type: 'image/heic', size: 4 * 1024 * 1024 })).toBe(false);
		expect(
			canUploadGeoPhotoOriginal({ type: 'image/jpeg', size: MAX_GEO_PHOTO_BYTES + 1 })
		).toBe(false);
		expect(canUploadGeoPhotoOriginal({ type: 'image/jpeg', size: 0 })).toBe(false);
	});
});
