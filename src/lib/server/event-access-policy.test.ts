import { describe, expect, test } from 'bun:test';
import { hasPasswordActivityAccess, hasTeamActivityAccess } from './event-access-policy';

describe('team-scoped activity access', () => {
	test('allows a signed join-code session to use team activities such as Codex and GeoPhase', () => {
		expect(hasTeamActivityAccess({ role: 'player', teamId: 'team-1', authMethod: 'code' })).toBe(true);
	});

	test('keeps account-only activities unavailable to join-code sessions', () => {
		expect(hasPasswordActivityAccess({ role: 'player', teamId: 'team-1', authMethod: 'code' })).toBe(false);
		expect(hasPasswordActivityAccess({ role: 'player', teamId: 'team-1', authMethod: 'password' })).toBe(true);
	});

	test('rejects users without a player team from team-scoped activities', () => {
		expect(hasTeamActivityAccess({ role: 'staff', teamId: 'team-1', authMethod: 'password' })).toBe(false);
		expect(hasTeamActivityAccess({ role: 'player', teamId: null, authMethod: 'password' })).toBe(false);
	});
});
