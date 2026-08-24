import { describe, expect, test } from 'bun:test';
import { DEMO_GEO_HUNTS } from './demo-geophase';

describe('CaTE 2026 demo GeoPhase', () => {
	test('creates one inactive-ready configuration per Precettoria', () => {
		expect(DEMO_GEO_HUNTS).toHaveLength(4);
		expect(new Set(DEMO_GEO_HUNTS.map((hunt) => hunt.factionName)).size).toBe(4);
		for (const hunt of DEMO_GEO_HUNTS) {
			expect(hunt.description).toContain('badge di fine fase Cavaliere');
			expect(hunt.description).toContain('il palco non è un waypoint GPS');
		}
	});

	test('models five independent waypoints worth 20 points each', () => {
		for (const hunt of DEMO_GEO_HUNTS) {
			expect(hunt.waypoints.map((waypoint) => waypoint.challengeType)).toEqual([
				'gps',
				'photo',
				'gps',
				'photo',
				'quiz'
			]);
			expect(
				hunt.waypoints.map(
					(waypoint) => waypoint.pointsOnArrival + waypoint.pointsOnSuccess
				)
			).toEqual([20, 20, 20, 20, 20]);
			const total = hunt.waypoints.reduce(
				(sum, waypoint) => sum + waypoint.pointsOnArrival + waypoint.pointsOnSuccess,
				0
			);
			expect(total).toBe(100);
			expect(hunt.waypoints.at(-1)?.quizTimeLimitSeconds).toBe(15);
			expect(hunt.waypoints.at(-1)?.quizOptions).toHaveLength(3);
			expect(hunt.waypoints.at(-1)?.quizOptions).toContain(
				hunt.waypoints.at(-1)?.quizAnswer ?? ''
			);
			expect(hunt.waypoints.at(-1)?.quizQuestion).not.toContain('A)');
			expect(hunt.waypoints.some((waypoint) => waypoint.adminName.includes('palco'))).toBe(false);
			expect(
				hunt.waypoints
					.filter((waypoint) => waypoint.challengeType === 'gps')
					.map((waypoint) => waypoint.radiusMeters)
			).toEqual([10, 10]);
		}
	});

	test('contains no unfinished content and renders the GPS verses as player labels', () => {
		const unfinished = DEMO_GEO_HUNTS.flatMap((hunt) => hunt.waypoints).filter((waypoint) =>
			waypoint.enigmaText?.includes('[TODO:')
		);
		expect(unfinished).toHaveLength(0);
		for (const hunt of DEMO_GEO_HUNTS) {
			for (const index of [0, 2]) {
				const waypoint = hunt.waypoints[index];
				const enigmaText = waypoint.enigmaText;
				if (!enigmaText) throw new Error(`Indizio GPS mancante per ${waypoint.adminName}`);
				expect(waypoint.name).toBe(enigmaText);
				expect(waypoint.name).not.toContain(waypoint.adminName.split(': ').at(-1) ?? '');
			}
			expect(hunt.waypoints[2].name.split('\n')).toHaveLength(4);
		}
	});
});
