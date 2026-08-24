import { error } from '@sveltejs/kit';
import { libsqlClient } from '$lib/server/db';
import { ensureGeoPhaseSchema } from '$lib/server/geophase-schema';
import { assertTeamAuthenticatedUser } from '$lib/server/event-access';
import { CLAIM_GEO_SESSION_SQL } from '$lib/server/geophase-session-query';

export const GEO_SESSION_LEASE_MS = 2 * 60 * 1000;

function getGeoPlayer(locals: App.Locals) {
	const user = assertTeamAuthenticatedUser(locals);
	if (user.role !== 'player' || !user.teamId) {
		throw error(403, { message: 'GeoPhase disponibile solo ai giocatori associati a una squadra.' });
	}
	return user;
}

/** Atomically acquires or renews the exclusive GeoPhase lease for this session. */
export async function claimGeoPhaseSession(locals: App.Locals) {
	const user = getGeoPlayer(locals);
	const sessionId = locals.sessionId;
	if (!sessionId) throw error(401, { message: 'Sessione non valida.' });
	await ensureGeoPhaseSchema();

	const now = Date.now();
	const expiredBefore = now - GEO_SESSION_LEASE_MS;
	const accountUserId = user.authMethod === 'password' ? user.id : null;
	const result = await libsqlClient.execute({
		sql: CLAIM_GEO_SESSION_SQL,
		args: [user.teamId, accountUserId, sessionId, now, now, expiredBefore]
	});

	if (result.rows.length === 0) {
		throw error(409, {
			message: 'GeoPhase già in uso da un altro giocatore della squadra. Chiudi l’altra sessione o attendi circa due minuti.'
		});
	}
}

export async function releaseGeoPhaseSession(locals: App.Locals) {
	const user = locals.user;
	if (
		!user ||
		user.role !== 'player' ||
		!user.teamId ||
		!locals.sessionId
	) return;

	await ensureGeoPhaseSchema();
	await libsqlClient.execute({
		sql: 'DELETE FROM team_geo_sessions WHERE team_id = ? AND session_id = ?',
		args: [user.teamId, locals.sessionId]
	});
}
