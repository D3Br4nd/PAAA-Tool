import { inArray, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { db } from '$lib/server/db';
import {
    activityLogs,
    codexDecodeLog,
    eventTimers,
    factions,
    phaseFourProgress,
    phaseThreeScores,
    scoreLedger,
    teamChallengeCompletions,
    teamGameCompletions,
    teamGeoProgress,
    teamGeoSessions,
    teams
} from '$lib/server/schema';
import { ensurePhaseThreeSchema } from '$lib/server/phase-three';
import { ensurePhaseFourSchema } from '$lib/server/phase-four';

export async function resetEventScores(eventId: string): Promise<void> {
    await ensurePhaseThreeSchema();
    await ensurePhaseFourSchema();

    await db.transaction(async (tx) => {
        const eventFactionRows = await tx
            .select({ id: factions.id })
            .from(factions)
            .where(eq(factions.eventId, eventId));

        const eventFactionIds = eventFactionRows.map((faction) => faction.id);
        const eventTeamRows = eventFactionIds.length > 0
            ? await tx
                .select({ id: teams.id })
                .from(teams)
                .where(inArray(teams.factionId, eventFactionIds))
            : [];
        const eventTeamIds = eventTeamRows.map((team) => team.id);

        if (eventTeamIds.length > 0) {
			await tx.delete(teamGeoSessions).where(inArray(teamGeoSessions.teamId, eventTeamIds));
            await tx.delete(scoreLedger).where(inArray(scoreLedger.teamId, eventTeamIds));
            await tx.delete(teamChallengeCompletions).where(inArray(teamChallengeCompletions.teamId, eventTeamIds));
            await tx.delete(teamGameCompletions).where(inArray(teamGameCompletions.teamId, eventTeamIds));
            await tx.delete(teamGeoProgress).where(inArray(teamGeoProgress.teamId, eventTeamIds));
            await tx.delete(codexDecodeLog).where(inArray(codexDecodeLog.teamId, eventTeamIds));
            await tx.delete(phaseThreeScores).where(inArray(phaseThreeScores.teamId, eventTeamIds));
            await tx.delete(phaseFourProgress).where(inArray(phaseFourProgress.teamId, eventTeamIds));
            await tx
                .update(teams)
                .set({ scoreCache: 0, currentPhaseId: null })
                .where(inArray(teams.id, eventTeamIds));
        }

        await tx.delete(activityLogs).where(eq(activityLogs.eventId, eventId));
        await tx.delete(eventTimers).where(eq(eventTimers.eventId, eventId));
        await tx.insert(activityLogs).values({
            id: uuidv7(),
            eventId,
            type: 'system_reset',
            content: 'RESET TOTALE DEI PUNTEGGI ESEGUITO'
        });
    });
}
