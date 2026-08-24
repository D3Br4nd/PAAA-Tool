import { libsqlClient } from '$lib/server/db';

let messagesSchemaReady = false;

export async function ensureMessagesSchema() {
	if (messagesSchemaReady) return;

	const info = await libsqlClient.execute('PRAGMA table_info(messages)');
	const hasExpiresAt = info.rows.some((row) => row.name === 'expires_at');
	if (!hasExpiresAt) {
		await libsqlClient.execute('ALTER TABLE messages ADD COLUMN expires_at INTEGER');
	}

	messagesSchemaReady = true;
}
