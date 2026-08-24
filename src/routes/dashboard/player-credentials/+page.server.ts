import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { ensureAdmin } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { teams, users } from '$lib/server/schema';
import { readPlayerPasswords } from '$lib/server/player-password-vault';
import { provisionTeamPlayers } from '$lib/server/player-provisioning';
import {
	DEFAULT_PLAYER_ACCOUNTS_PER_TEAM,
	normalizePlayerAccountCount
} from '$lib/utils/player-account';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	if (!locals.user || locals.user.role !== 'admin') throw redirect(302, '/dashboard');
	setHeaders({ 'Cache-Control': 'private, no-store' });

	const [allTeams, players] = await Promise.all([
		db.select().from(teams).orderBy(asc(teams.name)),
		db.select().from(users).where(eq(users.role, 'player')).orderBy(asc(users.createdAt))
	]);
	const passwords = await readPlayerPasswords(players.map((player) => player.id));

	return {
		teams: allTeams.map((team) => ({
			id: team.id,
			name: team.name,
			joinCode: team.joinCode,
			players: players
				.filter((player) => player.teamId === team.id)
				.map((player) => ({
					id: player.id,
					name: player.name,
					username: player.username,
					email: player.email,
					password: passwords.get(player.id) || null,
					hasPassword: Boolean(player.passwordHash)
				}))
		}))
	};
};

export const actions: Actions = {
	provision: async ({ request, locals }) => {
		ensureAdmin(locals);
		const formData = await request.formData();
		const teamId = formData.get('teamId');
		const accountCount = normalizePlayerAccountCount(
			formData.get('accountCount') ?? DEFAULT_PLAYER_ACCOUNTS_PER_TEAM
		);
		if (typeof teamId !== 'string' || !teamId) {
			return fail(400, { error: 'Squadra non valida' });
		}
		if (accountCount === null) {
			return fail(400, { error: 'Il numero di giocatori deve essere 3, 4 oppure 5' });
		}

		const credentials = await provisionTeamPlayers(teamId, { accountCount });
		if (!credentials) return fail(404, { error: 'Squadra non trovata' });
		return { success: true, teamId };
	}
};
