import { describe, expect, test } from 'bun:test';
import { buildPhaseOneTimeRows } from './phase-one-times';

const challenges = [
    { id: 'scriba-1', code: 'SCRIBA' },
    { id: 'scriba-2', code: 'SCRIBA' },
    { id: 'scriba-3', code: 'SCRIBA' },
    { id: 'architetto', code: 'ARCHITETTO' }
];
const hunts = [{ id: 'hunt-a', factionId: 'faction-a' }];
const waypoints = [
    { id: 'geo-1', huntId: 'hunt-a', challengeType: 'gps' },
    { id: 'geo-2', huntId: 'hunt-a', challengeType: 'photo' }
];

function completedProgram(teamId: string, lastTimestamp: number) {
    return challenges.map((challenge, index) => ({
        teamId,
        challengeId: challenge.id,
        completedAt: lastTimestamp - (challenges.length - index) * 100
    }));
}

function completedGeo(teamId: string, lastTimestamp: number) {
    return [
        {
            teamId,
            huntId: 'hunt-a',
            waypointId: 'geo-1',
            status: 'completed',
            completedAt: lastTimestamp - 100,
            updatedAt: lastTimestamp - 100
        },
        {
            teamId,
            huntId: 'hunt-a',
            waypointId: 'geo-2',
            status: 'photo_submitted',
            completedAt: null,
            updatedAt: lastTimestamp
        }
    ];
}

describe('classifica tempi Fase 1', () => {
    test('requires every Scriba step, Architetto and the full Cavaliere path', () => {
        const rows = buildPhaseOneTimeRows({
            teams: [{ id: 'team-a', name: 'Aquila', factionId: 'faction-a', factionName: 'Italia' }],
            challenges,
            completions: completedProgram('team-a', 2_000).slice(1),
            hunts,
            waypoints,
            geoProgress: completedGeo('team-a', 1_500)
        });

        expect(rows[0].completed).toBe(false);
        expect(rows[0].paths.scriba.completedCount).toBe(2);
        expect(rows[0].paths.scriba.requiredCount).toBe(3);
    });

    test('uses the last of the three paths as final delivery time', () => {
        const rows = buildPhaseOneTimeRows({
            teams: [{ id: 'team-a', name: 'Aquila', factionId: 'faction-a', factionName: 'Italia' }],
            challenges,
            completions: completedProgram('team-a', 2_000),
            hunts,
            waypoints,
            geoProgress: completedGeo('team-a', 3_000)
        });

        expect(rows[0].completed).toBe(true);
        expect(rows[0].completedAt).toBe(3_000);
    });

	test('does not award the Architetto badge after a refusal worth zero points', () => {
		const completions = completedProgram('team-a', 2_000).map((completion) =>
			completion.challengeId === 'architetto'
				? { ...completion, totalPoints: 0 }
				: { ...completion, totalPoints: 0 }
		);
		const rows = buildPhaseOneTimeRows({
			teams: [{ id: 'team-a', name: 'Aquila', factionId: 'faction-a', factionName: 'Italia' }],
			challenges,
			completions,
			hunts,
			waypoints,
			geoProgress: completedGeo('team-a', 1_500)
		});

		expect(rows[0].paths.architetto.completed).toBe(false);
		expect(rows[0].paths.architetto.completedCount).toBe(0);
		// The Scriba regulation remains non-blocking even when a step scores zero.
		expect(rows[0].paths.scriba.completed).toBe(true);
		expect(rows[0].completed).toBe(false);
	});

    test('ranks completed teams by delivery time inside their faction', () => {
        const teams = [
            { id: 'late', name: 'Lenta', factionId: 'faction-a', factionName: 'Italia' },
            { id: 'early', name: 'Veloce', factionId: 'faction-a', factionName: 'Italia' }
        ];
        const rows = buildPhaseOneTimeRows({
            teams,
            challenges,
            completions: [
                ...completedProgram('late', 4_000),
                ...completedProgram('early', 2_000)
            ],
            hunts,
            waypoints,
            geoProgress: [
                ...completedGeo('late', 3_000),
                ...completedGeo('early', 1_000)
            ],
            extraPointsByTeam: new Map([['early', 25]])
        });

        expect(rows.find((row) => row.teamId === 'early')?.rank).toBe(1);
        expect(rows.find((row) => row.teamId === 'early')?.extraPoints).toBe(25);
        expect(rows.find((row) => row.teamId === 'late')?.rank).toBe(2);
    });
});
