import { describe, expect, test } from 'bun:test';
import {
	constellationAvatarUrl,
	constellationAvatarUrlFromValue,
	parseConstellationAvatarSeed
} from './constellation-avatar';

describe('constellation avatar URLs', () => {
	test('builds and parses a local team avatar URL', () => {
		const url = constellationAvatarUrl('team-2');
		expect(url).toBe('/api/team_avatars/constellation/team-2');
		expect(parseConstellationAvatarSeed(url)).toBe('team-2');
	});

	test('creates deterministic URL-safe fallbacks', () => {
		const first = constellationAvatarUrlFromValue('Tempio di Salomone');
		const second = constellationAvatarUrlFromValue('Tempio di Salomone');
		expect(first).toBe(second);
		expect(first).toMatch(/^\/api\/team_avatars\/constellation\/team-[a-f0-9]{8}$/);
	});

	test('rejects malformed paths and unsafe seeds', () => {
		expect(parseConstellationAvatarSeed('/api/team_avatars/constellation/a/b')).toBeNull();
		expect(() => constellationAvatarUrl('../team')).toThrow();
	});
});
