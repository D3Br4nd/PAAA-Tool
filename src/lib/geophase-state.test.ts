import { describe, expect, test } from 'bun:test';
import {
	boundedInteger,
	findCurrentGeoWaypoint,
	isGeoHuntDeadlineExpired,
	isGeoWaypointDone,
	selectActiveGeoHunt
} from './geophase-state';

describe('GeoPhase progression', () => {
	const waypoints = [
		{ id: 'one', challengeType: 'gps' },
		{ id: 'two', challengeType: 'photo' },
		{ id: 'three', challengeType: 'quiz' }
	];

	test('recognizes terminal states and pending photo handoff', () => {
		expect(isGeoWaypointDone('completed', 'quiz')).toBe(true);
		expect(isGeoWaypointDone('failed', 'gps')).toBe(true);
		expect(isGeoWaypointDone('photo_submitted', 'photo')).toBe(true);
		expect(isGeoWaypointDone('photo_submitted', 'quiz')).toBe(false);
		expect(isGeoWaypointDone('challenge_active', 'photo')).toBe(false);
	});

	test('returns the first incomplete waypoint and hunt-scoped count', () => {
		const result = findCurrentGeoWaypoint(waypoints, [
			{ waypointId: 'one', status: 'completed' },
			{ waypointId: 'two', status: 'challenge_active' },
			{ waypointId: 'outside-hunt', status: 'completed' }
		]);
		expect(result).toEqual({
			waypoint: waypoints[1],
			index: 1,
			completedCount: 1
		});
	});

	test('points past the end when every waypoint is done', () => {
		const result = findCurrentGeoWaypoint(waypoints, [
			{ waypointId: 'one', status: 'completed' },
			{ waypointId: 'two', status: 'photo_submitted' },
			{ waypointId: 'three', status: 'failed' }
		]);
		expect(result).toEqual({ waypoint: null, index: 3, completedCount: 3 });
	});

	test('keeps repeated GPS and photo modules independent by waypoint id', () => {
		const repeatedModules = [
			{ id: 'gps-one', challengeType: 'gps' },
			{ id: 'gps-two', challengeType: 'gps' },
			{ id: 'photo-one', challengeType: 'photo' },
			{ id: 'photo-two', challengeType: 'photo' }
		];

		expect(
			findCurrentGeoWaypoint(repeatedModules, [
				{ waypointId: 'gps-one', status: 'completed' }
			]).waypoint?.id
		).toBe('gps-two');

		expect(
			findCurrentGeoWaypoint(repeatedModules, [
				{ waypointId: 'gps-one', status: 'completed' },
				{ waypointId: 'gps-two', status: 'completed' },
				{ waypointId: 'photo-one', status: 'photo_submitted' }
			]).waypoint?.id
		).toBe('photo-two');
	});
});

describe('GeoPhase hunt selection and numeric limits', () => {
	test('prefers a faction hunt over a general fallback', () => {
		const hunts = [
			{ id: 'general', factionId: null },
			{ id: 'specific', factionId: 'faction-a' }
		];
		expect(selectActiveGeoHunt(hunts, 'faction-a')?.id).toBe('specific');
		expect(selectActiveGeoHunt(hunts, 'faction-b')?.id).toBe('general');
	});

	test('accepts only bounded integers', () => {
		expect(boundedInteger(20, 5, 500)).toBe(20);
		expect(boundedInteger(20.5, 5, 500)).toBeNull();
		expect(boundedInteger(Infinity, 5, 500)).toBeNull();
		expect(boundedInteger(501, 5, 500)).toBeNull();
	});

	test('closes a hunt exactly at its deadline and leaves hunts without one open', () => {
		const deadline = new Date('2026-08-23T10:30:00.000Z');
		expect(isGeoHuntDeadlineExpired(null, deadline.getTime() + 1)).toBe(false);
		expect(isGeoHuntDeadlineExpired(deadline, deadline.getTime() - 1)).toBe(false);
		expect(isGeoHuntDeadlineExpired(deadline, deadline.getTime())).toBe(true);
	});
});
