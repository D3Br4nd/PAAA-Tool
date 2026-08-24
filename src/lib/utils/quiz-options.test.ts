import { describe, expect, test } from 'bun:test';
import {
	normalizeQuizOptionTexts,
	parseQuizOptions,
	parseStoredQuizOptions
} from './quiz-options';

describe('GeoPhase quiz options', () => {
	test('parses lettered choices from a multiline question', () => {
		expect(parseQuizOptions('Quando?\nA) Ieri\nB) Oggi\nC) Domani')).toEqual({
			prompt: 'Quando?',
			options: [
				{ value: 'A', label: 'Ieri' },
				{ value: 'B', label: 'Oggi' },
				{ value: 'C', label: 'Domani' }
			]
		});
	});

	test('leaves ordinary free-text questions unchanged', () => {
		expect(parseQuizOptions('Come si chiama il paese?')).toBeNull();
		expect(parseQuizOptions('Domanda\nA) Una\nnota libera')).toBeNull();
	});

	test('validates three to five unique structured answers', () => {
		expect(normalizeQuizOptionTexts([' Prima ', 'Seconda', 'Terza'])).toEqual([
			'Prima',
			'Seconda',
			'Terza'
		]);
		expect(normalizeQuizOptionTexts(['Una', 'Due'])).toBeNull();
		expect(normalizeQuizOptionTexts(['Una', 'una', 'Tre'])).toBeNull();
		expect(normalizeQuizOptionTexts(['1', '2', '3', '4', '5', '6'])).toBeNull();
		expect(parseStoredQuizOptions('["Una","Due","Tre"]')).toEqual(['Una', 'Due', 'Tre']);
		expect(parseStoredQuizOptions('not-json')).toBeNull();
	});
});
