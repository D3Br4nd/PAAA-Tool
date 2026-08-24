import { relations, sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * PAAA-Tool Schema (Treasure Hunt Evolution)
 * IDs: UUIDv7 stored as TEXT
 * Timestamps: epoch milliseconds (INTEGER) or ISO string (TEXT). 
 * Here we use INTEGER (timestamp_ms) for consistency.
 */

// --- Roles ---
export const userRoles = ['admin', 'staff', 'player'] as const;
export type UserRole = (typeof userRoles)[number];

import { type ScoringType, type ScoreEventType, type StepScoringRule, type ChallengeConfig, scoringTypes, scoreEventTypes } from '../scoring-types';
export { type ScoringType, type ScoreEventType, type StepScoringRule, type ChallengeConfig, scoringTypes, scoreEventTypes };

// --- Events (CaTE Module) ---
export const events = sqliteTable(
	'events',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
		eventType: text('event_type').notNull().default('cate'), // 'cate', 'mmp', 'ere', 'other'
		classification: text('classification'), // Custom description for 'other'
		description: text('description'), // Public event description
		logoUrl: text('logo_url'), // Public event logo URL
		startDate: integer('start_date', { mode: 'timestamp_ms' }), // Event start date
		endDate: integer('end_date', { mode: 'timestamp_ms' }), // Event end date
		themeConfig: text('theme_config', { mode: 'json' }).$type<Record<string, unknown>>(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		slugUq: uniqueIndex('events_slug_uq').on(t.slug)
	})
);

// --- Users (must be defined before faction_managers, as it references users) ---
export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		email: text('email'), // Nullable for players
		username: text('username'), // Individual login name, primarily for players
		passwordHash: text('password_hash'), // Nullable for players (they use joinCode)
		name: text('name'), // Display name
		avatarUrl: text('avatar_url'), // Public URL like /api/avatars/filename.png
		role: text('role', { enum: userRoles }).notNull(),
		teamId: text('team_id').references(() => teams.id, { onDelete: 'set null', onUpdate: 'cascade' }), // FK to teams
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		emailUq: uniqueIndex('users_email_uq').on(t.email),
		usernameUq: uniqueIndex('users_username_uq').on(t.username),
		teamIdx: index('users_team_idx').on(t.teamId)
	})
);

// --- Factions (CaTE Module) ---
// Note: manager_id should reference a user with role 'staff' (enforced at application level)
export const factions = sqliteTable(
	'factions',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'),
		icon: text('icon'),
		avatarUrl: text('avatar_url'),
		description: text('description'),
		factionType: text('faction_type'), // Tipo fazione (e.g. Precettoria, Contrada, etc.)
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		eventIdx: index('factions_event_idx').on(t.eventId)
	})
);

// --- Faction Managers (N:N junction table) ---
export const factionManagers = sqliteTable(
	'faction_managers',
	{
		factionId: text('faction_id')
			.notNull()
			.references(() => factions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		assignedAt: integer('assigned_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		pk: primaryKey({ columns: [t.factionId, t.userId] }),
		factionIdx: index('faction_managers_faction_idx').on(t.factionId),
		userIdx: index('faction_managers_user_idx').on(t.userId)
	})
);

// --- Teams ---
export const teams = sqliteTable(
	'teams',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		joinCode: text('join_code').notNull(),
		scoreCache: integer('score_cache').notNull().default(0),
		color: text('color').notNull().default('#3b82f6'),
		avatarUrl: text('avatar_url'),
		description: text('description'),
		currentPhaseId: text('current_phase_id').references(() => phases.id, { onDelete: 'set null', onUpdate: 'cascade' }), // FK to phases.id
		factionId: text('faction_id').references(() => factions.id, {
			onDelete: 'set null',
			onUpdate: 'cascade'
		}),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		joinCodeUq: uniqueIndex('teams_join_code_uq').on(t.joinCode),
		factionIdx: index('teams_faction_idx').on(t.factionId)
	})
);

// --- Macro-Phases ---
export const macroPhases = sqliteTable('macro_phases', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	name: text('name').notNull(),
	status: text('status', { enum: ['active', 'inactive'] })
		.notNull()
		.default('inactive'),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('macro_phases_event_idx').on(t.eventId)
}));

