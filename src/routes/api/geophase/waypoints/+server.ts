/**
 * POST   /api/geophase/waypoints         — create a waypoint (admin only)
 * PUT    /api/geophase/waypoints/[id]    — update a waypoint
 * DELETE /api/geophase/waypoints/[id]    — delete a waypoint
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { geoWaypoints } from '$lib/server/schema';
import { uuidv7 } from '$lib/utils/uuidv7';
import { parseGeoPoint } from '$lib/utils/geo';
import { boundedInteger, GEO_LIMITS } from '$lib/geophase-state';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { normalizeQuizOptionTexts } from '$lib/utils/quiz-options';

const challengeTypes = ['gps', 'photo', 'quiz'] as const;
type ChallengeType = (typeof challengeTypes)[number];

function normalizeChallengeType(value: unknown): ChallengeType {
	if (!challengeTypes.includes(value as ChallengeType)) {
		throw error(400, { message: 'Invalid challenge type' });
	}
	return value as ChallengeType;
}

function integerOrDefault(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
	field: string
) {
	if (value === undefined) return fallback;
	const parsed = boundedInteger(value, min, max);
	if (parsed === null)
		throw error(400, {
			message: `${field} must be an integer between ${min} and ${max}`
		});
	return parsed;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const {
		huntId,
		adminName,
		name,
		lat,
		lng,
		radiusMeters,
		sortOrder,
		challengeType,
		enigmaText,
		quizQuestion,
		quizOptions,
		quizAnswer,
		quizTimeLimitSeconds,
		challengeDisclaimerText,
		pointsOnArrival,
		pointsOnSuccess
	} = body as Record<string, unknown>;

	if (typeof huntId !== 'string' || !huntId) throw error(400, { message: 'huntId is required' });
	if (
		typeof adminName !== 'string' ||
		adminName.trim().length < 1 ||
		adminName.trim().length > 120
	) {
		throw error(400, { message: 'adminName must contain between 1 and 120 characters' });
	}
	if (typeof name !== 'string' || name.trim().length < 1)
		throw error(400, { message: 'name is required' });
	const normalizedChallengeType = normalizeChallengeType(challengeType);
	const isGps = normalizedChallengeType === 'gps';
	const point = isGps ? parseGeoPoint(lat, lng) : { lat: 0, lng: 0 };
	if (!point) throw error(400, { message: 'Invalid latitude or longitude' });
	const normalizedRadius = integerOrDefault(
		radiusMeters,
		GEO_LIMITS.minRadiusMeters,
		GEO_LIMITS.maxRadiusMeters,
		20,
		'radiusMeters'
	);
	const normalizedSortOrder = integerOrDefault(sortOrder, 0, 100_000, 0, 'sortOrder');
	const normalizedQuizTime = integerOrDefault(
		quizTimeLimitSeconds,
		GEO_LIMITS.minQuizSeconds,
		GEO_LIMITS.maxQuizSeconds,
		60,
		'quizTimeLimitSeconds'
	);
	const normalizedArrivalPoints = integerOrDefault(
		pointsOnArrival,
		0,
		GEO_LIMITS.maxPoints,
		0,
		'pointsOnArrival'
	);
	const normalizedSuccessPoints = integerOrDefault(
		pointsOnSuccess,
		0,
		GEO_LIMITS.maxPoints,
		100,
		'pointsOnSuccess'
	);

	const now = Date.now();
	const hasQuiz = normalizedChallengeType === 'quiz';
	const normalizedQuizQuestion =
		hasQuiz && typeof quizQuestion === 'string' ? quizQuestion.trim() : '';
	const normalizedQuizOptions = hasQuiz ? normalizeQuizOptionTexts(quizOptions) : null;
	if (hasQuiz && !normalizedQuizQuestion) {
		throw error(400, { message: 'La domanda del quiz è obbligatoria' });
	}
	if (hasQuiz && !normalizedQuizOptions) {
		throw error(400, { message: 'Il quiz deve contenere da 3 a 5 risposte diverse' });
	}
	const requestedQuizAnswer = hasQuiz && typeof quizAnswer === 'string' ? quizAnswer.trim() : '';
	const normalizedQuizAnswer = normalizedQuizOptions?.find(
		(option) => option.toLocaleLowerCase('it') === requestedQuizAnswer.toLocaleLowerCase('it')
	) ?? null;
	if (hasQuiz && !normalizedQuizAnswer) {
		throw error(400, { message: 'Seleziona una risposta corretta tra quelle disponibili' });
	}
	const waypoint = {
		id: uuidv7(),
		huntId,
		adminName: adminName.trim(),
		name: String(name).trim(),
		lat: String(point.lat),
		lng: String(point.lng),
		radiusMeters: normalizedRadius,
		sortOrder: normalizedSortOrder,
		challengeType: normalizedChallengeType,
		enigmaText: typeof enigmaText === 'string' ? enigmaText.trim() : null,
		quizQuestion: hasQuiz ? normalizedQuizQuestion : null,
		quizOptions: normalizedQuizOptions ? JSON.stringify(normalizedQuizOptions) : null,
		quizAnswer: normalizedQuizAnswer,
		quizTimeLimitSeconds: normalizedQuizTime,
		challengeDisclaimerText:
			typeof challengeDisclaimerText === 'string' && challengeDisclaimerText.trim()
				? challengeDisclaimerText.trim()
				: null,
		pointsOnArrival: isGps ? normalizedArrivalPoints : 0,
		pointsOnSuccess: isGps ? 0 : normalizedSuccessPoints,
		createdAt: new Date(now),
		updatedAt: new Date(now)
	};

	await db.insert(geoWaypoints).values(waypoint);
	// Return a plain serializable object (convert Date back to ms for JSON)
	return json({ data: { ...waypoint, createdAt: now, updatedAt: now } }, { status: 201 });
};
