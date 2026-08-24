import { describe, expect, test } from 'bun:test';
import { buildPublicProgramCompletions, publicGameCompletionName } from './public-completions';

const definitions = [
	{ id: 'scriba-1', code: 'SCRIBA' },
	{ id: 'scriba-2', code: 'SCRIBA' },
	{ id: 'scriba-3', code: 'SCRIBA' },
	{ id: 'architetto', code: 'ARCHITETTO' },
	{ id: 'other', code: 'ALTRO' }
];

describe('completamenti mostrati nel tabellone pubblico', () => {
	test('mostra un solo Path dello Scriba soltanto dopo tutti e tre gli step', () => {
		const partial = buildPublicProgramCompletions(definitions, [
			{ teamId: 'team', challengeId: 'scriba-1', totalPoints: 40, completedAt: 100 },
			{ teamId: 'team', challengeId: 'scriba-2', totalPoints: 0, completedAt: 200 }
		]);
		expect(partial).toEqual([]);

		const complete = buildPublicProgramCompletions(definitions, [
			{ teamId: 'team', challengeId: 'scriba-1', totalPoints: 40, completedAt: 100 },
			{ teamId: 'team', challengeId: 'scriba-2', totalPoints: 0, completedAt: 200 },
			{ teamId: 'team', challengeId: 'scriba-3', totalPoints: 10, completedAt: 300 }
		]);
		expect(complete).toEqual([
			{
				teamId: 'team',
				key: 'program:scriba',
				name: 'Path dello Scriba',
				completedAt: 300
			}
		]);
	});

	test("non mostra l'Architetto rifiutato a zero punti e ignora altri programmi", () => {
		const refused = buildPublicProgramCompletions(definitions, [
			{ teamId: 'team', challengeId: 'architetto', totalPoints: 0, completedAt: 100 },
			{ teamId: 'team', challengeId: 'other', totalPoints: 50, completedAt: 200 }
		]);
		expect(refused).toEqual([]);

		const accepted = buildPublicProgramCompletions(definitions, [
			{ teamId: 'team', challengeId: 'architetto', totalPoints: 50, completedAt: 100 }
		]);
		expect(accepted[0]?.name).toBe("Path dell'Architetto");
	});

	test('ammette soltanto Trittico e Stendardo tra i giochi', () => {
		expect(publicGameCompletionName('TRITTICO')).toBe('Il Trittico del Templare');
		expect(publicGameCompletionName('stendardo')).toBe('Lo Stendardo');
		expect(publicGameCompletionName('NOTTE')).toBeNull();
	});
});
