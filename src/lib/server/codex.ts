import { libsqlClient } from '$lib/server/db';
import { pbkdf2 } from 'node:crypto';
import { promisify } from 'node:util';

const pbkdf2Async = promisify(pbkdf2);

/**
 * NOTE: this salt is a fixed value shared by the encrypt (dashboard) and
 * decrypt (player) paths. It cannot be changed to a per-puzzle salt without
 * making every already-published puzzle undecryptable.
 *
 * A per-puzzle salt would buy little here in any case: `codex_janara_puzzles`
 * stores `plaintext` and `keyword` in the clear alongside the ciphertext, so
 * database read access already reveals the answer. The encryption protects the
 * QR/URL flow, not the database.
 */
const CODEX_SALT = 'codex-janara-hardened-salt';
const CODEX_ITERATIONS = 100_000;

/**
 * Derives the AES key from a keyword. Async on purpose: the synchronous
 * variant blocks the single-process event loop for the full 100k iterations,
 * so concurrent decrypt attempts stall every other request on the server.
 *
 * The keyword is trimmed and lowercased before derivation so players can type
 * it in any case. This is called on both the encrypt (dashboard) and decrypt
 * (player) paths, so normalizing here keeps them in lockstep automatically.
 */
export async function deriveCodexKey(keyword: string): Promise<Buffer> {
	const normalized = keyword.trim().toLowerCase();
	return (await pbkdf2Async(normalized, CODEX_SALT, CODEX_ITERATIONS, 32, 'sha256')) as Buffer;
}

/**
 * Eight-character ids are kept for already printed QR codes. New links use
 * the complete UUID because the leading bytes of UUIDv7 are timestamp-based:
 * puzzles created together can legitimately share the same short prefix.
 * Strict validation prevents LIKE wildcard injection in the legacy lookup.
 */
const LEGACY_SHORT_ID_RE = /^[0-9a-f]{8}$/i;
const FULL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidCodexShortId(value: unknown): value is string {
	return typeof value === 'string' && (LEGACY_SHORT_ID_RE.test(value) || FULL_UUID_RE.test(value));
}

let codexSchemaReady = false;

export async function ensureCodexSchema() {
	if (codexSchemaReady) return;

	const puzzleInfo = await libsqlClient.execute('PRAGMA table_info(codex_janara_puzzles)');
	const puzzleColumns = new Set(puzzleInfo.rows.map((row: any) => row.name as string));
	if (!puzzleColumns.has('points_on_decode')) {
		await libsqlClient.execute('ALTER TABLE codex_janara_puzzles ADD COLUMN points_on_decode INTEGER NOT NULL DEFAULT 0');
	}

	const logInfo = await libsqlClient.execute('PRAGMA table_info(codex_decode_log)');
	const logColumns = new Set(logInfo.rows.map((row: any) => row.name as string));
	if (!logColumns.has('team_id')) {
		await libsqlClient.execute('ALTER TABLE codex_decode_log ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE CASCADE');
	}
	if (!logColumns.has('points_awarded')) {
		await libsqlClient.execute('ALTER TABLE codex_decode_log ADD COLUMN points_awarded INTEGER NOT NULL DEFAULT 0');
	}

	await libsqlClient.execute('DROP INDEX IF EXISTS codex_decode_puzzle_uq');
	await libsqlClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS codex_decode_puzzle_team_uq ON codex_decode_log(puzzle_id, team_id)');

	codexSchemaReady = true;
}
