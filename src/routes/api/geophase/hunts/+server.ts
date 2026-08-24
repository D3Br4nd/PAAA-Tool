/**
 * GET  /api/geophase/hunts         — list all hunts (admin/staff)
 * POST /api/geophase/hunts         — create a new hunt (admin only)
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { geoHunts, geoWaypoints } from '$lib/server/schema';
import { eq, asc } from 'drizzle-orm';
import { uuidv7 } from '$lib/utils/uuidv7';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { assertGeoHuntConfiguration } from '$lib/server/geophase';

export const GET: RequestHandler = async ({ locals, url }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'staff')) {
		throw error(403, { message: 'Admin or staff access required' });
	}

	const eventId = url.searchParams.get('eventId');

	let hunts;
	if (eventId) {
		hunts = await db
			.select()
			.from(geoHunts)
			.where(eq(geoHunts.eventId, eventId))
			.orderBy(asc(geoHunts.createdAt));
	} else {
		hunts = await db.select().from(geoHunts).orderBy(asc(geoHunts.createdAt));
	}

	// Attach waypoint count to each hunt
	const huntsWithCounts = await Promise.all(
		hunts.map(async (hunt) => {
			const waypoints = await db
				.select()
				.from(geoWaypoints)
				.where(eq(geoWaypoints.huntId, hunt.id))
				.orderBy(asc(geoWaypoints.sortOrder));
			return { ...hunt, waypoints };
		})
	);

	return json({ data: huntsWithCounts });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	await ensureGeoPhaseSchema();
	const { name, description, challengeDisclaimerText, deadlineAt, eventId, factionId, isActive } =
		body as Record<string, unknown>;

	if (typeof name !== 'string' || name.trim().length < 2) {
		throw error(400, { message: 'Name must be at least 2 characters' });
	}
	if (typeof eventId !== 'string' || !eventId) {
		throw error(400, { message: 'eventId is required' });
	}
	if (factionId !== undefined && factionId !== null && typeof factionId !== 'string') {
		throw error(400, { message: 'factionId must be a string or null' });
	}
	const normalizedFactionId = typeof factionId === 'string' && factionId ? factionId : null;
	const normalizedDeadline = normalizeDeadline(deadlineAt);
	await assertGeoHuntConfiguration({
		eventId,
		factionId: normalizedFactionId,
		isActive: isActive === true
	});

	const now = Date.now();
	const hunt = {
		id: uuidv7(),
		eventId,
		factionId: normalizedFactionId,
		name: name.trim(),
		description: typeof description === 'string' ? description.trim() : null,
		challengeDisclaimerText:
			typeof challengeDisclaimerText === 'string' && challengeDisclaimerText.trim()
				? challengeDisclaimerText.trim()
				: null,
		deadlineAt: normalizedDeadline,
		isActive: isActive === true,
		createdAt: new Date(now),
		updatedAt: new Date(now)
	};

	await db.insert(geoHunts).values(hunt);
	return json({ data: hunt }, { status: 201 });
};

function normalizeDeadline(value: unknown): Date | null {
	if (value === undefined || value === null || value === '') return null;
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw error(400, { message: 'deadlineAt deve essere una data valida o null' });
	}
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) {
		throw error(400, { message: 'deadlineAt deve essere una data valida o null' });
	}
	return parsed;
}
