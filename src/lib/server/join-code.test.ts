import { describe, expect, test } from 'bun:test';
import { isValidManualJoinCode, normalizeJoinCode } from '../utils/join-code';

describe('team join codes', () => {
	test('normalizes pasted and lowercase codes', () => {
		expect(normalizeJoinCode('  abcd 2345\n')).toBe('ABCD2345');
	});

	test('accepts manual alphanumeric codes between 6 and 16 characters', () => {
		expect(isValidManualJoinCode('FALCHI26')).toBe(true);
		expect(isValidManualJoinCode('ABC')).toBe(false);
		expect(isValidManualJoinCode('FALCHI-26')).toBe(false);
	});
});
