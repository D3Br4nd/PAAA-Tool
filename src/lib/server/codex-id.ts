export type CodexCandidate = {
	id: string;
	factionId: string;
};

export type CodexCandidateResolution =
	| { status: 'found'; candidate: CodexCandidate }
	| { status: 'not_found' | 'forbidden' | 'ambiguous' };

/** Resolves legacy colliding prefixes with the authenticated team's faction. */
export function resolveCodexCandidate(
	candidates: CodexCandidate[],
	requestedId: string,
	teamFactionId?: string | null
): CodexCandidateResolution {
	if (candidates.length === 0) return { status: 'not_found' };

	const exact = candidates.find((candidate) => candidate.id === requestedId);
	if (exact) return { status: 'found', candidate: exact };
	if (candidates.length === 1) return { status: 'found', candidate: candidates[0] };

	if (teamFactionId) {
		const scoped = candidates.filter((candidate) => candidate.factionId === teamFactionId);
		if (scoped.length === 1) return { status: 'found', candidate: scoped[0] };
		if (scoped.length === 0) return { status: 'forbidden' };
	}

	return { status: 'ambiguous' };
}
