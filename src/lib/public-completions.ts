type DateValue = Date | string | number;

export type PublicProgramDefinition = {
	id: string;
	code: string;
};

export type PublicProgramCompletion = {
	teamId: string;
	challengeId: string;
	totalPoints: number;
	completedAt: DateValue;
};

export type PublicCompletedActivity = {
	teamId: string;
	key: string;
	name: string;
	completedAt: number;
};

function timestamp(value: DateValue): number | null {
	const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
	return Number.isFinite(parsed) ? parsed : null;
}

function completedProgramPath(
	teamId: string,
	key: string,
	name: string,
	requiredIds: string[],
	completionByChallenge: Map<string, PublicProgramCompletion>,
	isValid: (completion: PublicProgramCompletion) => boolean
): PublicCompletedActivity | null {
	if (requiredIds.length === 0) return null;
	const completions = requiredIds
		.map((id) => completionByChallenge.get(id))
		.filter((completion): completion is PublicProgramCompletion => Boolean(completion))
		.filter(isValid);
	if (completions.length !== requiredIds.length) return null;
	const completedAt = Math.max(
		...completions.map((completion) => timestamp(completion.completedAt) ?? 0)
	);
	return { teamId, key, name, completedAt };
}

/** Builds only the two aggregate Phase 1 program badges shown publicly. */
export function buildPublicProgramCompletions(
	definitions: PublicProgramDefinition[],
	completions: PublicProgramCompletion[]
): PublicCompletedActivity[] {
	const idsByCode = new Map<string, string[]>();
	for (const definition of definitions) {
		const code = definition.code.trim().toUpperCase();
		idsByCode.set(code, [...(idsByCode.get(code) ?? []), definition.id]);
	}

	const activities: PublicCompletedActivity[] = [];
	for (const teamId of new Set(completions.map((completion) => completion.teamId))) {
		const completionByChallenge = new Map(
			completions
				.filter((completion) => completion.teamId === teamId)
				.map((completion) => [completion.challengeId, completion])
		);
		const scriba = completedProgramPath(
			teamId,
			'program:scriba',
			'Path dello Scriba',
			idsByCode.get('SCRIBA') ?? [],
			completionByChallenge,
			() => true
		);
		if (scriba) activities.push(scriba);

		const architetto = completedProgramPath(
			teamId,
			'program:architetto',
			"Path dell'Architetto",
			idsByCode.get('ARCHITETTO') ?? [],
			completionByChallenge,
			(completion) => completion.totalPoints > 0
		);
		if (architetto) activities.push(architetto);
	}
	return activities;
}

export function publicGameCompletionName(code: string): string | null {
	switch (code.trim().toUpperCase()) {
		case 'TRITTICO':
			return 'Il Trittico del Templare';
		case 'STENDARDO':
			return 'Lo Stendardo';
		default:
			return null;
	}
}
