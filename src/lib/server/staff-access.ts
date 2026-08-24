import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { teams, factions, scoreLedger } from '$lib/server/schema';
import { eq } from 'drizzle-orm';

/**
 * Horizontal authorisation for judge actions.
 *
 * Admins and staff can use every faction. Form actions still receive ids
 * straight from the client, so this check ensures the selected team belongs
 * to the same event as the challenge being judged.
 */
export async function assertStaffCanAccessTeam(
	locals: App.Locals,
	teamId: string,
	expectedEventId?: string
) {
	const user = locals.user;
	if (!user) throw error(401, { message: 'Authentication required' });
	if (user.role !== 'staff' && user.role !== 'admin') {
		throw error(403, { message: 'Forbidden: Staff access required' });
	}

	const [team] = await db
		.select({ factionId: teams.factionId, eventId: factions.eventId })
		.from(teams)
		.leftJoin(factions, eq(teams.factionId, factions.id))
		.where(eq(teams.id, teamId))
		.limit(1);

	if (!team) throw error(404, { message: 'Squadra non trovata' });
	if (!team.factionId) {
		throw error(403, { message: 'Accesso negato: la squadra non appartiene a una fazione' });
	}
	if (!team.eventId || (expectedEventId && team.eventId !== expectedEventId)) {
		throw error(403, { message: 'Accesso negato: la squadra non appartiene a questo evento' });
	}
}

/**
 * Same check, resolved through the ledger entry being acted upon, so a staff
 * member cannot delete scoring history belonging to another faction.
 */
export async function assertStaffCanAccessLedgerEntry(
	locals: App.Locals,
	entryId: string,
	expectedEventId?: string
) {
	const [entry] = await db
		.select({ teamId: scoreLedger.teamId })
		.from(scoreLedger)
		.where(eq(scoreLedger.id, entryId))
		.limit(1);

	if (!entry) throw error(404, { message: 'Voce non trovata' });
	await assertStaffCanAccessTeam(locals, entry.teamId, expectedEventId);
}
