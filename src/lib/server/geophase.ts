import { error } from '@sveltejs/kit';
import { and, asc, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	factions,
	geoWaypoints,
	geoHunts,
	teams,
	scoreLedger,
	teamGeoProgress
} from '$lib/server/schema';
import { loadTeamActivityEventContext } from '$lib/server/event-access';
import {
	findCurrentGeoWaypoint,
	isGeoHuntDeadlineExpired,
	selectActiveGeoHunt
} from '$lib/geophase-state';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { claimGeoPhaseSession } from '$lib/server/geophase-session';

export type GeoTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type GeoWaypointContext = {
	teamId: string;
	team: typeof teams.$inferSelect;
	eventId: string;
	waypoint: typeof geoWaypoints.$inferSelect;
	hunt: typeof geoHunts.$inferSelect;
};

export async function loadActiveGeoHuntForTeam(
	team: typeof teams.$inferSelect,
	eventId: string
): Promise<typeof geoHunts.$inferSelect | null> {
	const activeHunts = await db
		.select()
		.from(geoHunts)
		.where(and(eq(geoHunts.eventId, eventId), eq(geoHunts.isActive, true)))
		.orderBy(desc(geoHunts.createdAt), asc(geoHunts.id));

	return selectActiveGeoHunt(activeHunts, team.factionId);
}

export async function assertGeoHuntConfiguration(opts: {
	eventId: string;
	factionId: string | null;
	isActive: boolean;
	excludeHuntId?: string;
}) {
	if (opts.factionId) {
		const [faction] = await db
			.select({ eventId: factions.eventId })
			.from(factions)
			.where(eq(factions.id, opts.factionId))
			.limit(1);
		if (!faction || faction.eventId !== opts.eventId) {
			throw error(400, {
				message: 'La fazione selezionata non appartiene a questo evento'
			});
		}
	}

	if (!opts.isActive) return;

	const scopeCondition = opts.factionId
		? eq(geoHunts.factionId, opts.factionId)
		: isNull(geoHunts.factionId);
	const baseCondition = and(
		eq(geoHunts.eventId, opts.eventId),
		eq(geoHunts.isActive, true),
		scopeCondition
	);
	const [conflict] = await db
		.select({ id: geoHunts.id })
		.from(geoHunts)
		.where(
			opts.excludeHuntId ? and(baseCondition, ne(geoHunts.id, opts.excludeHuntId)) : baseCondition
		)
		.limit(1);

	if (conflict) {
		throw error(409, {
			message: opts.factionId
				? 'Esiste già una caccia attiva per questa fazione'
				: 'Esiste già una caccia generale attiva per questo evento'
		});
	}
}

/** Loads a player waypoint and enforces event, active-hunt and sequence boundaries. */
export async function loadPlayerGeoWaypointContext(
	locals: App.Locals,
	waypointId: unknown
): Promise<GeoWaypointContext> {
	await ensureGeoPhaseSchema();
	await claimGeoPhaseSession(locals);
	if (typeof waypointId !== 'string' || !waypointId) {
		throw error(400, { message: 'waypointId is required' });
	}

	const { team, eventId } = await loadTeamActivityEventContext(locals);
	const teamId = team.id;
	const [waypoint] = await db
		.select()
		.from(geoWaypoints)
		.where(eq(geoWaypoints.id, waypointId))
		.limit(1);
	if (!waypoint) throw error(404, { message: 'Waypoint not found' });

	const [hunt] = await db.select().from(geoHunts).where(eq(geoHunts.id, waypoint.huntId)).limit(1);
	if (!hunt) throw error(404, { message: 'Hunt not found' });
	if (hunt.eventId !== eventId) {
		throw error(403, {
			message: 'Access denied: waypoint is not part of your active event'
		});
	}
	if (hunt.factionId && hunt.factionId !== team.factionId) {
		throw error(403, {
			message: 'Access denied: hunt is not accessible by your faction'
		});
	}

	const activeHunt = await loadActiveGeoHuntForTeam(team, eventId);
	if (!activeHunt || activeHunt.id !== hunt.id) {
		throw error(409, {
			message: 'Questo waypoint non appartiene alla caccia attiva della squadra'
		});
	}
	if (isGeoHuntDeadlineExpired(hunt.deadlineAt)) {
		throw error(410, {
			message: 'La deadline del Path del Cavaliere è scaduta'
		});
	}

	const [waypoints, progressEntries] = await Promise.all([
		db
			.select()
			.from(geoWaypoints)
			.where(eq(geoWaypoints.huntId, hunt.id))
			.orderBy(asc(geoWaypoints.sortOrder), asc(geoWaypoints.id)),
		db
			.select()
			.from(teamGeoProgress)
			.where(and(eq(teamGeoProgress.teamId, teamId), eq(teamGeoProgress.huntId, hunt.id)))
	]);
	const current = findCurrentGeoWaypoint(waypoints, progressEntries);
	if (!current.waypoint || current.waypoint.id !== waypoint.id) {
		throw error(409, {
			message: 'Questo non è il waypoint corrente della squadra'
		});
	}

	return { teamId, team, eventId, waypoint, hunt };
}