// --- Phases ---
export const phases = sqliteTable('phases', {
	id: text('id').primaryKey(),
	macroPhaseId: text('macro_phase_id')
		.references(() => macroPhases.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	name: text('name').notNull(),
	status: text('status', { enum: ['active', 'inactive'] })
		.notNull()
		.default('inactive'),
	sortOrder: integer('sort_order').notNull().default(0)
}, (t) => ({
	macroPhaseIdx: index('phases_macro_phase_idx').on(t.macroPhaseId)
}));

// --- Event Timers ---
// Shared timer for a macro-phase or event
export const eventTimers = sqliteTable('event_timers', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	macroPhaseId: text('macro_phase_id')
		.references(() => macroPhases.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	startTime: integer('start_time', { mode: 'timestamp_ms' }),
	accumulatedTime: integer('accumulated_time').notNull().default(0), // Total elapsed ms before current run
	isRunning: integer('is_running', { mode: 'boolean' }).notNull().default(false),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('event_timers_event_idx').on(t.eventId),
	macroPhaseIdx: index('event_timers_macro_phase_idx').on(t.macroPhaseId)
}));

// --- Messages ---
export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		senderId: text('sender_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		recipientId: text('recipient_id')
			.references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		recipientTeamId: text('recipient_team_id')
			.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
		content: text('content').notNull(),
		attachmentUrl: text('attachment_url'),
		attachmentName: text('attachment_name'),
		isBroadcast: integer('is_broadcast', { mode: 'boolean' }).notNull().default(false),
		isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
		sentAt: integer('sent_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(t) => ({
		senderIdx: index('messages_sender_idx').on(t.senderId),
		recipientIdx: index('messages_recipient_idx').on(t.recipientId),
		recipientTeamIdx: index('messages_recipient_team_idx').on(t.recipientTeamId)
	})
);

// --- Activity Logs ---
export const activityLogs = sqliteTable('activity_logs', {
	id: text('id').primaryKey(),
	eventId: text('event_id').references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	type: text('type').notNull(), // 'score_update', 'phase_change', 'message_sent', 'team_created', etc.
	content: text('content').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
});

// --- Login Access Audit ---
// Security-focused authentication history. This intentionally records login
// events only (not every page view) and never stores passwords or join codes.
export const loginAccessAreas = ['admin', 'player'] as const;
export const loginAccessMethods = ['password', 'join_code', 'unknown'] as const;
export const loginAccessOutcomes = ['success', 'failure', 'blocked'] as const;

export const loginAccessLogs = sqliteTable('login_access_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	teamId: text('team_id').references(() => teams.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	area: text('area', { enum: loginAccessAreas }).notNull(),
	method: text('method', { enum: loginAccessMethods }).notNull(),
	outcome: text('outcome', { enum: loginAccessOutcomes }).notNull(),
	reason: text('reason'),
	subject: text('subject'),
	ipAddress: text('ip_address').notNull(),
	userAgent: text('user_agent'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	createdAtIdx: index('login_access_logs_created_at_idx').on(t.createdAt),
	outcomeCreatedAtIdx: index('login_access_logs_outcome_created_at_idx').on(t.outcome, t.createdAt),
	ipCreatedAtIdx: index('login_access_logs_ip_created_at_idx').on(t.ipAddress, t.createdAt),
	userIdx: index('login_access_logs_user_idx').on(t.userId),
	teamIdx: index('login_access_logs_team_idx').on(t.teamId)
}));

// --- Team Hints ---
export const teamHints = sqliteTable('team_hints', {
	id: text('id').primaryKey(),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade' }),
	maxHints: integer('max_hints').notNull().default(3),
	usedHints: integer('used_hints').notNull().default(0)
});

// --- Config ---
export const config = sqliteTable('config', {
	key: text('key').primaryKey(),
	value: text('value').notNull() // Store as JSON string or text
});

