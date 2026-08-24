import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { users, teams, factionManagers } from '$lib/server/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { ensureAdmin } from '$lib/server/auth';
import { readValidatedImage } from '$lib/server/uploads';
import {
    isValidPlanetAvatarSeed,
    planetAvatarUrl,
    PLANET_AVATAR_PREFIX
} from '$lib/utils/planet-avatar';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isValidPlayerUsername, normalizePlayerUsername } from '$lib/utils/player-account';
import { storePlayerPassword } from '$lib/server/player-password-vault';

const UPLOAD_DIR = '/app/uploads/avatars';
const validRoles = ['admin', 'staff', 'player'] as const;
type UserRole = (typeof validRoles)[number];

// Ensure upload directory exists
async function ensureUploadDir() {
    if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
    }
}

function normalizeAvatarSeed(value: FormDataEntryValue | null): string | null {
    if (typeof value !== 'string') return null;
    return value.trim() || null;
}

async function deleteUploadedAvatar(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl?.startsWith('/api/avatars/') || avatarUrl.startsWith(PLANET_AVATAR_PREFIX)) {
        return;
    }

    const filename = avatarUrl.slice('/api/avatars/'.length);
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return;
    }

    const filePath = join(UPLOAD_DIR, filename);
    if (existsSync(filePath)) {
        await unlink(filePath).catch(() => {});
    }
}

async function deleteUsersByIds(ids: string[]): Promise<number> {
    const deletedUsers = await db.transaction(async (tx) => {
        const matchedUsers = await tx
            .select({ id: users.id, avatarUrl: users.avatarUrl })
            .from(users)
            .where(inArray(users.id, ids));

        if (matchedUsers.length > 0) {
            await tx.delete(users).where(inArray(users.id, matchedUsers.map((user) => user.id)));
        }

        return matchedUsers;
    });

    await Promise.all(deletedUsers.map((user) => deleteUploadedAvatar(user.avatarUrl)));
    return deletedUsers.length;
}

// Hash password using Bun's native API
async function hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
}

