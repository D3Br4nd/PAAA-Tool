import { describe, expect, test } from 'bun:test';
import { planetAvatarSvg } from './planet-avatar';

describe('local Planets avatar rendering', () => {
    test('is deterministic and self-contained', () => {
        const first = planetAvatarSvg('test-user');
        const second = planetAvatarSvg('test-user');

        expect(first).toBe(second);
        expect(first).toStartWith('<svg');
        expect(first).not.toMatch(/\b(?:href|src)=["']https?:/i);
        expect(first).not.toContain('api.dicebear.com');
    });

    test('changes the rendered planet when the seed changes', () => {
        expect(planetAvatarSvg('test-user')).not.toBe(planetAvatarSvg('another-user'));
    });
});
