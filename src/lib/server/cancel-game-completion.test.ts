import { describe, expect, test, afterAll } from 'bun:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { existsSync, unlinkSync } from 'fs';
import * as schema from './schema';
import { cancelGameCompletion } from './cancel-game-completion';

describe('Annullamento gioco per una squadra', () => {
	const dbFile = `test_cancel_game_${Date.now()}.db`;

	afterAll(() => {
		if (existsSync(dbFile)) unlinkSync(dbFile);
	});

	async function createTestDb() {
		const client = createClient({ url: `file:${dbFile}` });
		const testDb = drizzle(client, { schema });

		const statements = [
			`CREATE TABLE IF NOT EXISTS events (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				slug TEXT NOT NULL UNIQUE,
				is_active INTEGER NOT NULL DEFAULT 0,
				event_type TEXT NOT NULL DEFAULT 'cate',
				classification TEXT,
				description TEXT,
				logo_url TEXT,
				start_date INTEGER,
				end_date INTEGER,
				theme_config TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS factions (
				id TEXT PRIMARY KEY,
				event_id TEXT NOT NULL,
				name TEXT NOT NULL,
				color TEXT,
				icon TEXT,
				avatar_url TEXT,
				description TEXT,
				faction_type TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS teams (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				join_code TEXT NOT NULL,
				score_cache INTEGER NOT NULL DEFAULT 0,
				color TEXT NOT NULL DEFAULT '#3b82f6',
				avatar_url TEXT,
				description TEXT,
				current_phase_id TEXT,
				faction_id TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS games (
				id TEXT PRIMARY KEY,
				event_id TEXT NOT NULL,
				code TEXT NOT NULL,
				name TEXT NOT NULL,
				description TEXT,
				scoring_type TEXT NOT NULL,
				base_points INTEGER NOT NULL DEFAULT 0,
				max_points INTEGER,
				has_ranking_bonus INTEGER NOT NULL DEFAULT 0,
				sort_order INTEGER NOT NULL DEFAULT 0,
				config TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS team_game_completions (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL,
				game_id TEXT NOT NULL,
				completed_at INTEGER NOT NULL,
				arrival_rank INTEGER,
				total_points INTEGER NOT NULL DEFAULT 0,
				metadata TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS tgc_team_game_uq ON team_game_completions(team_id, game_id)`,
			`CREATE TABLE IF NOT EXISTS score_ledger (
				id TEXT PRIMARY KEY,
				team_id TEXT NOT NULL,
				challenge_id TEXT,
				game_id TEXT,
				step_id TEXT,
				game_step_id TEXT,
				event_type TEXT NOT NULL,
				points INTEGER NOT NULL,
				description TEXT,
				metadata TEXT,
				judge_user_id TEXT,
				sync_status TEXT NOT NULL DEFAULT 'pending',
				created_at INTEGER NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS activity_logs (
				id TEXT PRIMARY KEY,
				event_id TEXT,
				team_id TEXT,
				type TEXT NOT NULL,
				content TEXT NOT NULL,
				created_at INTEGER NOT NULL
			)`
		];

		for (const statement of statements) {
			await client.execute(statement);
		}

		return { client, testDb };
	}

	test('restituisce null per un completamento inesistente', async () => {
		const { client, testDb } = await createTestDb();
		const result = await cancelGameCompletion('non-existent-id', testDb);
		expect(result).toBeNull();
		client.close();
	});

	test('elimina completamento, storna i punti e pulisce il registro', async () => {
		const { client, testDb } = await createTestDb();
		const now = new Date();

		// Inserisci dati di test
		await testDb.insert(schema.events).values({
			id: 'ev-1',
			name: 'Palio 2026',
			slug: 'palio-2026',
			isActive: true,
			eventType: 'cate',
			createdAt: now,
			updatedAt: now
		});

		await testDb.insert(schema.factions).values({
			id: 'fac-1',
			eventId: 'ev-1',
			name: 'I Grifoni',
			color: '#ef4444',
			createdAt: now,
			updatedAt: now
		});

		await testDb.insert(schema.teams).values({
			id: 'tm-1',
			factionId: 'fac-1',
			name: 'Squadra Rossa',
			joinCode: 'TEAM123',
			scoreCache: 150, // Punteggio prima dell'annullamento
			createdAt: now,
			updatedAt: now
		});

		await testDb.insert(schema.games).values({
			id: 'gm-1',
			eventId: 'ev-1',
			name: 'Tiro con Arco',
			code: 'ARCO',
			scoringType: 'timed_obstacle',
			basePoints: 50,
			sortOrder: 1,
			createdAt: now,
			updatedAt: now
		});

		await testDb.insert(schema.teamGameCompletions).values({
			id: 'comp-1',
			teamId: 'tm-1',
			gameId: 'gm-1',
			completedAt: now,
			totalPoints: 75,
			createdAt: now,
			updatedAt: now
		});

		await testDb.insert(schema.scoreLedger).values([
			{
				id: 'led-1',
				teamId: 'tm-1',
				gameId: 'gm-1',
				eventType: 'time_bonus',
				points: 50,
				description: 'Base tempo',
				createdAt: now
			},
			{
				id: 'led-2',
				teamId: 'tm-1',
				gameId: 'gm-1',
				eventType: 'special_bonus',
				points: 25,
				description: 'Bonus precisione',
				createdAt: now
			},
			{
				id: 'led-other',
				teamId: 'tm-1',
				gameId: 'gm-2',
				eventType: 'base',
				points: 75,
				description: 'Altro gioco non correlato',
				createdAt: now
			}
		]);

		// Esegui cancellazione del completamento
		const result = await cancelGameCompletion('comp-1', testDb);

		expect(result).not.toBeNull();
		expect(result?.pointsRemoved).toBe(75);
		expect(result?.teamName).toBe('Squadra Rossa');
		expect(result?.gameName).toBe('Tiro con Arco');

		// 1. Verifica che team_game_completions non contenga più il record
		const completions = await testDb.select().from(schema.teamGameCompletions);
		expect(completions).toHaveLength(0);

		// 2. Verifica che i punti del gioco siano stati stornati dalla squadra (150 - 75 = 75)
		const [team] = await testDb.select().from(schema.teams);
		expect(team.scoreCache).toBe(75);

		// 3. Verifica che le voci del ledger relative al gioco siano state rimosse
		const ledgerEntries = await testDb.select().from(schema.scoreLedger);
		expect(ledgerEntries).toHaveLength(1);
		expect(ledgerEntries[0].id).toBe('led-other');

		// 4. Verifica che sia stato inserito l'activity log
		const logs = await testDb.select().from(schema.activityLogs);
		expect(logs).toHaveLength(1);
		expect(logs[0].content).toContain('Tiro con Arco');
		expect(logs[0].content).toContain('Squadra Rossa');

		client.close();
	});
});
