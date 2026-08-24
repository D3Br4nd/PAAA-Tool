/**
 * GET    /api/geophase/hunts/[id]   — get a hunt with its waypoints
 * PUT    /api/geophase/hunts/[id]   — update hunt metadata
 * DELETE /api/geophase/hunts/[id]   — delete hunt + cascade waypoints/progress
 */
import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { geoHunts, geoWaypoints } from '$lib/server/schema';
import { eq, asc } from 'drizzle-orm';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { assertGeoHuntConfiguration, removeGeoPoints } from '$lib/server/geophase';

export const GET: RequestHandler = async ({ params, locals }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || (locals.user.role !== 'admin' && locals.user.role !== 'staff')) {
		throw error(403, { message: 'Admin or staff access required' });
	}

	const [hunt] = await db.select().from(geoHunts).where(eq(geoHunts.id, params.id)).limit(1);
	if (!hunt) throw error(404, { message: 'Hunt not found' });

	const waypoints = await db
		.select()
		.from(geoWaypoints)
		.where(eq(geoWaypoints.huntId, params.id))
		.orderBy(asc(geoWaypoints.sortOrder));

	return json({ data: { ...hunt, waypoints } });
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });

	const { name, description, challengeDisclaimerText, deadlineAt, isActive, factionId } = body as Record<
		string,
		unknown
	>;
	const updates: Record<string, unknown> = { updatedAt: new Date() };
	const [existing] = await db.select().from(geoHunts).where(eq(geoHunts.id, params.id)).limit(1);
	if (!existing) throw error(404, { message: 'Hunt not found' });
	if (factionId !== undefined && factionId !== null && typeof factionId !== 'string') {
		throw error(400, { message: 'factionId must be a string or null' });
	}

	if (typeof name === 'string' && name.trim().length >= 2) updates.name = name.trim();
	if (typeof description === 'string') updates.description = description.trim();
	if (typeof challengeDisclaimerText === 'string') {
		updates.challengeDisclaimerText = challengeDisclaimerText.trim()
			? challengeDisclaimerText.trim()
			: null;
	}
	if ('deadlineAt' in (body as Record<string, unknown>)) {
		updates.deadlineAt = normalizeDeadline(deadlineAt);
	}
	if (typeof isActive === 'boolean') updates.isActive = isActive;
	if (factionId === null || typeof factionId === 'string') updates.factionId = factionId || null;
	await assertGeoHuntConfiguration({
		eventId: existing.eventId,
		factionId:
			'factionId' in (body as Record<string, unknown>)
				? typeof factionId === 'string' && factionId
					? factionId
					: null
				: existing.factionId,
		isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
		excludeHuntId: existing.id
	});

	await db.update(geoHunts).set(updates).where(eq(geoHunts.id, params.id));
	return json({ success: true });
};

function normalizeDeadline(value: unknown): Date | null {
	if (value === null || value === '') return null;
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw error(400, { message: 'deadlineAt deve essere una data valida o null' });
	}
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) {
		throw error(400, { message: 'deadlineAt deve essere una data valida o null' });
	}
	return parsed;
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	await db.transaction(async (tx) => {
		await removeGeoPoints(tx, { huntId: params.id });
		await tx.delete(geoHunts).where(eq(geoHunts.id, params.id));
	});
	return new Response(null, { status: 204 });
};