// Login lowercases the submitted address, so anything stored with uppercase
// characters could never be matched again. Normalise on write instead.
function normalizeEmail(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeUsername(value: FormDataEntryValue | null, role: UserRole | null): string | null {
    if (role !== 'player') return null;
    return normalizePlayerUsername(value) || null;
}

function normalizeRole(value: FormDataEntryValue | null): UserRole | null {
    return validRoles.includes(value as UserRole) ? (value as UserRole) : null;
}

async function normalizeTeamId(rawTeamId: string | null, role: UserRole) {
    if (role !== 'player') return null;
    const teamId = rawTeamId || null;
    if (!teamId) return null;

    const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1);
    return team?.id || null;
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user) {
        throw redirect(302, '/login');
    }

    // Only admin can manage users
    if (locals.user.role !== 'admin') {
        throw redirect(302, '/dashboard');
    }

    const allUsers = await db.select().from(users).orderBy(users.createdAt);
    const allTeams = await db.select().from(teams).orderBy(teams.name);

    return {
        users: allUsers.map((u) => ({
            id: u.id,
            email: u.email,
            username: u.username,
            name: u.name,
            role: u.role,
            avatarUrl: u.avatarUrl,
            teamId: u.teamId,
            createdAt: u.createdAt
        })),
        teams: allTeams.map(t => ({ id: t.id, name: t.name })),
        currentUser: locals.user
    };
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const email = normalizeEmail(formData.get('email'));
        const password = formData.get('password') as string;
        const name = formData.get('name') as string;
        const role = normalizeRole(formData.get('role'));
        const username = normalizeUsername(formData.get('username'), role);
        const teamId = await normalizeTeamId(formData.get('teamId') as string | null, role || 'player');
        const avatarFile = formData.get('avatar') as File | null;
        const avatarSeed = normalizeAvatarSeed(formData.get('avatarSeed'));

        if (!password || !role || (role !== 'player' && !email) || (role === 'player' && !username && !email)) {
            return fail(400, { error: 'Password, ruolo e un identificativo di accesso sono obbligatori' });
        }
        if (username && !isValidPlayerUsername(username)) {
            return fail(400, { error: 'Username non valido: usa 3-32 lettere, numeri, punto, trattino o underscore' });
        }
        if (avatarSeed && !isValidPlanetAvatarSeed(avatarSeed)) {
            return fail(400, { error: 'Seed avatar non valido' });
        }

        // Check if email already exists
        if (email) {
            const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
            if (existing.length > 0) {
                return fail(400, { error: 'Email già registrata' });
            }
        }
        if (username) {
            const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
            if (existing.length > 0) {
                return fail(400, { error: 'Username già registrato' });
            }
        }

        const userId = uuidv7();
        let avatarUrl: string | null = planetAvatarUrl(avatarSeed || userId);

        // Handle avatar upload
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureUploadDir();
            const filename = `${userId}-${Date.now()}.${image.ext}`;
            const filePath = join(UPLOAD_DIR, filename);

            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/avatars/${filename}`;
        }

        const passwordHash = await hashPassword(password);

        await db.insert(users).values({
            id: userId,
            email: email || null,
            username,
            passwordHash,
            name: name || null,
            avatarUrl,
            role,
            teamId
        });
        if (role === 'player') await storePlayerPassword(userId, password);

        return { success: true };
    },

    update: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const email = normalizeEmail(formData.get('email'));
        const password = formData.get('password') as string;
        const name = formData.get('name') as string;
        const role = normalizeRole(formData.get('role'));
        const username = normalizeUsername(formData.get('username'), role);
        const rawTeamId = formData.get('teamId') as string | null;
        const avatarFile = formData.get('avatar') as File | null;
        const avatarSeed = normalizeAvatarSeed(formData.get('avatarSeed'));

        if (!id || !role || (role !== 'player' && !email) || (role === 'player' && !username && !email)) {
            return fail(400, { error: 'Dati incompleti' });
        }
        if (username && !isValidPlayerUsername(username)) {
            return fail(400, { error: 'Username non valido: usa 3-32 lettere, numeri, punto, trattino o underscore' });
        }
        if (avatarSeed && !isValidPlanetAvatarSeed(avatarSeed)) {
            return fail(400, { error: 'Seed avatar non valido' });
        }

        // Get current user data
        const [current] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        if (!current) {
            return fail(404, { error: 'Utente non trovato' });
        }

        if (id === locals.user?.id && current.role === 'admin' && role !== 'admin') {
            return fail(400, { error: 'Non puoi togliere il ruolo admin al tuo account mentre lo stai usando.' });
        }

        if (email) {
            const [emailOwner] = await db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.email, email), ne(users.id, id)))
                .limit(1);
            if (emailOwner) {
                return fail(400, { error: 'Email già registrata da un altro utente' });
            }
        }
        if (username) {
            const [usernameOwner] = await db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.username, username), ne(users.id, id)))
                .limit(1);
            if (usernameOwner) {
                return fail(400, { error: 'Username già registrato da un altro utente' });
            }
        }

        const teamId = await normalizeTeamId(rawTeamId, role);

        let avatarUrl = current.avatarUrl;

        // Handle new avatar upload
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureUploadDir();

            const filename = `${id}-${Date.now()}.${image.ext}`;
            const filePath = join(UPLOAD_DIR, filename);

            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/avatars/${filename}`;
        } else if (avatarSeed) {
            avatarUrl = planetAvatarUrl(avatarSeed);
        }

        // Prepare update data
        const updateData: Record<string, unknown> = {
            email: email || null,
            username,
            name: name || null,
            avatarUrl,
            role,
            teamId,
            updatedAt: new Date()
        };

        // Only update password if provided
        if (password) {
            updateData.passwordHash = await hashPassword(password);
        }

        await db.transaction(async (tx) => {
            await tx.update(users).set(updateData).where(eq(users.id, id));

            if (role !== 'staff') {
                await tx.delete(factionManagers).where(eq(factionManagers.userId, id));
            }
        });
        if (role === 'player' && password) await storePlayerPassword(id, password);

        if (avatarUrl !== current.avatarUrl) {
            await deleteUploadedAvatar(current.avatarUrl);
        }

        return { success: true };
    },

    delete: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;

        if (!id) {
            return fail(400, { error: 'ID utente mancante' });
        }
        if (id === locals.user?.id) {
            return fail(400, { error: 'Non puoi eliminare il tuo account mentre lo stai usando.' });
        }

        const deletedCount = await deleteUsersByIds([id]);
        if (deletedCount === 0) {
            return fail(404, { error: 'Utente non trovato' });
        }

        return { success: true, deletedCount };
    },

    deleteMany: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const ids = Array.from(
            new Set(
                formData
                    .getAll('ids')
                    .filter((value): value is string => typeof value === 'string')
                    .map((value) => value.trim())
                    .filter(Boolean)
            )
        );

        if (ids.length === 0) {
            return fail(400, { error: 'Seleziona almeno un utente da eliminare' });
        }
        if (locals.user?.id && ids.includes(locals.user.id)) {
            return fail(400, { error: 'La selezione include il tuo account, che non può essere eliminato.' });
        }

        const deletedCount = await deleteUsersByIds(ids);
        if (deletedCount === 0) {
            return fail(404, { error: 'Nessuno degli utenti selezionati è stato trovato' });
        }

        return { success: true, deletedCount };
    }
};
