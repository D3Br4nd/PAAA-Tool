import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users, teams } from '$lib/server/schema';
import { eq, or, sql } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { createSessionToken, createTeamSessionToken } from '$lib/server/auth';
import { normalizeJoinCode } from '$lib/utils/join-code';
import {
    checkRateLimit,
    checkFailureLock,
    registerFailure,
    clearFailures
} from '$lib/server/rate-limit';
import { normalizePlayerUsername } from '$lib/utils/player-account';
import { recordLoginAccess } from '$lib/server/login-access-audit';

const SESSION_COOKIE = {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7
} as const;

/**
 * Only same-origin absolute paths are accepted. Rejects absolute URLs,
 * protocol-relative `//evil.com` and backslash variants that browsers
 * normalise to `//`, which would turn the login form into an open redirect.
 */
function safeRedirect(target: string | null, fallback = '/') {
    if (!target || !target.startsWith('/')) return fallback;
    if (target.startsWith('//') || target.startsWith('/\\')) return fallback;
    return target;
}

function lockoutMessage(retryAfterMs: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterMs / 60000));
    return `Troppi tentativi falliti per questo account. Riprova tra ${minutes} minut${minutes === 1 ? 'o' : 'i'}.`;
}

export const load: PageServerLoad = async ({ locals }) => {
    if (locals.user) {
        if (locals.user.role === 'player') {
            throw redirect(302, '/game');
        }
        if (locals.user.role === 'staff') {
            throw redirect(302, '/staff');
        }
        throw redirect(302, '/dashboard');
    }
};

