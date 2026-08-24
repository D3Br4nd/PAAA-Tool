import { env } from '$env/dynamic/private';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { libsqlClient } from '$lib/server/db';

let vaultSchemaPromise: Promise<void> | null = null;

function encryptionKey(): Buffer {
	if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
		throw new Error('AUTH_SECRET non impostato o troppo corto');
	}
	return createHash('sha256').update(`player-password-vault:${env.AUTH_SECRET}`).digest();
}

function encryptPassword(password: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
	const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptPassword(payload: string): string | null {
	try {
		const [ivValue, tagValue, encryptedValue] = payload.split('.');
		if (!ivValue || !tagValue || !encryptedValue) return null;
		const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
		decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(encryptedValue, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		return null;
	}
}

async function applyVaultSchema(): Promise<void> {
	await libsqlClient.execute(`
		CREATE TABLE IF NOT EXISTS player_password_vault (
			user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
			encrypted_password TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`);
}

export function ensurePlayerPasswordVault(): Promise<void> {
	if (!vaultSchemaPromise) {
		vaultSchemaPromise = applyVaultSchema().catch((error) => {
			vaultSchemaPromise = null;
			throw error;
		});
	}
	return vaultSchemaPromise;
}

export async function storePlayerPassword(userId: string, password: string): Promise<void> {
	await ensurePlayerPasswordVault();
	await libsqlClient.execute({
		sql: `
			INSERT INTO player_password_vault (user_id, encrypted_password, updated_at)
			VALUES (?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				encrypted_password = excluded.encrypted_password,
				updated_at = excluded.updated_at
		`,
		args: [userId, encryptPassword(password), Date.now()]
	});
}

export async function readPlayerPasswords(userIds: string[]): Promise<Map<string, string>> {
	await ensurePlayerPasswordVault();
	if (userIds.length === 0) return new Map();

	const placeholders = userIds.map(() => '?').join(',');
	const result = await libsqlClient.execute({
		sql: `SELECT user_id, encrypted_password FROM player_password_vault WHERE user_id IN (${placeholders})`,
		args: userIds
	});
	const passwords = new Map<string, string>();
	for (const row of result.rows) {
		const userId = String(row.user_id);
		const password = decryptPassword(String(row.encrypted_password));
		if (password) passwords.set(userId, password);
	}
	return passwords;
}