// --- Challenges (Scoring System) ---
// Defines challenge/path types with scoring configuration
export const challenges = sqliteTable('challenges', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	phaseId: text('phase_id')
		.references(() => phases.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	challengeType: text('challenge_type', { enum: ['program', 'game'] })
		.notNull()
		.default('program'),                // 'program' = Scriba/Architetto/Cavaliere with phases, 'game' = standalone timed events
	code: text('code').notNull(),           // e.g., 'CAVALIERE', 'ARCHITETTO', 'SCRIBA', 'GIOSTRA'
	name: text('name').notNull(),           // Display name
	description: text('description'),
	scoringType: text('scoring_type', { enum: scoringTypes }).notNull(),
	basePoints: integer('base_points').notNull().default(0),
	maxPoints: integer('max_points'),       // Theoretical maximum for display
	// Legacy column kept for database compatibility; ranking bonuses are disabled.
	hasRankingBonus: integer('has_ranking_bonus', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	config: text('config', { mode: 'json' }).$type<ChallengeConfig>(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('challenges_event_idx').on(t.eventId),
	codeIdx: index('challenges_code_idx').on(t.code)
}));

// --- Games (standalone scoring activities) ---
// Games are intentionally separate from program challenges: they are event-level
// activities and never belong to a phase.
export const games = sqliteTable('games', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	code: text('code').notNull(),
	name: text('name').notNull(),
	description: text('description'),
	scoringType: text('scoring_type', { enum: scoringTypes }).notNull(),
	basePoints: integer('base_points').notNull().default(0),
	maxPoints: integer('max_points'),
	// Legacy column kept for database compatibility; ranking bonuses are disabled.
	hasRankingBonus: integer('has_ranking_bonus', { mode: 'boolean' }).notNull().default(false),
	sortOrder: integer('sort_order').notNull().default(0),
	config: text('config', { mode: 'json' }).$type<ChallengeConfig>(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('games_event_idx').on(t.eventId),
	codeIdx: index('games_code_idx').on(t.code)
}));

// --- Challenge Steps ---
// For multi-step challenges like Scriba (3 steps)
export const challengeSteps = sqliteTable('challenge_steps', {
	id: text('id').primaryKey(),
	challengeId: text('challenge_id')
		.notNull()
		.references(() => challenges.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	code: text('code').notNull(),           // e.g., 'ENIGMA', 'MOSAICO', 'CUSTODE'
	name: text('name').notNull(),
	stepOrder: integer('step_order').notNull().default(0),
	scoringRules: text('scoring_rules', { mode: 'json' }).$type<StepScoringRule[]>(),
	penaltyPoints: integer('penalty_points').notNull().default(0),  // Applied on all attempts fail
	isBlocking: integer('is_blocking', { mode: 'boolean' }).notNull().default(false)
}, (t) => ({
	challengeIdx: index('challenge_steps_challenge_idx').on(t.challengeId)
}));

export const gameSteps = sqliteTable('game_steps', {
	id: text('id').primaryKey(),
	gameId: text('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	code: text('code').notNull(),
	name: text('name').notNull(),
	stepOrder: integer('step_order').notNull().default(0),
	scoringRules: text('scoring_rules', { mode: 'json' }).$type<StepScoringRule[]>(),
	penaltyPoints: integer('penalty_points').notNull().default(0),
	isBlocking: integer('is_blocking', { mode: 'boolean' }).notNull().default(false)
}, (t) => ({
	gameIdx: index('game_steps_game_idx').on(t.gameId)
}));

// --- Team Challenge Completions ---
// Tracks when teams complete challenges.
export const teamChallengeCompletions = sqliteTable('team_challenge_completions', {
	id: text('id').primaryKey(),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	challengeId: text('challenge_id')
		.notNull()
		.references(() => challenges.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	completedAt: integer('completed_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	arrivalRank: integer('arrival_rank'), // Legacy field kept for existing completion records
	totalPoints: integer('total_points').notNull().default(0),
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	teamChallengeUnique: uniqueIndex('tcc_team_challenge_uq').on(t.teamId, t.challengeId),
	teamIdx: index('tcc_team_idx').on(t.teamId),
	challengeIdx: index('tcc_challenge_idx').on(t.challengeId)
}));

export const teamGameCompletions = sqliteTable('team_game_completions', {
	id: text('id').primaryKey(),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	gameId: text('game_id')
		.notNull()
		.references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	completedAt: integer('completed_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	arrivalRank: integer('arrival_rank'), // Legacy field kept for existing completion records
	totalPoints: integer('total_points').notNull().default(0),
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	teamGameUnique: uniqueIndex('tgc_team_game_uq').on(t.teamId, t.gameId),
	teamIdx: index('tgc_team_idx').on(t.teamId),
	gameIdx: index('tgc_game_idx').on(t.gameId)
}));

export const phaseFourProgress = sqliteTable('phase_four_progress', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	percent: integer('percent').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('phase_four_progress_event_idx').on(t.eventId),
	teamIdx: index('phase_four_progress_team_idx').on(t.teamId),
	eventTeamUnique: uniqueIndex('phase_four_progress_event_team_uq').on(t.eventId, t.teamId)
}));

export const phaseThreeScores = sqliteTable('phase_three_scores', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	score: integer('score').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('phase_three_scores_event_idx').on(t.eventId),
	teamIdx: index('phase_three_scores_team_idx').on(t.teamId),
	eventTeamUnique: uniqueIndex('phase_three_scores_event_team_uq').on(t.eventId, t.teamId)
}));

