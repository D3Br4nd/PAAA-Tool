import { db } from '$lib/server/db';
import { events, factions, phaseFourProgress, teams } from '$lib/server/schema';
import { ensurePhaseFourSchema } from '$lib/server/phase-four';
import { error } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	await ensurePhaseFourSchema();

	const [event] = await db
		.select()
		.from(events)
		.where(eq(events.slug, params.slug))
		.limit(1);

	if (!event || !event.isActive) {
		throw error(404, 'Evento non trovato o non attivo');
	}

	const rows = await db
		.select({
			id: phaseFourProgress.id,
			teamId: phaseFourProgress.teamId,
			teamName: teams.name,
			teamAvatarUrl: teams.avatarUrl,
			factionName: factions.name,
			factionColor: factions.color,
			percent: phaseFourProgress.percent,
			updatedAt: phaseFourProgress.updatedAt
		})
		.from(phaseFourProgress)
		.innerJoin(teams, eq(phaseFourProgress.teamId, teams.id))
		.innerJoin(factions, eq(teams.factionId, factions.id))
		.where(eq(phaseFourProgress.eventId, event.id))
		.orderBy(desc(phaseFourProgress.percent), teams.name);

	return {
		event,
		leaderboard: rows.map((row, index) => ({
			...row,
			rank: index + 1,
			foundTreasure: row.percent >= 100
		})),
		stats: {
			totalTeams: rows.length,
			foundTreasure: rows.filter((row) => row.percent >= 100).length,
			bestPercent: rows[0]?.percent || 0
		}
	};
};
