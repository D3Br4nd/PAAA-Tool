/**
 * Pre-migration script to ensure indexes exist with IF NOT EXISTS
 * This avoids the drizzle-kit SQLite bug where CREATE INDEX is duplicated
 */
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
dotenv.config();

const db = createClient({
    url: process.env.DATABASE_URL || 'http://db:8080',
    authToken: process.env.DATABASE_AUTH_TOKEN
});

const INDEXES = [
    // Events
    'CREATE UNIQUE INDEX IF NOT EXISTS events_slug_uq ON events(slug)',
    // Factions
    'CREATE INDEX IF NOT EXISTS factions_event_idx ON factions(event_id)',
    // Teams
    'CREATE UNIQUE INDEX IF NOT EXISTS teams_join_code_uq ON teams(join_code)',
    'CREATE INDEX IF NOT EXISTS teams_faction_idx ON teams(faction_id)',
    // Users
    'CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users(email)',
    'CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON users(username COLLATE NOCASE)',
    'CREATE INDEX IF NOT EXISTS users_team_idx ON users(team_id)',
    // Messages
    'CREATE INDEX IF NOT EXISTS messages_sender_idx ON messages(sender_id)',
    'CREATE INDEX IF NOT EXISTS messages_recipient_idx ON messages(recipient_id)',
    'CREATE INDEX IF NOT EXISTS messages_recipient_team_idx ON messages(recipient_team_id)'
];

async function ensureIndexes() {
    console.log('Ensuring indexes exist with IF NOT EXISTS...');

    // Existing installations need the additive column before drizzle-kit and
    // the admin seed query start selecting/inserting the expanded users row.
    const usersInfo = await db.execute('PRAGMA table_info(users)');
    if (usersInfo.rows.length > 0 && !usersInfo.rows.some((row) => row.name === 'username')) {
        await db.execute('ALTER TABLE users ADD COLUMN username TEXT');
        console.log('  ✓ users.username');
    }

    for (const sql of INDEXES) {
        try {
            await db.execute(sql);
            // Extract index name for logging
            const match = sql.match(/INDEX.*?(\w+_\w+)\s+ON/);
            const indexName = match ? match[1] : 'unknown';
            console.log(`  ✓ ${indexName}`);
        } catch (error: unknown) {
            // Ignore "table does not exist" errors (table will be created by push)
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('no such table')) {
                console.log(`  ⏭ Skipped (table not yet created)`);
            } else {
                console.error(`  ✗ Error: ${message}`);
            }
        }
    }

    console.log('Index pre-check complete.');
}

ensureIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Failed:', err);
        process.exit(1);
    });