// --- Score Ledger ---
// Immutable event-sourced score log (supports offline sync)
export const scoreLedger = sqliteTable('score_ledger', {
	id: text('id').primaryKey(),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	challengeId: text('challenge_id')
		.references(() => challenges.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	gameId: text('game_id')
		.references(() => games.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	stepId: text('step_id')
		.references(() => challengeSteps.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	gameStepId: text('game_step_id')
		.references(() => gameSteps.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	eventType: text('event_type', { enum: scoreEventTypes }).notNull(),
	points: integer('points').notNull(),    // Can be negative for penalties
	description: text('description'),
	metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),
	judgeUserId: text('judge_user_id')
		.references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
	syncStatus: text('sync_status', { enum: ['pending', 'synced'] }).notNull().default('pending'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	teamIdx: index('score_ledger_team_idx').on(t.teamId),
	challengeIdx: index('score_ledger_challenge_idx').on(t.challengeId),
	gameIdx: index('score_ledger_game_idx').on(t.gameId),
	syncIdx: index('score_ledger_sync_idx').on(t.syncStatus)
}));

// --- Codex Janara Puzzles ---
export const codexJanaraPuzzles = sqliteTable('codex_janara_puzzles', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	factionId: text('faction_id')
		.notNull()
		.references(() => factions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	encryptedText: text('encrypted_text').notNull(),
	iv: text('iv').notNull(),
	plaintextHash: text('plaintext_hash').notNull(), // SHA-256 hash for verification
	plaintext: text('plaintext'), // Stored for admin editing purposes
	keyword: text('keyword'),     // Stored for admin editing purposes
	pointsOnDecode: integer('points_on_decode').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('codex_puzzles_event_idx').on(t.eventId),
	factionIdx: index('codex_puzzles_faction_idx').on(t.factionId)
}));

// --- Relations ---

// Events relations (CaTE Module)
export const eventsRelations = relations(events, ({ many }) => ({
	factions: many(factions),
	challenges: many(challenges),
	games: many(games),
	macroPhases: many(macroPhases),
	eventTimers: many(eventTimers)
}));

// Factions relations (CaTE Module)
export const factionsRelations = relations(factions, ({ one, many }) => ({
	event: one(events, {
		fields: [factions.eventId],
		references: [events.id]
	}),
	managers: many(factionManagers),
	teams: many(teams)
}));

export const factionManagersRelations = relations(factionManagers, ({ one }) => ({
	faction: one(factions, {
		fields: [factionManagers.factionId],
		references: [factions.id]
	}),
	user: one(users, {
		fields: [factionManagers.userId],
		references: [users.id]
	})
}));

export const teamsRelations = relations(teams, ({ many, one }) => ({
	members: many(users),
	currentPhase: one(phases, {
		fields: [teams.currentPhaseId],
		references: [phases.id]
	}),
	hints: one(teamHints, {
		fields: [teams.id],
		references: [teamHints.teamId]
	}),
	faction: one(factions, {
		fields: [teams.factionId],
		references: [factions.id]
	}),
	challengeCompletions: many(teamChallengeCompletions),
	gameCompletions: many(teamGameCompletions),
	scoreEntries: many(scoreLedger)
}));

export const usersRelations = relations(users, ({ one, many }) => ({
	team: one(teams, {
		fields: [users.teamId],
		references: [teams.id]
	}),
	managedFactions: many(factionManagers), // Factions where this user is one of the managers
	sentMessages: many(messages, { relationName: 'sent' }),
	receivedMessages: many(messages, { relationName: 'received' })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	sender: one(users, {
		fields: [messages.senderId],
		references: [users.id],
		relationName: 'sent'
	}),
	recipient: one(users, {
		fields: [messages.recipientId],
		references: [users.id],
		relationName: 'received'
	}),
	recipientTeam: one(teams, {
		fields: [messages.recipientTeamId],
		references: [teams.id]
	})
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
	event: one(events, {
		fields: [activityLogs.eventId],
		references: [events.id]
	}),
	team: one(teams, {
		fields: [activityLogs.teamId],
		references: [teams.id]
	})
}));

// --- Scoring System Relations ---

export const challengesRelations = relations(challenges, ({ one, many }) => ({
	event: one(events, {
		fields: [challenges.eventId],
		references: [events.id]
	}),
	phase: one(phases, {
		fields: [challenges.phaseId],
		references: [phases.id]
	}),
	steps: many(challengeSteps),
	completions: many(teamChallengeCompletions),
	scoreEntries: many(scoreLedger)
}));

export const challengeStepsRelations = relations(challengeSteps, ({ one, many }) => ({
	challenge: one(challenges, {
		fields: [challengeSteps.challengeId],
		references: [challenges.id]
	}),
	scoreEntries: many(scoreLedger)
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
	event: one(events, {
		fields: [games.eventId],
		references: [events.id]
	}),
	steps: many(gameSteps),
	completions: many(teamGameCompletions),
	scoreEntries: many(scoreLedger)
}));

export const gameStepsRelations = relations(gameSteps, ({ one, many }) => ({
	game: one(games, {
		fields: [gameSteps.gameId],
		references: [games.id]
	}),
	scoreEntries: many(scoreLedger)
}));

export const teamChallengeCompletionsRelations = relations(teamChallengeCompletions, ({ one }) => ({
	team: one(teams, {
		fields: [teamChallengeCompletions.teamId],
		references: [teams.id]
	}),
	challenge: one(challenges, {
		fields: [teamChallengeCompletions.challengeId],
		references: [challenges.id]
	})
}));

export const teamGameCompletionsRelations = relations(teamGameCompletions, ({ one }) => ({
	team: one(teams, {
		fields: [teamGameCompletions.teamId],
		references: [teams.id]
	}),
	game: one(games, {
		fields: [teamGameCompletions.gameId],
		references: [games.id]
	})
}));

export const scoreLedgerRelations = relations(scoreLedger, ({ one }) => ({
	team: one(teams, {
		fields: [scoreLedger.teamId],
		references: [teams.id]
	}),
	challenge: one(challenges, {
		fields: [scoreLedger.challengeId],
		references: [challenges.id]
	}),
	game: one(games, {
		fields: [scoreLedger.gameId],
		references: [games.id]
	}),
	step: one(challengeSteps, {
		fields: [scoreLedger.stepId],
		references: [challengeSteps.id]
	}),
	gameStep: one(gameSteps, {
		fields: [scoreLedger.gameStepId],
		references: [gameSteps.id]
	}),
	judge: one(users, {
		fields: [scoreLedger.judgeUserId],
		references: [users.id]
	})
}));

export const macroPhasesRelations = relations(macroPhases, ({ one, many }) => ({
	event: one(events, {
		fields: [macroPhases.eventId],
		references: [events.id]
	}),
	phases: many(phases),
	timer: one(eventTimers, {
		fields: [macroPhases.id],
		references: [eventTimers.macroPhaseId]
	})
}));

export const phasesRelations = relations(phases, ({ one }) => ({
	macroPhase: one(macroPhases, {
		fields: [phases.macroPhaseId],
		references: [macroPhases.id]
	})
}));

export const eventTimersRelations = relations(eventTimers, ({ one }) => ({
	event: one(events, {
		fields: [eventTimers.eventId],
		references: [events.id]
	}),
	macroPhase: one(macroPhases, {
		fields: [eventTimers.macroPhaseId],
		references: [macroPhases.id]
	})
}));

export const codexJanaraPuzzlesRelations = relations(codexJanaraPuzzles, ({ one }) => ({
	event: one(events, {
		fields: [codexJanaraPuzzles.eventId],
		references: [events.id]
	}),
	faction: one(factions, {
		fields: [codexJanaraPuzzles.factionId],
		references: [factions.id]
	})
}));

// --- Codex Janara Decode Log ---
// Tracks first-time decodings of puzzles
export const codexDecodeLog = sqliteTable('codex_decode_log', {
	id: text('id').primaryKey(),
	puzzleId: text('puzzle_id')
		.notNull()
		.references(() => codexJanaraPuzzles.id, { onDelete: 'cascade' }),
	teamId: text('team_id')
		.references(() => teams.id, { onDelete: 'cascade' }),
	decodedAt: integer('decoded_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	pointsAwarded: integer('points_awarded').notNull().default(0),
	ipHash: text('ip_hash') // Hash of IP for optional debugging
}, (t) => ({
	puzzleTeamUnique: uniqueIndex('codex_decode_puzzle_team_uq').on(t.puzzleId, t.teamId)
}));

export const codexDecodeLogRelations = relations(codexDecodeLog, ({ one }) => ({
	puzzle: one(codexJanaraPuzzles, {
		fields: [codexDecodeLog.puzzleId],
		references: [codexJanaraPuzzles.id]
	})
}));

// --- Event Draws (Sorteggio) ---
export const eventDraws = sqliteTable('event_draws', {
	id: text('id').primaryKey(),
	eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
	title: text('title'), // Custom title for this draw (e.g., "Tiro alla Fune")
	pairs: text('pairs', { mode: 'json' }).$type<Array<{ team1Id: string; team2Id: string }>>().notNull(),
	oddTeamId: text('odd_team_id'),
	pairedTeamId: text('paired_team_id'), // Team that accepted pairing with odd team
	declinedTeamIds: text('declined_team_ids', { mode: 'json' }).$type<string[]>().default([]),
	drawOrder: text('draw_order', { mode: 'json' }).$type<string[]>().notNull(), // Order of extraction for reselection
	status: text('status').notNull().default('in_progress'), // 'in_progress', 'revealing', 'complete'
	revealIndex: integer('reveal_index').notNull().default(-1), // Current reveal index, -1 = not started
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('event_draws_event_idx').on(t.eventId)
}));

export const eventDrawsRelations = relations(eventDraws, ({ one }) => ({
	event: one(events, {
		fields: [eventDraws.eventId],
		references: [events.id]
	})
}));

// --- GeoPhase: Geo Hunts ---
// A geo hunt is a collection of ordered waypoints associated to an event.
export const geoHunts = sqliteTable('geo_hunts', {
	id: text('id').primaryKey(),
	eventId: text('event_id')
		.notNull()
		.references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	factionId: text('faction_id')
		.references(() => factions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	challengeDisclaimerText: text('challenge_disclaimer_text'),
	deadlineAt: integer('deadline_at', { mode: 'timestamp_ms' }),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	eventIdx: index('geo_hunts_event_idx').on(t.eventId),
	factionIdx: index('geo_hunts_faction_idx').on(t.factionId)
}));

// --- GeoPhase: Geo Waypoints ---
// GeoPhase steps are ordered modules: GPS search, photo upload, or quiz.
export const geoWaypointChallengeTypes = ['gps', 'photo', 'quiz'] as const;
export type GeoWaypointChallengeType = (typeof geoWaypointChallengeTypes)[number];

export const geoWaypoints = sqliteTable('geo_waypoints', {
	id: text('id').primaryKey(),
	huntId: text('hunt_id')
		.notNull()
		.references(() => geoHunts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	adminName: text('admin_name'),
	name: text('name').notNull(),
	lat: text('lat').notNull(),       // normalized decimal text, validated at API boundaries
	lng: text('lng').notNull(),
	radiusMeters: integer('radius_meters').notNull().default(20),
	sortOrder: integer('sort_order').notNull().default(0),
	challengeType: text('challenge_type', { enum: geoWaypointChallengeTypes }).notNull().default('photo'),
	// Content shown on arrival (for both types)
	enigmaText: text('enigma_text'),
	// Quiz-specific fields
	quizQuestion: text('quiz_question'),
	quizOptions: text('quiz_options'),             // JSON array containing 3-5 answer labels
	quizAnswer: text('quiz_answer'),           // stored in plain text, compared case-insensitively server-side
	quizTimeLimitSeconds: integer('quiz_time_limit_seconds').notNull().default(60),
	// Disclaimer shown before challenge starts (if set, player must confirm before timer begins)
	challengeDisclaimerText: text('challenge_disclaimer_text'),
	// Scoring
	pointsOnArrival: integer('points_on_arrival').notNull().default(0),
	pointsOnSuccess: integer('points_on_success').notNull().default(100),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	huntIdx: index('geo_waypoints_hunt_idx').on(t.huntId),
	orderIdx: index('geo_waypoints_order_idx').on(t.huntId, t.sortOrder)
}));

// --- GeoPhase: Team Geo Progress ---
// Tracks each team's progress through waypoints.
export const geoProgressStatuses = ['navigating', 'arrived', 'challenge_active', 'photo_submitted', 'quiz_answered', 'completed', 'failed'] as const;
export type GeoProgressStatus = (typeof geoProgressStatuses)[number];

export const teamGeoProgress = sqliteTable('team_geo_progress', {
	id: text('id').primaryKey(),
	teamId: text('team_id')
		.notNull()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	waypointId: text('waypoint_id')
		.notNull()
		.references(() => geoWaypoints.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	huntId: text('hunt_id')
		.notNull()
		.references(() => geoHunts.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	status: text('status', { enum: geoProgressStatuses }).notNull().default('navigating'),
	arrivedAt: integer('arrived_at', { mode: 'timestamp_ms' }),
	// challengeStartedAt is set SERVER-SIDE when the challenge starts.
	challengeStartedAt: integer('challenge_started_at', { mode: 'timestamp_ms' }),
	completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
	// Photo challenge
	photoPath: text('photo_path'),         // Relative path: geohunt_photos/{teamId}/{uuid}.jpg
	// Quiz challenge
	quizAnswerGiven: text('quiz_answer_given'),
	isCorrect: integer('is_correct', { mode: 'boolean' }),
	pointsEarned: integer('points_earned').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch() * 1000)`)
}, (t) => ({
	teamWaypointUq: uniqueIndex('tgp_team_waypoint_uq').on(t.teamId, t.waypointId),
	teamIdx: index('tgp_team_idx').on(t.teamId),
	huntIdx: index('tgp_hunt_idx').on(t.huntId),
	statusIdx: index('tgp_status_idx').on(t.status)
}));

// Exclusive, expiring ownership of a team's live GeoPhase session.
export const teamGeoSessions = sqliteTable('team_geo_sessions', {
	teamId: text('team_id')
		.primaryKey()
		.references(() => teams.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	userId: text('user_id')
		.references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
	sessionId: text('session_id').notNull(),
	acquiredAt: integer('acquired_at', { mode: 'timestamp_ms' }).notNull(),
	lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }).notNull()
}, (t) => ({
	lastSeenIdx: index('team_geo_sessions_last_seen_idx').on(t.lastSeenAt)
}));

// --- GeoPhase Relations ---
export const geoHuntsRelations = relations(geoHunts, ({ one, many }) => ({
	event: one(events, {
		fields: [geoHunts.eventId],
		references: [events.id]
	}),
	faction: one(factions, {
		fields: [geoHunts.factionId],
		references: [factions.id]
	}),
	waypoints: many(geoWaypoints),
	progress: many(teamGeoProgress)
}));


export const geoWaypointsRelations = relations(geoWaypoints, ({ one, many }) => ({
	hunt: one(geoHunts, {
		fields: [geoWaypoints.huntId],
		references: [geoHunts.id]
	}),
	progress: many(teamGeoProgress)
}));

export const teamGeoProgressRelations = relations(teamGeoProgress, ({ one }) => ({
	team: one(teams, {
		fields: [teamGeoProgress.teamId],
		references: [teams.id]
	}),
	waypoint: one(geoWaypoints, {
		fields: [teamGeoProgress.waypointId],
		references: [geoWaypoints.id]
	}),
	hunt: one(geoHunts, {
		fields: [teamGeoProgress.huntId],
		references: [geoHunts.id]
	})
}));
