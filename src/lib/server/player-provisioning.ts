import { and, asc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '$lib/server/db';
import { teams, users } from '$lib/server/schema';
import { planetAvatarUrl } from '$lib/utils/planet-avatar';
import {
	DEFAULT_PLAYER_ACCOUNTS_PER_TEAM,
	isValidPlayerUsername,
	normalizePlayerAccountCount,
	normalizePlayerUsername,
	playerSlotName,
	playerSlotUsername
} from '$lib/utils/player-account';
import { storePlayerPassword } from '$lib/server/player-password-vault';
import { generatePlayerAccessPassword } from '$lib/server/player-access-password';

export async function hashPlayerPassword(password: string): Promise<string> {
	return Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

async function availableSlotUsername(joinCode: string, slot: number, reserved = new Set<string>()): Promise<string> {
	const base = playerSlotUsername(joinCode, slot);

	for (let attempt = 0; attempt < 100; attempt += 1) {
		const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
		const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
		if (reserved.has(candidate)) continue;
		const [owner] = await db
			.select({ id: users.id })
			.from(users)
			.where(eq(users.username, candidate))
			.limit(1);
		if (!owner) return candidate;
	}

	throw new Error('Impossibile generare uno username disponibile');
}

export type ProvisionedPlayerCredentials = {
	teamId: string;
	teamName: string;
	password: string;
	accounts: Array<{ id: string; name: string; username: string }>;
};

export type PlayerProvisioningOptions = {
	usernames?: Array<string | null | undefined>;
	password?: string;
	accountCount?: number;
};

export class PlayerProvisioningError extends Error {}

export async function provisionTeamPlayers(
	teamId: string,
	options: PlayerProvisioningOptions = {}
): Promise<ProvisionedPlayerCredentials | null> {
	const accountCount = normalizePlayerAccountCount(
		options.accountCount ?? DEFAULT_PLAYER_ACCOUNTS_PER_TEAM
	);
	if (accountCount === null) {
		throw new PlayerProvisioningError('Il numero di giocatori deve essere 3, 4 oppure 5');
	}
	const requestedUsernames = Array.from({ length: accountCount }, (_, index) =>
		normalizePlayerUsername(options.usernames?.[index])
	);
	const suppliedUsernames = requestedUsernames.filter(Boolean);
	if (suppliedUsernames.some((username) => !isValidPlayerUsername(username))) {
		throw new PlayerProvisioningError('Uno degli username manuali non è valido');
	}
	if (new Set(suppliedUsernames).size !== suppliedUsernames.length) {
		throw new PlayerProvisioningError('Gli username manuali devono essere diversi tra loro');
	}
	const password = options.password || generatePlayerAccessPassword();
	if (password.length < 8 || password.length > 128) {
		throw new PlayerProvisioningError('La password comune deve contenere da 8 a 128 caratteri');
	}

	const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
	if (!team) return null;

	const teamPlayers = await db
		.select()
		.from(users)
		.where(and(eq(users.teamId, teamId), eq(users.role, 'player')))
		.orderBy(asc(users.createdAt));
	for (let index = 0; index < requestedUsernames.length; index += 1) {
		const username = requestedUsernames[index];
		if (!username) continue;
		const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
		if (owner && owner.id !== teamPlayers[index]?.id) {
			throw new PlayerProvisioningError(`Username già utilizzato: ${username}`);
		}
	}

	for (let slot = teamPlayers.length + 1; slot <= accountCount; slot += 1) {
		const id = uuidv7();
		const player = {
			id,
			email: null,
			username: null,
			passwordHash: null,
			name: playerSlotName(team.joinCode, slot),
			avatarUrl: planetAvatarUrl(id),
			role: 'player' as const,
			teamId,
			createdAt: new Date(),
			updatedAt: new Date()
		};
		await db.insert(users).values(player);
		teamPlayers.push(player);
	}

	const accessPlayers = teamPlayers.slice(0, accountCount);
	const passwordHash = await hashPlayerPassword(password);
	const accounts: Array<{ id: string; name: string; username: string }> = [];
	const reservedUsernames = new Set<string>();

	for (let index = 0; index < accessPlayers.length; index += 1) {
		const player = accessPlayers[index];
		let username = requestedUsernames[index] || normalizePlayerUsername(player.username);
		if (!isValidPlayerUsername(username)) {
			username = await availableSlotUsername(team.joinCode, index + 1, reservedUsernames);
		}
		if (reservedUsernames.has(username)) {
			throw new PlayerProvisioningError(`Username duplicato: ${username}`);
		}
		reservedUsernames.add(username);
		const savedName = player.name?.trim();
		const name = !savedName || /^Giocatore\s+\d+$/i.test(savedName)
			? playerSlotName(team.joinCode, index + 1)
			: savedName;

		await db
			.update(users)
			.set({ username, name, passwordHash, updatedAt: new Date() })
			.where(eq(users.id, player.id));
		await storePlayerPassword(player.id, password);
		accounts.push({ id: player.id, name, username });
	}

	return { teamId: team.id, teamName: team.name, password, accounts };
}
