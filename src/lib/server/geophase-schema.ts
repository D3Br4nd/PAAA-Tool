import { libsqlClient } from '$lib/server/db';

let geoPhaseSchemaPromise: Promise<void> | null = null;

async function applyGeoPhaseSchema() {
	await libsqlClient.execute(`
		CREATE TABLE IF NOT EXISTS team_geo_sessions (
			team_id TEXT PRIMARY KEY NOT NULL REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE,
			user_id TEXT REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
			session_id TEXT NOT NULL,
			acquired_at INTEGER NOT NULL,
			last_seen_at INTEGER NOT NULL
		)
	`);

	// Join-code sessions represent a signed team rather than a users row, so
	// user_id must be nullable. Rebuild legacy tables that declared it NOT NULL.
	const sessionInfo = await libsqlClient.execute('PRAGMA table_info(team_geo_sessions)');
	const sessionUserId = sessionInfo.rows.find((row: any) => row.name === 'user_id');
	if (Number(sessionUserId?.notnull) === 1) {
		await libsqlClient.batch([
			'DROP TABLE IF EXISTS team_geo_sessions_new',
			`CREATE TABLE team_geo_sessions_new (
				team_id TEXT PRIMARY KEY NOT NULL REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE,
				user_id TEXT REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
				session_id TEXT NOT NULL,
				acquired_at INTEGER NOT NULL,
				last_seen_at INTEGER NOT NULL
			)`,
			`INSERT INTO team_geo_sessions_new (team_id, user_id, session_id, acquired_at, last_seen_at)
			 SELECT team_id, user_id, session_id, acquired_at, last_seen_at FROM team_geo_sessions`,
			'DROP TABLE team_geo_sessions',
			'ALTER TABLE team_geo_sessions_new RENAME TO team_geo_sessions'
		], 'write');
	}
	await libsqlClient.execute(`
		CREATE INDEX IF NOT EXISTS team_geo_sessions_last_seen_idx
		ON team_geo_sessions(last_seen_at)
	`);

	const waypointInfo = await libsqlClient.execute('PRAGMA table_info(geo_waypoints)');
	const waypointColumns = new Set(waypointInfo.rows.map((row: any) => row.name as string));
	if (!waypointColumns.has('admin_name')) {
		await libsqlClient.execute('ALTER TABLE geo_waypoints ADD COLUMN admin_name TEXT');
	}
	if (!waypointColumns.has('quiz_options')) {
		await libsqlClient.execute('ALTER TABLE geo_waypoints ADD COLUMN quiz_options TEXT');
	}
	await libsqlClient.execute(`
		UPDATE geo_waypoints
		SET admin_name = CASE challenge_type
			WHEN 'gps' THEN 'Ricerca GPS ' || (sort_order + 1)
			WHEN 'photo' THEN 'Modulo Foto ' || (sort_order + 1)
			WHEN 'quiz' THEN 'Modulo Quiz ' || (sort_order + 1)
			ELSE 'Modulo ' || (sort_order + 1)
		END
		WHERE admin_name IS NULL OR trim(admin_name) = ''
	`);

	const huntInfo = await libsqlClient.execute('PRAGMA table_info(geo_hunts)');
	const huntColumns = new Set(huntInfo.rows.map((row: any) => row.name as string));
	if (!huntColumns.has('challenge_disclaimer_text')) {
		await libsqlClient.execute('ALTER TABLE geo_hunts ADD COLUMN challenge_disclaimer_text TEXT');
	}
	if (!huntColumns.has('deadline_at')) {
		await libsqlClient.execute('ALTER TABLE geo_hunts ADD COLUMN deadline_at INTEGER');
	}
}

export async function ensureGeoPhaseSchema() {
	if (!geoPhaseSchemaPromise) {
		geoPhaseSchemaPromise = applyGeoPhaseSchema().catch((cause) => {
			geoPhaseSchemaPromise = null;
			throw cause;
		});
	}
	return geoPhaseSchemaPromise;
}