function geoLedgerId(teamId: string, waypointId: string, kind: 'arrival' | 'success') {
	return `geophase:${teamId}:${waypointId}:${kind}`;
}

/** Inserts a GeoPhase award once and updates the cache in the same transaction. */
export async function awardGeoPoints(
	tx: GeoTransaction,
	opts: {
		teamId: string;
		waypoint: typeof geoWaypoints.$inferSelect;
		huntId: string;
		points: number;
		kind: 'arrival' | 'success';
		metadata?: Record<string, unknown>;
	}
): Promise<boolean> {
	if (opts.points === 0) return false;
	if (!Number.isInteger(opts.points) || opts.points < 0) {
		throw new Error('Invalid GeoPhase point award');
	}

	const now = new Date();
	const waypointLabel = opts.waypoint.adminName || opts.waypoint.name;
	const inserted = await tx
		.insert(scoreLedger)
		.values({
			id: geoLedgerId(opts.teamId, opts.waypoint.id, opts.kind),
			teamId: opts.teamId,
			eventType: 'base',
			points: opts.points,
			description:
				opts.kind === 'arrival'
					? `GeoPhase: arrivo al waypoint "${waypointLabel}"`
					: `GeoPhase: sfida completata al waypoint "${waypointLabel}"`,
			metadata: {
				source: 'geophase',
				waypointId: opts.waypoint.id,
				huntId: opts.huntId,
				kind: opts.kind,
				...opts.metadata
			},
			syncStatus: 'synced',
			createdAt: now
		})
		.onConflictDoNothing({ target: scoreLedger.id })
		.returning({ id: scoreLedger.id });

	if (inserted.length === 0) return false;

	await tx
		.update(teams)
		.set({ scoreCache: sql`score_cache + ${opts.points}`, updatedAt: now })
		.where(eq(teams.id, opts.teamId));
	return true;
}

/** Removes matching GeoPhase ledger entries and adjusts every affected cache. */
export async function removeGeoPoints(
	tx: GeoTransaction,
	scope: { teamId?: string; waypointId?: string; huntId?: string }
) {
	if (!scope.teamId && !scope.waypointId && !scope.huntId) {
		throw new Error('A GeoPhase score removal scope is required');
	}
	const filters = [sql`json_extract(${scoreLedger.metadata}, '$.source') = 'geophase'`];
	if (scope.teamId) filters.push(eq(scoreLedger.teamId, scope.teamId));
	if (scope.waypointId) {
		filters.push(sql`json_extract(${scoreLedger.metadata}, '$.waypointId') = ${scope.waypointId}`);
	}
	if (scope.huntId) {
		filters.push(sql`json_extract(${scoreLedger.metadata}, '$.huntId') = ${scope.huntId}`);
	}

	const entries = await tx
		.select({
			id: scoreLedger.id,
			teamId: scoreLedger.teamId,
			points: scoreLedger.points
		})
		.from(scoreLedger)
		.where(and(...filters));
	if (entries.length === 0) return;

	await tx.delete(scoreLedger).where(
		inArray(
			scoreLedger.id,
			entries.map((entry) => entry.id)
		)
	);
	const pointsByTeam = new Map<string, number>();
	for (const entry of entries) {
		pointsByTeam.set(entry.teamId, (pointsByTeam.get(entry.teamId) ?? 0) + entry.points);
	}
	for (const [teamId, points] of pointsByTeam) {
		await tx
			.update(teams)
			.set({ scoreCache: sql`score_cache - ${points}`, updatedAt: new Date() })
			.where(eq(teams.id, teamId));
	}
}
