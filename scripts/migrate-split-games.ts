import { createClient } from '@libsql/client';

const client = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
});

async function columnExists(table: string, column: string) {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    return info.rows.some((r: any) => r[1] === column);
}

async function tableExists(table: string) {
    const result = await client.execute({
        sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
        args: [table]
    });
    return result.rows.length > 0;
}

async function exec(sql: string) {
    await client.execute(sql);
}

async function migrate() {
    if (!(await columnExists('challenges', 'challenge_type'))) {
        await exec(`ALTER TABLE challenges ADD COLUMN challenge_type TEXT NOT NULL DEFAULT 'program'`);
    }

    await exec(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY NOT NULL,
            event_id TEXT NOT NULL REFERENCES events(id) ON UPDATE cascade ON DELETE cascade,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            scoring_type TEXT NOT NULL,
            base_points INTEGER NOT NULL DEFAULT 0,
            max_points INTEGER,
            has_ranking_bonus INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            config TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        )
    `);
    await exec(`CREATE INDEX IF NOT EXISTS games_event_idx ON games(event_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS games_code_idx ON games(code)`);

    await exec(`
        CREATE TABLE IF NOT EXISTS game_steps (
            id TEXT PRIMARY KEY NOT NULL,
            game_id TEXT NOT NULL REFERENCES games(id) ON UPDATE cascade ON DELETE cascade,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            step_order INTEGER NOT NULL DEFAULT 0,
            scoring_rules TEXT,
            penalty_points INTEGER NOT NULL DEFAULT 0,
            is_blocking INTEGER NOT NULL DEFAULT 0
        )
    `);
    await exec(`CREATE INDEX IF NOT EXISTS game_steps_game_idx ON game_steps(game_id)`);

    await exec(`
        CREATE TABLE IF NOT EXISTS team_game_completions (
            id TEXT PRIMARY KEY NOT NULL,
            team_id TEXT NOT NULL REFERENCES teams(id) ON UPDATE cascade ON DELETE cascade,
            game_id TEXT NOT NULL REFERENCES games(id) ON UPDATE cascade ON DELETE cascade,
            completed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
            arrival_rank INTEGER,
            total_points INTEGER NOT NULL DEFAULT 0,
            metadata TEXT,
            created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
            updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
        )
    `);
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS tgc_team_game_uq ON team_game_completions(team_id, game_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS tgc_team_idx ON team_game_completions(team_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS tgc_game_idx ON team_game_completions(game_id)`);

    if (!(await columnExists('score_ledger', 'game_id'))) {
        await exec(`ALTER TABLE score_ledger ADD COLUMN game_id TEXT REFERENCES games(id) ON UPDATE cascade ON DELETE set null`);
    }
    if (!(await columnExists('score_ledger', 'game_step_id'))) {
        await exec(`ALTER TABLE score_ledger ADD COLUMN game_step_id TEXT REFERENCES game_steps(id) ON UPDATE cascade ON DELETE set null`);
    }
    await exec(`CREATE INDEX IF NOT EXISTS score_ledger_game_idx ON score_ledger(game_id)`);

    await exec(`
        INSERT INTO games (
            id, event_id, code, name, description, scoring_type, base_points, max_points,
            has_ranking_bonus, sort_order, config, created_at, updated_at
        )
        SELECT
            id, event_id, code, name, description, scoring_type, base_points, max_points,
            has_ranking_bonus, sort_order, config, created_at, updated_at
        FROM challenges
        WHERE challenge_type = 'game' OR scoring_type = 'timed_obstacle'
        ON CONFLICT(id) DO NOTHING
    `);

    await exec(`
        INSERT INTO game_steps (
            id, game_id, code, name, step_order, scoring_rules, penalty_points, is_blocking
        )
        SELECT
            cs.id, cs.challenge_id, cs.code, cs.name, cs.step_order,
            cs.scoring_rules, cs.penalty_points, cs.is_blocking
        FROM challenge_steps cs
        INNER JOIN challenges c ON c.id = cs.challenge_id
        WHERE c.challenge_type = 'game' OR c.scoring_type = 'timed_obstacle'
        ON CONFLICT(id) DO NOTHING
    `);

    await exec(`
        INSERT INTO team_game_completions (
            id, team_id, game_id, completed_at, arrival_rank, total_points,
            metadata, created_at, updated_at
        )
        SELECT
            id, team_id, challenge_id, completed_at, arrival_rank, total_points,
            metadata, created_at, updated_at
        FROM team_challenge_completions
        WHERE challenge_id IN (SELECT id FROM games)
        ON CONFLICT(team_id, game_id) DO NOTHING
    `);

    await exec(`
        UPDATE score_ledger
        SET game_id = challenge_id, challenge_id = NULL
        WHERE challenge_id IN (SELECT id FROM games)
    `);

    await exec(`
        UPDATE score_ledger
        SET game_step_id = step_id, step_id = NULL
        WHERE game_id IS NOT NULL AND step_id IN (SELECT id FROM game_steps)
    `);

    await exec(`DELETE FROM team_challenge_completions WHERE challenge_id IN (SELECT id FROM games)`);
    await exec(`DELETE FROM challenge_steps WHERE challenge_id IN (SELECT id FROM games)`);
    await exec(`DELETE FROM challenges WHERE challenge_type = 'game' OR scoring_type = 'timed_obstacle'`);

    console.log('Split migration complete: programs stay in challenges, games and timed obstacles moved to games.');
}

migrate()
    .catch((e) => {
        console.error('Migration failed:', e);
        process.exit(1);
    })
    .finally(() => client.close());
