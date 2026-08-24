import { db } from "$lib/server/db";
import { ensurePhaseThreeSchema } from "$lib/server/phase-three";
import { events, factions, phaseThreeScores, teams } from "$lib/server/schema";
import { error } from "@sveltejs/kit";
import { desc, eq } from "drizzle-orm";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  await ensurePhaseThreeSchema();

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.slug, params.slug))
    .limit(1);

  if (!event || !event.isActive) {
    throw error(404, "Evento non trovato o non attivo");
  }

  const rows = await db
    .select({
      id: phaseThreeScores.id,
      teamId: phaseThreeScores.teamId,
      teamName: teams.name,
      teamAvatarUrl: teams.avatarUrl,
      factionName: factions.name,
      factionColor: factions.color,
      score: phaseThreeScores.score,
      updatedAt: phaseThreeScores.updatedAt,
    })
    .from(phaseThreeScores)
    .innerJoin(teams, eq(phaseThreeScores.teamId, teams.id))
    .innerJoin(factions, eq(teams.factionId, factions.id))
    .where(eq(phaseThreeScores.eventId, event.id))
    .orderBy(desc(phaseThreeScores.score), teams.name);

  const topScore = rows[0]?.score || 0;

  return {
    event,
    leaderboard: rows.map((row, index) => ({
      ...row,
      rank: index + 1,
      scoreLevel: topScore > 0 ? Math.round((row.score / topScore) * 100) : 0,
      isLeader: topScore > 0 && row.score === topScore,
    })),
    stats: {
      totalTeams: rows.length,
      topScore,
      leaders:
        topScore > 0 ? rows.filter((row) => row.score === topScore).length : 0,
    },
  };
};
