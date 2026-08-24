import type { RequestHandler } from './$types';
import { error, json } from '@sveltejs/kit';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { geoWaypoints } from '$lib/server/schema';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}

	const body = await request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, { message: 'Invalid request body' });
	const { firstId, secondId } = body as Record<string, unknown>;
	if (typeof firstId !== 'string' || typeof secondId !== 'string' || firstId === secondId) {
		throw error(400, { message: 'Two different waypoint IDs are required' });
	}

	const changed = await db.transaction(async (tx) => {
		const waypoints = await tx
			.select({ id: geoWaypoints.id, huntId: geoWaypoints.huntId, sortOrder: geoWaypoints.sortOrder })
			.from(geoWaypoints)
			.where(inArray(geoWaypoints.id, [firstId, secondId]));
		if (waypoints.length !== 2 || waypoints[0].huntId !== waypoints[1].huntId) return false;

		const first = waypoints.find((waypoint) => waypoint.id === firstId)!;
		const second = waypoints.find((waypoint) => waypoint.id === secondId)!;
		await tx
			.update(geoWaypoints)
			.set({ sortOrder: second.sortOrder, updatedAt: new Date() })
			.where(and(eq(geoWaypoints.id, first.id), eq(geoWaypoints.huntId, first.huntId)));
		await tx
			.update(geoWaypoints)
			.set({ sortOrder: first.sortOrder, updatedAt: new Date() })
			.where(and(eq(geoWaypoints.id, second.id), eq(geoWaypoints.huntId, second.huntId)));
		return true;
	});

	if (!changed) throw error(404, { message: 'Waypoints not found in the same hunt' });
	return json({ success: true });
};