export const actions: Actions = {
    admin: async ({ request, cookies, getClientAddress }) => {
        const ip = getClientAddress();
        const userAgent = request.headers.get('user-agent');
        const limit = checkRateLimit(`login_admin_${ip}`, 10, 60 * 1000);
        if (!limit.success) {
            await recordLoginAccess({
                area: 'admin', method: 'unknown', outcome: 'blocked', reason: 'rate_limited',
                ipAddress: ip, userAgent
            });
            return fail(429, { message: 'Troppi tentativi. Riprova tra un minuto.' });
        }

        const data = await request.formData();
        const email = (data.get('email') as string)?.trim().toLowerCase();
        const password = data.get('password') as string;

        if (!email || !password) {
            await recordLoginAccess({
                area: 'admin', method: 'password', outcome: 'failure', reason: 'missing_fields',
                subject: email, ipAddress: ip, userAgent
            });
            return fail(400, { message: 'Email e password sono obbligatorie.' });
        }

        // Per-account throttle: the per-IP ceiling above does nothing against
        // an attacker rotating source addresses at a single account.
        const accountKey = `login_account_${email}`;
        const lock = checkFailureLock(accountKey);
        if (lock.locked) {
            await recordLoginAccess({
                area: 'admin', method: 'password', outcome: 'blocked', reason: 'account_locked',
                subject: email, ipAddress: ip, userAgent
            });
            return fail(429, { message: lockoutMessage(lock.retryAfterMs) });
        }

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (!user || (user.role !== 'admin' && user.role !== 'staff')) {
            registerFailure(accountKey);
            await recordLoginAccess({
                area: 'admin', method: 'password', outcome: 'failure',
                reason: user ? 'unauthorized_role' : 'invalid_credentials',
                subject: email, userId: user?.id, teamId: user?.teamId,
                ipAddress: ip, userAgent
            });
            return fail(401, { message: 'Credenziali non valide o accesso non autorizzato.' });
        }

        if (!user.passwordHash) {
            await recordLoginAccess({
                area: 'admin', method: 'password', outcome: 'failure', reason: 'password_not_configured',
                subject: user.name || user.email || email, userId: user.id, teamId: user.teamId,
                ipAddress: ip, userAgent
            });
            return fail(401, { message: 'Contattare l\'amministratore per impostare la password.' });
        }

        const valid = await Bun.password.verify(password, user.passwordHash);
        if (!valid) {
            registerFailure(accountKey);
            await recordLoginAccess({
                area: 'admin', method: 'password', outcome: 'failure', reason: 'invalid_credentials',
                subject: user.name || user.email || email, userId: user.id, teamId: user.teamId,
                ipAddress: ip, userAgent
            });
            return fail(401, { message: 'Credenziali non valide.' });
        }

        clearFailures(accountKey);
        const token = await createSessionToken(user.id, 'password');

        cookies.set('session', token, SESSION_COOKIE);
        cookies.delete('auth_method', { path: '/' });
        await recordLoginAccess({
            area: 'admin', method: 'password', outcome: 'success',
            subject: user.name || user.email || email, userId: user.id, teamId: user.teamId,
            ipAddress: ip, userAgent
        });

        if (user.role === 'staff') {
            throw redirect(302, '/staff');
        }
        throw redirect(302, '/dashboard');
    },

    player: async ({ request, cookies, url, getClientAddress }) => {
        const ip = getClientAddress();
        const userAgent = request.headers.get('user-agent');
        const limit = checkRateLimit(`login_player_${ip}`, 20, 60 * 1000);
        if (!limit.success) {
            await recordLoginAccess({
                area: 'player', method: 'unknown', outcome: 'blocked', reason: 'rate_limited',
                ipAddress: ip, userAgent
            });
            return fail(429, { message: 'Troppi tentativi. Riprova tra un minuto.' });
        }

        const data = await request.formData();
        const rawJoinCode = data.get('joinCode');
        const joinCode = typeof rawJoinCode === 'string' ? normalizeJoinCode(rawJoinCode) : '';
        const rawIdentity = data.get('identity');
        const identity = typeof rawIdentity === 'string' ? rawIdentity.trim().toLowerCase() : '';
        const password = data.get('password') as string;
        const redirectTo = safeRedirect(url.searchParams.get('redirectTo'), '/game');

        if (identity && password) {
            // Login with credentials — same per-account throttle as the admin
            // action, since the per-IP ceiling does not cover credential
            // stuffing from rotating addresses.
            const accountKey = `login_account_${identity}`;
            const lock = checkFailureLock(accountKey);
            if (lock.locked) {
                await recordLoginAccess({
                    area: 'player', method: 'password', outcome: 'blocked', reason: 'account_locked',
                    subject: identity, ipAddress: ip, userAgent
                });
                return fail(429, { message: lockoutMessage(lock.retryAfterMs) });
            }

            const username = normalizePlayerUsername(identity);
            const [user] = await db
                .select()
                .from(users)
                .where(or(eq(users.email, identity), eq(users.username, username)))
                .limit(1);
            if (!user || user.role !== 'player' || !user.passwordHash) {
                registerFailure(accountKey);
                await recordLoginAccess({
                    area: 'player', method: 'password', outcome: 'failure',
                    reason: user && user.role !== 'player'
                        ? 'unauthorized_role'
                        : user && !user.passwordHash
                            ? 'password_not_configured'
                            : 'invalid_credentials',
                    subject: identity, userId: user?.id, teamId: user?.teamId,
                    ipAddress: ip, userAgent
                });
                return fail(401, { message: 'Credenziali non valide.' });
            }
            const valid = await Bun.password.verify(password, user.passwordHash);
            if (!valid) {
                registerFailure(accountKey);
                await recordLoginAccess({
                    area: 'player', method: 'password', outcome: 'failure', reason: 'invalid_credentials',
                    subject: user.name || user.username || user.email || identity,
                    userId: user.id, teamId: user.teamId, ipAddress: ip, userAgent
                });
                return fail(401, { message: 'Credenziali non valide.' });
            }
            clearFailures(accountKey);

            const token = await createSessionToken(user.id, 'password');
            cookies.set('session', token, SESSION_COOKIE);
            cookies.delete('auth_method', { path: '/' });
            await recordLoginAccess({
                area: 'player', method: 'password', outcome: 'success',
                subject: user.name || user.username || user.email || identity,
                userId: user.id, teamId: user.teamId, ipAddress: ip, userAgent
            });
        } else if (joinCode) {
            // Login with join code
            const [team] = await db
                .select()
                .from(teams)
                .where(sql`upper(${teams.joinCode}) = ${joinCode}`)
                .limit(1);
            if (!team) {
                await recordLoginAccess({
                    area: 'player', method: 'join_code', outcome: 'failure', reason: 'invalid_join_code',
                    ipAddress: ip, userAgent
                });
                return fail(404, { message: 'Codice squadra non valido.' });
            }

            const token = await createTeamSessionToken(team.id);
            cookies.set('session', token, SESSION_COOKIE);
            cookies.delete('auth_method', { path: '/' });
            await recordLoginAccess({
                area: 'player', method: 'join_code', outcome: 'success',
                subject: team.name, teamId: team.id, ipAddress: ip, userAgent
            });
        } else {
            await recordLoginAccess({
                area: 'player', method: identity ? 'password' : 'unknown',
                outcome: 'failure', reason: 'missing_fields', subject: identity,
                ipAddress: ip, userAgent
            });
            return fail(400, { message: 'Inserisci il codice squadra o le tue credenziali.' });
        }

        throw redirect(302, redirectTo);
    }
};
