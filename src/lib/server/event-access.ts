import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { factions, teams } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { hasPasswordActivityAccess, hasTeamActivityAccess } from './event-access-policy';

export type TeamEventContext = {
	team: typeof teams.$inferSelect;
	eventId: string;
};

export function isPrivilegedEventUser(user: App.SessionUser | null) {
	return user?.role === 'admin' || user?.role === 'staff';
}

export function assertPasswordAuthenticatedUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}
	if (!hasPasswordActivityAccess(locals.user)) {
		throw error(403, { message: 'Per questa prova è richiesto un account giocatore.' });
	}
	return locals.user;
}

/**
 * Team-scoped activities may be used either by a personal player account or
 * by a join-code session. The latter still carries a signed team id and must
 * never gain account-level privileges.
 */
export function assertTeamAuthenticatedUser(locals: App.Locals) {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}
	if (!hasTeamActivityAccess(locals.user)) {
		throw error(403, { message: 'Player team access only' });
	}
	return locals.user;
}

async function loadTeamEventContext(user: App.SessionUser): Promise<TeamEventContext> {
	if (!user.teamId) {
		throw error(400, { message: 'User not assigned to a team' });
	}

	const [team] = await db.select().from(teams).where(eq(teams.id, user.teamId)).limit(1);
	if (!team) throw error(404, { message: 'Team not found' });
	if (!team.factionId) throw error(403, { message: 'No event associated with your team/faction' });

	const [faction] = await db.select().from(factions).where(eq(factions.id, team.factionId)).limit(1);
	if (!faction) throw error(403, { message: 'No event associated with your team/faction' });

	return { team, eventId: faction.eventId };
}

export async function loadTeamActivityEventContext(locals: App.Locals): Promise<TeamEventContext> {
	return loadTeamEventContext(assertTeamAuthenticatedUser(locals));
}

export async function loadPlayerTeamEventContext(locals: App.Locals): Promise<TeamEventContext> {
	const user = assertPasswordAuthenticatedUser(locals);
	if (user.role !== 'player') {
		throw error(403, { message: 'Player access only' });
	}
	return loadTeamEventContext(user);
}

export async function assertEventPhaseAccess(
	locals: App.Locals,
	target: { eventId: string; factionId?: string | null }
) {
	if (isPrivilegedEventUser(locals.user)) {
		assertPasswordAuthenticatedUser(locals);
		return;
	}

	const { team, eventId } = await loadTeamActivityEventContext(locals);
	if (eventId !== target.eventId) {
		throw error(403, { message: 'Access denied: phase is not part of your event' });
	}
	if (target.factionId && target.factionId !== team.factionId) {
		throw error(403, { message: 'Access denied: phase is not accessible by your team' });
	}
}
