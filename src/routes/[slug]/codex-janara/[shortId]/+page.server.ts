import { db } from '$lib/server/db';
import { events, codexJanaraPuzzles, factions, codexDecodeLog, scoreLedger, teams } from '$lib/server/schema';
import { error, fail, redirect } from '@sveltejs/kit';
import { eq, and, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { createDecipheriv, createHash } from 'node:crypto';
import { checkRateLimit } from '$lib/server/rate-limit';
import { uuidv7 } from 'uuidv7';
import { assertEventPhaseAccess } from '$lib/server/event-access';
import { ensureCodexSchema, deriveCodexKey, isValidCodexShortId } from '$lib/server/codex';
import { resolveCodexCandidate } from '$lib/server/codex-id';

async function resolvePuzzleId(shortId: string, eventId: string, locals: App.Locals) {
    const candidates = await db
        .select({ id: codexJanaraPuzzles.id, factionId: codexJanaraPuzzles.factionId })
        .from(codexJanaraPuzzles)
        .where(and(
            sql`${codexJanaraPuzzles.id} LIKE ${shortId + '%'}`,
            eq(codexJanaraPuzzles.eventId, eventId)
        ));

    let teamFactionId: string | null = null;
    if (candidates.length > 1 && locals.user?.role === 'player' && locals.user.teamId) {
        const [team] = await db
            .select({ factionId: teams.factionId })
            .from(teams)
            .where(eq(teams.id, locals.user.teamId))
            .limit(1);
        teamFactionId = team?.factionId ?? null;
    }

    const resolution = resolveCodexCandidate(candidates, shortId, teamFactionId);
    if (resolution.status === 'found') return resolution.candidate.id;
    if (resolution.status === 'forbidden') {
        throw error(403, 'Enigma non accessibile dalla tua fazione');
    }
    if (resolution.status === 'ambiguous') {
        throw error(409, 'Link Codex ambiguo: apri il Codex dalla PWA per usare il collegamento aggiornato');
    }
    throw error(404, 'Enigma non trovato');
}

export const load: PageServerLoad = async ({ params, locals }) => {
    const { slug, shortId } = params;
    await ensureCodexSchema();

    if (!locals.user) {
        throw redirect(302, `/login?redirectTo=/${slug}/codex-janara/${shortId}`);
    }

    const [event] = await db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);

    if (!event) {
        throw error(404, 'Evento non trovato');
    }

    if (!isValidCodexShortId(shortId)) {
        throw error(404, 'Enigma non trovato');
    }

    const puzzleId = await resolvePuzzleId(shortId, event.id, locals);

    const [puzzle] = await db
        .select({
            id: codexJanaraPuzzles.id,
            factionId: codexJanaraPuzzles.factionId,
            encryptedText: codexJanaraPuzzles.encryptedText,
            iv: codexJanaraPuzzles.iv,
            pointsOnDecode: codexJanaraPuzzles.pointsOnDecode
        })
        .from(codexJanaraPuzzles)
        .where(eq(codexJanaraPuzzles.id, puzzleId))
        .limit(1);

    if (!puzzle) {
        throw error(404, 'Enigma non trovato');
    }

    await assertEventPhaseAccess(locals, {
        eventId: event.id,
        factionId: puzzle.factionId
    });

    const [faction] = await db
        .select({
            id: factions.id,
            name: factions.name,
            color: factions.color,
            avatarUrl: factions.avatarUrl
        })
        .from(factions)
        .where(eq(factions.id, puzzle.factionId))
        .limit(1);

    return {
        event,
        puzzle,
        faction
    };
};

export const actions: Actions = {
    decrypt: async ({ request, params, locals, getClientAddress }) => {
        await ensureCodexSchema();
        const ip = getClientAddress();
        // Each attempt costs a 100k-iteration key derivation, so keep the
        // ceiling low enough that it can't be used to burn server CPU.
        const limit = checkRateLimit(`codex_decrypt_${ip}`, 15, 60 * 1000);
        if (!limit.success) {
            return fail(429, { error: 'Troppi tentativi. Riprova tra un minuto.', shortId: params.shortId });
        }

        const formData = await request.formData();
        const shortId = formData.get('shortId') as string;
        const keyword = formData.get('keyword') as string;

        if (!shortId || !keyword) {
            return fail(400, { error: 'Dati mancanti.', shortId });
        }

        if (!isValidCodexShortId(shortId)) {
            return fail(404, { error: 'Enigma non trovato.', shortId });
        }

        const [event] = await db
            .select()
            .from(events)
            .where(eq(events.slug, params.slug))
            .limit(1);

        if (!event) {
            return fail(404, { error: 'Evento non trovato.', shortId });
        }

        const puzzleId = await resolvePuzzleId(shortId, event.id, locals);

        const [puzzle] = await db
            .select()
            .from(codexJanaraPuzzles)
            .where(eq(codexJanaraPuzzles.id, puzzleId))
            .limit(1);

        if (!puzzle) {
            return fail(404, { error: 'Enigma non trovato.', shortId });
        }

        await assertEventPhaseAccess(locals, {
            eventId: event.id,
            factionId: puzzle.factionId
        });

        try {
            const key = await deriveCodexKey(keyword);
            const iv = Buffer.from(puzzle.iv, 'hex');

            const decipher = createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(puzzle.encryptedText, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            const attemptHash = createHash('sha256').update(decrypted).digest('hex');

            if (attemptHash !== puzzle.plaintextHash) {
                return fail(400, { error: 'Parola chiave errata (Hash mismatch).', shortId });
            }

            let pointsAwarded = 0;
            const teamId = locals.user?.teamId || null;

            // The decode-log row, the ledger entry and the score cache must
            // move together: a partial write would mark the puzzle solved
            // while silently awarding nothing.
            try {
                pointsAwarded = await db.transaction(async (tx) => {
                    const inserted = await tx.insert(codexDecodeLog).values({
                        id: uuidv7(),
                        puzzleId: puzzle.id,
                        teamId,
                        pointsAwarded: teamId ? puzzle.pointsOnDecode || 0 : 0,
                        ipHash: createHash('sha256').update(ip).digest('hex').substring(0, 16)
                    }).onConflictDoNothing().returning({ id: codexDecodeLog.id });

                    // Conflict = this team already decoded it. Not an error.
                    if (inserted.length === 0 || !teamId || puzzle.pointsOnDecode <= 0) {
                        return 0;
                    }

                    const points = puzzle.pointsOnDecode;
                    const now = new Date();
                    await tx.insert(scoreLedger).values({
                        id: uuidv7(),
                        teamId,
                        eventType: 'base',
                        points,
                        description: `Codex Janara: enigma decodificato`,
                        metadata: {
                            source: 'codex_janara',
                            puzzleId: puzzle.id,
                            factionId: puzzle.factionId
                        },
                        syncStatus: 'synced',
                        createdAt: now
                    });
                    await tx.update(teams).set({
                        scoreCache: sql`score_cache + ${points}`,
                        updatedAt: now
                    }).where(eq(teams.id, teamId));

                    return points;
                });
            } catch (e) {
                // The keyword was correct, so still reveal the plaintext, but
                // never pretend points were awarded when the write failed.
                console.error('[codex] scoring failed for puzzle', puzzle.id, e);
                pointsAwarded = 0;
            }

            return { success: true, plaintext: decrypted, shortId, pointsAwarded };

        } catch (e) {
            return fail(400, { error: 'Parola chiave errata.', shortId });
        }
    }
};
