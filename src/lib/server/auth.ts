import { SignJWT, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';
import { createHash, randomUUID } from 'node:crypto';

// Lazy getter: validation runs at request time (not at build time) because
// $env/dynamic/private is only populated at runtime, not during vite build.
function getSecret(): Uint8Array {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) {
        throw new Error('AUTH_SECRET non impostato o troppo corto (minimo 32 caratteri). Configuralo nel file .env.');
    }
    return new TextEncoder().encode(env.AUTH_SECRET);
}

export type AuthMethod = 'code' | 'password';

export type SessionClaims =
    | { userId: string; teamId: null; authMethod: AuthMethod; sessionId: string }
    | { userId: null; teamId: string; authMethod: 'code'; sessionId: string };

export async function createSessionToken(userId: string, authMethod: AuthMethod) {
    const sessionId = randomUUID();
    const jwt = await new SignJWT({ userId, authMethod })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(sessionId)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getSecret());
    return jwt;
}

/** Creates a team-scoped session without requiring a placeholder player row. */
export async function createTeamSessionToken(teamId: string) {
    const sessionId = randomUUID();
    return new SignJWT({ teamId, authMethod: 'code' })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(sessionId)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
    try {
        const { payload } = await jwtVerify(token, getSecret());
        // Fail closed: a token without an explicit `password` claim (including
        // sessions issued before this claim existed) is treated as join-code
        // level access, never as account-level access.
        const authMethod: AuthMethod = payload.authMethod === 'password' ? 'password' : 'code';
        const sessionId = typeof payload.jti === 'string' && payload.jti
            ? payload.jti
            : `legacy:${createHash('sha256').update(token).digest('base64url').slice(0, 32)}`;
        const teamId = payload.teamId;
        if (authMethod === 'code' && typeof teamId === 'string' && teamId) {
            return { userId: null, teamId, authMethod: 'code', sessionId };
        }

        // Backwards compatibility for sessions previously tied to the first
        // player account found in a team.
        const userId = payload.userId;
        if (typeof userId !== 'string' || !userId) return null;
        return { userId, teamId: null, authMethod, sessionId };
    } catch {
        return null;
    }
}

import { error } from '@sveltejs/kit';

export function ensureAdmin(locals: App.Locals) {
    if (!locals.user || locals.user.role !== 'admin') {
        throw error(403, 'Forbidden: Admin access required');
    }
    return locals.user;
}

export function ensureStaff(locals: App.Locals) {
    if (!locals.user || (locals.user.role !== 'staff' && locals.user.role !== 'admin')) {
        throw error(403, 'Forbidden: Staff access required');
    }
    return locals.user;
}
