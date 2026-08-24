import { libsqlClient } from '$lib/server/db';

let phaseFourSchemaReady = false;

export async function ensurePhaseFourSchema() {
	if (phaseFourSchemaReady) return;

	await libsqlClient.execute(`
		CREATE TABLE IF NOT EXISTS phase_four_progress (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE,
			team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE,
			percent INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
		)
	`);
	await libsqlClient.execute('CREATE INDEX IF NOT EXISTS phase_four_progress_event_idx ON phase_four_progress(event_id)');
	await libsqlClient.execute('CREATE INDEX IF NOT EXISTS phase_four_progress_team_idx ON phase_four_progress(team_id)');
	await libsqlClient.execute('CREATE UNIQUE INDEX IF NOT EXISTS phase_four_progress_event_team_uq ON phase_four_progress(event_id, team_id)');

	phaseFourSchemaReady = true;
}
