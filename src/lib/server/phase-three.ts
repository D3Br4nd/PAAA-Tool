import { libsqlClient } from "$lib/server/db";

let phaseThreeSchemaReady = false;

export async function ensurePhaseThreeSchema() {
  if (phaseThreeSchemaReady) return;

  await libsqlClient.execute(`
		CREATE TABLE IF NOT EXISTS phase_three_scores (
			id TEXT PRIMARY KEY,
			event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE,
			team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE ON UPDATE CASCADE,
			score INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
		)
	`);
  await libsqlClient.execute(
    "CREATE INDEX IF NOT EXISTS phase_three_scores_event_idx ON phase_three_scores(event_id)",
  );
  await libsqlClient.execute(
    "CREATE INDEX IF NOT EXISTS phase_three_scores_team_idx ON phase_three_scores(team_id)",
  );
  await libsqlClient.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS phase_three_scores_event_team_uq ON phase_three_scores(event_id, team_id)",
  );

  phaseThreeSchemaReady = true;
}
