import { describe, expect, test } from 'bun:test';
import { constellationAvatarSvg } from './constellation-avatar';

describe('local Constellation avatar rendering', () => {
	test('is deterministic and self-contained', () => {
		const first = constellationAvatarSvg('test-team');
		const second = constellationAvatarSvg('test-team');

		expect(first).toBe(second);
		expect(first).toStartWith('<svg');
		expect(first).not.toMatch(/\b(?:href|src)=["']https?:/i);
		expect(first).not.toContain('api.dicebear.com');
	});

	test('changes the constellation when the seed changes', () => {
		expect(constellationAvatarSvg('test-team')).not.toBe(
			constellationAvatarSvg('another-team')
		);
	});
});
