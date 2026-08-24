import { describe, expect, test } from 'bun:test';
import { calculateMaxPossibleScore, calculateSimpleScore } from './scoring';

describe('program scoring without arrival bonuses', () => {
    test('a simple completion awards only its base points', () => {
        expect(calculateSimpleScore(90)).toBe(90);
    });

    test('the checklist maximum contains only base and checklist points', () => {
        expect(calculateMaxPossibleScore(50, {
            checklistItems: 5,
            pointsPerItem: 10
        })).toBe(100);
    });
});
