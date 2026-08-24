import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { geoHunts, geoWaypoints, events, factions, teamGeoProgress, teams } from '$lib/server/schema';
import { eq, asc, desc } from 'drizzle-orm';
import { redirect, error } from '@sveltejs/kit';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';

export const load: PageServerLoad = async ({ params, locals }: any) => {
	await ensureGeoPhaseSchema();
	if (!locals.user || locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const { slug } = params;

	// Load the specific event
	const [event] = await db
		.select()
		.from(events)
		.where(eq(events.slug, slug))
		.limit(1);

	if (!event) {
		throw error(404, 'Evento non trovato');
	}

	// Load only hunts for this event with their waypoints
	const hunts = await db
		.select()
		.from(geoHunts)
		.where(eq(geoHunts.eventId, event.id))
		.orderBy(asc(geoHunts.createdAt));

	const huntsWithWaypoints = await Promise.all(
		hunts.map(async (hunt) => {
			const waypoints = await db
				.select()
				.from(geoWaypoints)
				.where(eq(geoWaypoints.huntId, hunt.id))
				.orderBy(asc(geoWaypoints.sortOrder));
			return { ...hunt, waypoints };
		})
	);

	// Load factions for this event
	const eventFactions = await db
		.select({ id: factions.id, name: factions.name })
		.from(factions)
		.where(eq(factions.eventId, event.id))
		.orderBy(asc(factions.name));

	const progressRows = await db
		.select({
			id: teamGeoProgress.id,
			status: teamGeoProgress.status,
			pointsEarned: teamGeoProgress.pointsEarned,
			photoPath: teamGeoProgress.photoPath,
			completedAt: teamGeoProgress.completedAt,
			updatedAt: teamGeoProgress.updatedAt,
			teamName: teams.name,
			factionId: factions.id,
			factionName: factions.name,
			waypointAdminName: geoWaypoints.adminName,
			waypointDestination: geoWaypoints.name,
			waypointId: geoWaypoints.id,
			huntId: geoHunts.id,
			huntName: geoHunts.name
		})
		.from(teamGeoProgress)
		.innerJoin(teams, eq(teamGeoProgress.teamId, teams.id))
		.innerJoin(factions, eq(teams.factionId, factions.id))
		.innerJoin(geoWaypoints, eq(teamGeoProgress.waypointId, geoWaypoints.id))
		.innerJoin(geoHunts, eq(teamGeoProgress.huntId, geoHunts.id))
		.where(eq(geoHunts.eventId, event.id))
		.orderBy(desc(teamGeoProgress.updatedAt));

	return {
		hunts: huntsWithWaypoints,
		event,
		factions: eventFactions,
		progressRows
	};
};
