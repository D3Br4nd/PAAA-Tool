import { describe, expect, test } from 'bun:test';
import { buildGameTimeRanking } from './game-time-ranking';

describe('classifica tempi Trittico del Templare', () => {
    const base = {
        gameId: 'trittico',
        gameName: 'Il Trittico del Templare',
        factionId: 'faction-a',
        factionName: 'Oltremare',
        completedAt: 1_000,
        totalPoints: 97
    };

    test('orders lower elapsed times first inside a faction', () => {
        const rows = buildGameTimeRanking([
            { ...base, teamId: 'slow', teamName: 'Lenta', elapsedSeconds: 80 },
            { ...base, teamId: 'fast', teamName: 'Veloce', elapsedSeconds: 34 }
        ]);

        expect(rows.find((row) => row.teamId === 'fast')?.rank).toBe(1);
        expect(rows.find((row) => row.teamId === 'slow')?.rank).toBe(2);
    });

    test('ranks factions independently and attaches assigned extra points', () => {
        const rows = buildGameTimeRanking([
            { ...base, teamId: 'one', teamName: 'Uno', elapsedSeconds: 45 },
            {
                ...base,
                factionId: 'faction-b',
                factionName: 'Francia',
                teamId: 'two',
                teamName: 'Due',
                elapsedSeconds: 60
            }
        ], new Map([['trittico:two', 30]]));

        expect(rows.every((row) => row.rank === 1)).toBe(true);
        expect(rows.find((row) => row.teamId === 'two')?.extraPoints).toBe(30);
    });

    test('excludes completions without a recorded time', () => {
        const rows = buildGameTimeRanking([
            { ...base, teamId: 'missing', teamName: 'Senza tempo', elapsedSeconds: null }
        ]);

        expect(rows).toHaveLength(0);
    });
});
