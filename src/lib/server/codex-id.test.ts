import { describe, expect, test } from 'bun:test';
import { resolveCodexCandidate } from './codex-id';

const france = { id: '01a019e2-aaaa-7aaa-8aaa-aaaaaaaaaaaa', factionId: 'france' };
const iberia = { id: '01a019e2-bbbb-7bbb-8bbb-bbbbbbbbbbbb', factionId: 'iberia' };

describe('Codex identifier resolution', () => {
	test('resolves a colliding legacy prefix using the player faction', () => {
		expect(resolveCodexCandidate([france, iberia], '01a019e2', 'france')).toEqual({
			status: 'found',
			candidate: france
		});
		expect(resolveCodexCandidate([france, iberia], '01a019e2', 'iberia')).toEqual({
			status: 'found',
			candidate: iberia
		});
	});

	test('uses an exact full UUID without ambiguity', () => {
		expect(resolveCodexCandidate([france, iberia], iberia.id, 'france')).toEqual({
			status: 'found',
			candidate: iberia
		});
	});

	test('does not guess an ambiguous legacy prefix without a matching faction', () => {
		expect(resolveCodexCandidate([france, iberia], '01a019e2')).toEqual({ status: 'ambiguous' });
		expect(resolveCodexCandidate([france, iberia], '01a019e2', 'italia')).toEqual({ status: 'forbidden' });
	});
});
