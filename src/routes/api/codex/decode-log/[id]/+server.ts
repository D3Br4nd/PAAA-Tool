import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { codexDecodeLog, scoreLedger, teams } from '$lib/server/schema';
import { and, eq, sql } from 'drizzle-orm';
import { ensureCodexSchema } from '$lib/server/codex';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, { message: 'Admin access required' });
	}
	await ensureCodexSchema();

	const [log] = await db.select().from(codexDecodeLog).where(eq(codexDecodeLog.id, params.id)).limit(1);
	if (!log) return new Response(null, { status: 204 });

	const ledgerEntries = log.teamId
		? await db
				.select({ id: scoreLedger.id, points: scoreLedger.points })
				.from(scoreLedger)
				.where(
					and(
						eq(scoreLedger.teamId, log.teamId),
						sql`json_extract(${scoreLedger.metadata}, '$.source') = 'codex_janara'`,
						sql`json_extract(${scoreLedger.metadata}, '$.puzzleId') = ${log.puzzleId}`
					)
				)
		: [];
	const pointsToRemove = ledgerEntries.reduce((sum, entry) => sum + entry.points, 0);

	await db.transaction(async (tx) => {
		if (ledgerEntries.length > 0) {
			await tx
				.delete(scoreLedger)
				.where(sql`${scoreLedger.id} IN (${sql.join(ledgerEntries.map((entry) => sql`${entry.id}`), sql`, `)})`);
		}
		if (log.teamId && pointsToRemove !== 0) {
			await tx
				.update(teams)
				.set({ scoreCache: sql`score_cache - ${pointsToRemove}`, updatedAt: new Date() })
				.where(eq(teams.id, log.teamId));
		}
		await tx.delete(codexDecodeLog).where(eq(codexDecodeLog.id, params.id));
	});

	return new Response(null, { status: 204 });
};
