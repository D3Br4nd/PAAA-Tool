import type { Actions, PageServerLoad } from "./$types";
import { ensureAdmin } from "$lib/server/auth";
import { db } from "$lib/server/db";
import { loginAccessLogs } from "$lib/server/schema";
import { ensureLoginAccessSchema } from "$lib/server/login-access-audit";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

const PERIODS = new Set([1, 7, 30]);
const OUTCOMES = new Set(["all", "success", "denied"]);

export const actions: Actions = {
  clearLogs: async ({ locals }) => {
    ensureAdmin(locals);
    await ensureLoginAccessSchema();

    const [totalRow] = await db.select({ value: count() }).from(loginAccessLogs);
    const clearedCount = Number(totalRow?.value ?? 0);
    await db.delete(loginAccessLogs);

    return { logsCleared: true, clearedCount };
  },
};

export const load: PageServerLoad = async ({ locals, url, setHeaders }) => {
  ensureAdmin(locals);
  await ensureLoginAccessSchema();
  setHeaders({ "Cache-Control": "private, no-store" });

  const requestedDays = Number(url.searchParams.get("days"));
  const days = PERIODS.has(requestedDays) ? requestedDays : 7;
  const requestedOutcome = url.searchParams.get("outcome") ?? "all";
  const outcome = OUTCOMES.has(requestedOutcome) ? requestedOutcome : "all";
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const periodCondition = gte(loginAccessLogs.createdAt, since);
  const deniedCondition = inArray(loginAccessLogs.outcome, [
    "failure",
    "blocked",
  ]);
  const outcomeCondition =
    outcome === "success"
      ? eq(loginAccessLogs.outcome, "success")
      : outcome === "denied"
        ? deniedCondition
        : undefined;

  const [summaryRows, sourceRows, entries, filteredCountRows] =
    await Promise.all([
      db
        .select({
          total: count(),
          successful: sql<number>`sum(case when ${loginAccessLogs.outcome} = 'success' then 1 else 0 end)`,
          failed: sql<number>`sum(case when ${loginAccessLogs.outcome} = 'failure' then 1 else 0 end)`,
          blocked: sql<number>`sum(case when ${loginAccessLogs.outcome} = 'blocked' then 1 else 0 end)`,
          uniqueIps: sql<number>`count(distinct ${loginAccessLogs.ipAddress})`,
        })
        .from(loginAccessLogs)
        .where(periodCondition),
      db
        .select({
          ipAddress: loginAccessLogs.ipAddress,
          denied: count(),
          lastAttemptAt: sql<number>`max(${loginAccessLogs.createdAt})`,
        })
        .from(loginAccessLogs)
        .where(and(periodCondition, deniedCondition))
        .groupBy(loginAccessLogs.ipAddress)
        .having(sql`count(*) >= 3`)
        .orderBy(desc(count())),
      db
        .select({
          id: loginAccessLogs.id,
          userId: loginAccessLogs.userId,
          teamId: loginAccessLogs.teamId,
          area: loginAccessLogs.area,
          method: loginAccessLogs.method,
          outcome: loginAccessLogs.outcome,
          reason: loginAccessLogs.reason,
          subject: loginAccessLogs.subject,
          ipAddress: loginAccessLogs.ipAddress,
          userAgent: loginAccessLogs.userAgent,
          createdAt: loginAccessLogs.createdAt,
        })
        .from(loginAccessLogs)
        .where(and(periodCondition, outcomeCondition))
        .orderBy(desc(loginAccessLogs.createdAt))
        .limit(200),
      db
        .select({ value: count() })
        .from(loginAccessLogs)
        .where(and(periodCondition, outcomeCondition)),
    ]);

  const summary = summaryRows[0];
  return {
    filters: { days, outcome },
    stats: {
      total: Number(summary?.total ?? 0),
      successful: Number(summary?.successful ?? 0),
      failed: Number(summary?.failed ?? 0),
      blocked: Number(summary?.blocked ?? 0),
      uniqueIps: Number(summary?.uniqueIps ?? 0),
      suspiciousIps: sourceRows.length,
    },
    suspiciousSources: sourceRows.slice(0, 10).map((row) => ({
      ...row,
      denied: Number(row.denied),
    })),
    entries,
    filteredTotal: Number(filteredCountRows[0]?.value ?? 0),
  };
};
