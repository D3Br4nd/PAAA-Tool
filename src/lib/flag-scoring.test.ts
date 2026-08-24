import { describe, expect, test } from 'bun:test';
import { calculateFlagScore, resolveFlagScoringConfig } from './flag-scoring';

describe('Lo Stendardo scoring', () => {
    test('an attacker receives only the best band reached', () => {
        expect(calculateFlagScore({ role: 'attack', attackOutcome: 'band_1', carrierHits: 7 }).total).toBe(50);
        expect(calculateFlagScore({ role: 'attack', attackOutcome: 'band_2', carrierHits: 7 }).total).toBe(100);
        expect(calculateFlagScore({ role: 'attack', attackOutcome: 'spawn', carrierHits: 7 }).total).toBe(150);
    });

    test('a defender receives only carrier-hit points, capped at 70', () => {
        expect(calculateFlagScore({ role: 'defense', carrierHits: 0 }).total).toBe(0);
        expect(calculateFlagScore({ role: 'defense', carrierHits: 3 }).total).toBe(30);
        expect(calculateFlagScore({ role: 'defense', carrierHits: 8 }).total).toBe(70);
        expect(calculateFlagScore({ role: 'defense', carrierHits: 7, pointsPerHit: 20 }).total).toBe(70);
    });

    test('a stalemate starts at zero and adds carrier-hit points up to 70', () => {
        expect(calculateFlagScore({ role: 'stalemate', carrierHits: 0 }).total).toBe(0);
        expect(calculateFlagScore({ role: 'stalemate', carrierHits: 4 }).total).toBe(40);
        expect(calculateFlagScore({ role: 'stalemate', carrierHits: 12 }).total).toBe(70);
        expect(calculateFlagScore({ role: 'stalemate', carrierHits: 8, maxCarrierHits: 3 }).total).toBe(30);
    });

    test('a disqualification always yields zero points', () => {
        expect(calculateFlagScore({ role: 'disqualified', carrierHits: 10 }).total).toBe(0);
    });

    test('old saved configurations are upgraded to the official bands_v3 defaults', () => {
        expect(resolveFlagScoringConfig({
            scoringVersion: 'role_v2',
            pointsPerHit: 10,
            maxCarrierHits: 5
        })).toEqual({
            scoringVersion: 'bands_v3',
            pointsPerHit: 10,
            maxCarrierHits: 7,
            maxHitPoints: 70,
            attackerBand1Points: 50,
            attackerBand2Points: 100,
            attackerSpawnPoints: 150
        });
    });
});
