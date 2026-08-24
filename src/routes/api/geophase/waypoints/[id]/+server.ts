/**
 * PUT    /api/geophase/waypoints/[id]   — update a waypoint
 * DELETE /api/geophase/waypoints/[id]   — delete a waypoint
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { geoWaypoints } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { parseLatitude, parseLongitude } from '$lib/utils/geo';
import { boundedInteger, GEO_LIMITS } from '$lib/geophase-state';
import { removeGeoPoints } from '$lib/server/geophase';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { normalizeQuizOptionTexts, parseStoredQuizOptions } from '$lib/utils/quiz-options';

const challengeTypes = ['gps', 'photo', 'quiz'] as const;
type ChallengeType = (typeof challengeTypes)[number];

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	const b = body as Record<string, unknown>;
	const [existing] = await db
		.select()
		.from(geoWaypoints)
		.where(eq(geoWaypoints.id, params.id))
		.limit(1);
	if (!existing) throw error(404, { message: 'Waypoint not found' });

	if ('adminName' in b) {
		if (
			typeof b.adminName !== 'string' ||
			!b.adminName.trim() ||
			b.adminName.trim().length > 120
		) {
			throw error(400, { message: 'adminName must contain between 1 and 120 characters' });
		}
		updates.adminName = b.adminName.trim();
	}
	if ('name' in b) {
		if (typeof b.name !== 'string' || !b.name.trim())
			throw error(400, { message: 'name is required' });
		updates.name = b.name.trim();
	}
	const nextLat = parseLatitude('lat' in b ? b.lat : existing.lat);
	const nextLng = parseLongitude('lng' in b ? b.lng : existing.lng);
	if (nextLat === null || nextLng === null)
		throw error(400, { message: 'Invalid latitude or longitude' });
	if ('lat' in b) updates.lat = String(nextLat);
	if ('lng' in b) updates.lng = String(nextLng);

	const integerUpdate = (field: string, min: number, max: number) => {
		if (!(field in b)) return undefined;
		const parsed = boundedInteger(b[field], min, max);
		if (parsed === null)
			throw error(400, {
				message: `${field} must be an integer between ${min} and ${max}`
			});
		updates[field] = parsed;
		return parsed;
	};
	integerUpdate('radiusMeters', GEO_LIMITS.minRadiusMeters, GEO_LIMITS.maxRadiusMeters);
	integerUpdate('sortOrder', 0, 100_000);
	integerUpdate('quizTimeLimitSeconds', GEO_LIMITS.minQuizSeconds, GEO_LIMITS.maxQuizSeconds);

	let nextChallengeType = existing.challengeType;
	if ('challengeType' in b) {
		if (!challengeTypes.includes(b.challengeType as ChallengeType)) {
			throw error(400, { message: 'Invalid challenge type' });
		}
		nextChallengeType = b.challengeType as ChallengeType;
		updates.challengeType = nextChallengeType;
	}
	if ('enigmaText' in b)
		updates.enigmaText =
			typeof b.enigmaText === 'string' && b.enigmaText.trim() ? b.enigmaText.trim() : null;
	if (nextChallengeType === 'quiz') {
		if ('quizQuestion' in b) {
			if (typeof b.quizQuestion !== 'string' || !b.quizQuestion.trim()) {
				throw error(400, { message: 'La domanda del quiz è obbligatoria' });
			}
			updates.quizQuestion = b.quizQuestion.trim();
		}
		if ('quizOptions' in b) {
			const options = normalizeQuizOptionTexts(b.quizOptions);
			if (!options) {
				throw error(400, { message: 'Il quiz deve contenere da 3 a 5 risposte diverse' });
			}
			const requestedAnswer = typeof b.quizAnswer === 'string' ? b.quizAnswer.trim() : '';
			const correctAnswer = options.find(
				(option) => option.toLocaleLowerCase('it') === requestedAnswer.toLocaleLowerCase('it')
			);
			if (!correctAnswer) {
				throw error(400, { message: 'Seleziona una risposta corretta tra quelle disponibili' });
			}
			updates.quizOptions = JSON.stringify(options);
			updates.quizAnswer = correctAnswer;
		} else if (existing.challengeType !== 'quiz') {
			throw error(400, { message: 'Il quiz deve contenere da 3 a 5 risposte diverse' });
		} else if ('quizAnswer' in b) {
			const options = parseStoredQuizOptions(existing.quizOptions);
			const requestedAnswer = typeof b.quizAnswer === 'string' ? b.quizAnswer.trim() : '';
			const correctAnswer = options?.find(
				(option) => option.toLocaleLowerCase('it') === requestedAnswer.toLocaleLowerCase('it')
			);
			updates.quizAnswer = correctAnswer ?? requestedAnswer;
		}
	} else {
		updates.quizQuestion = null;
		updates.quizOptions = null;
		updates.quizAnswer = null;
	}
	if ('challengeDisclaimerText' in b)
		updates.challengeDisclaimerText =
			typeof b.challengeDisclaimerText === 'string' && b.challengeDisclaimerText.trim()
				? b.challengeDisclaimerText.trim()
				: null;
	const nextArrivalPoints =
		'pointsOnArrival' in b
			? boundedInteger(b.pointsOnArrival, 0, GEO_LIMITS.maxPoints)
			: existing.pointsOnArrival;
	const nextSuccessPoints =
		'pointsOnSuccess' in b
			? boundedInteger(b.pointsOnSuccess, 0, GEO_LIMITS.maxPoints)
			: existing.pointsOnSuccess;
	if (nextArrivalPoints === null || nextSuccessPoints === null) {
		throw error(400, {
			message: `Points must be integers between 0 and ${GEO_LIMITS.maxPoints}`
		});
	}
	updates.pointsOnArrival = nextChallengeType === 'gps' ? nextArrivalPoints : 0;
	updates.pointsOnSuccess = nextChallengeType === 'gps' ? 0 : nextSuccessPoints;

	await db.update(geoWaypoints).set(updates).where(eq(geoWaypoints.id, params.id));
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	await db.transaction(async (tx) => {
		await removeGeoPoints(tx, { waypointId: params.id });
		await tx.delete(geoWaypoints).where(eq(geoWaypoints.id, params.id));
	});
	return new Response(null, { status: 204 });
};
