export type QuizOption = {
	value: string;
	label: string;
};

export type ParsedQuizOptions = {
	prompt: string;
	options: QuizOption[];
};

export const MIN_QUIZ_OPTIONS = 3;
export const MAX_QUIZ_OPTIONS = 5;

export function normalizeQuizOptionTexts(value: unknown): string[] | null {
	if (!Array.isArray(value) || value.length < MIN_QUIZ_OPTIONS || value.length > MAX_QUIZ_OPTIONS) {
		return null;
	}

	const options = value.map((option) => (typeof option === 'string' ? option.trim() : ''));
	if (options.some((option) => !option || option.length > 250)) return null;
	if (new Set(options.map((option) => option.toLocaleLowerCase('it'))).size !== options.length) {
		return null;
	}
	return options;
}

export function parseStoredQuizOptions(value: string | null | undefined): string[] | null {
	if (!value) return null;
	try {
		return normalizeQuizOptionTexts(JSON.parse(value));
	} catch {
		return null;
	}
}

export function parseQuizOptions(question: string | null | undefined): ParsedQuizOptions | null {
	if (!question) return null;

	const lines = question
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const firstOptionIndex = lines.findIndex((line) => /^[A-Z]\)\s+\S/i.test(line));
	if (firstOptionIndex < 1) return null;

	const optionLines = lines.slice(firstOptionIndex);
	const options = optionLines.map((line) => {
		const match = line.match(/^([A-Z])\)\s+(.+)$/i);
		return match ? { value: match[1].toUpperCase(), label: match[2].trim() } : null;
	});
	if (
		options.length < MIN_QUIZ_OPTIONS ||
		options.length > MAX_QUIZ_OPTIONS ||
		options.some((option) => option === null)
	) return null;

	return {
		prompt: lines.slice(0, firstOptionIndex).join('\n'),
		options: options as QuizOption[]
	};
}
