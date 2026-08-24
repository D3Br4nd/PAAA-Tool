import { describe, expect, test } from 'bun:test';
import { createClient } from '@libsql/client';
import { CLAIM_GEO_SESSION_SQL } from './geophase-session-query';

describe('GeoPhase exclusive session lease', () => {
	test('renews the owner, rejects a concurrent session and permits an expired takeover', async () => {
		const client = createClient({ url: 'file::memory:' });
		await client.execute(`
			CREATE TABLE team_geo_sessions (
				team_id TEXT PRIMARY KEY,
				user_id TEXT,
				session_id TEXT NOT NULL,
				acquired_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL
			)
		`);

		const claim = (userId: string | null, sessionId: string, now: number, expiredBefore: number) =>
			client.execute({
				sql: CLAIM_GEO_SESSION_SQL,
				args: ['team-1', userId, sessionId, now, now, expiredBefore]
			});

		const first = await claim('user-1', 'session-1', 1_000, 0);
		expect(first.rows).toHaveLength(1);

		const ownerRenewal = await claim('user-1', 'session-1', 2_000, 0);
		expect(ownerRenewal.rows).toHaveLength(1);

		const concurrent = await claim('user-2', 'session-2', 3_000, 0);
		expect(concurrent.rows).toHaveLength(0);

		const takeover = await claim('user-2', 'session-2', 200_000, 100_000);
		expect(takeover.rows).toHaveLength(1);

		const row = await client.execute('SELECT user_id, session_id FROM team_geo_sessions');
		expect(row.rows[0]).toMatchObject({ user_id: 'user-2', session_id: 'session-2' });
		client.close();
	});

	test('supports a join-code owner without a users row', async () => {
		const client = createClient({ url: 'file::memory:' });
		await client.execute(`
			CREATE TABLE team_geo_sessions (
				team_id TEXT PRIMARY KEY,
				user_id TEXT,
				session_id TEXT NOT NULL,
				acquired_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL
			)
		`);

		const result = await client.execute({
			sql: CLAIM_GEO_SESSION_SQL,
			args: ['team-1', null, 'code-session', 1_000, 1_000, 0]
		});
		expect(result.rows).toHaveLength(1);

		const row = await client.execute('SELECT user_id, session_id FROM team_geo_sessions');
		expect(row.rows[0]).toMatchObject({ user_id: null, session_id: 'code-session' });
		client.close();
	});
});
