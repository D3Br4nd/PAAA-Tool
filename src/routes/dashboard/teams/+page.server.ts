import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { teams, users } from '$lib/server/schema';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { ensureAdmin } from '$lib/server/auth';
import { generateUniqueJoinCode } from '$lib/server/join-code';
import { isValidManualJoinCode, normalizeJoinCode } from '$lib/utils/join-code';
import { readValidatedImage, sanitizeAttachmentFilename, MAX_ATTACHMENT_SIZE } from '$lib/server/uploads';
import {
    constellationAvatarUrl,
    CONSTELLATION_AVATAR_PREFIX
} from '$lib/utils/constellation-avatar';
import { isValidLocalAvatarSeed } from '$lib/utils/local-avatar';
import { mkdir, writeFile, unlink, readdir, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isValidPlayerUsername, normalizePlayerUsername } from '$lib/utils/player-account';
import {
    hashPlayerPassword,
    PlayerProvisioningError,
    provisionTeamPlayers
} from '$lib/server/player-provisioning';
import { storePlayerPassword } from '$lib/server/player-password-vault';

const DATA_DIR = '/app/paaa_data/teams'; // Map to /home/rocky/paaa-stuff/PAAA-Tool/paaa_data/teams
const AVATAR_DIR = '/app/uploads/team_avatars';

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

function normalizeAvatarSeed(value: FormDataEntryValue | null): string | null {
    if (typeof value !== 'string') return null;
    return value.trim() || null;
}

function normalizeOptionalEmail(value: FormDataEntryValue | null): string | null {
    if (typeof value !== 'string') return null;
    return value.trim().toLowerCase() || null;
}

function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function deleteUploadedTeamAvatar(avatarUrl: string | null): Promise<void> {
    if (
        !avatarUrl?.startsWith('/api/team_avatars/') ||
        avatarUrl.startsWith(CONSTELLATION_AVATAR_PREFIX)
    ) {
        return;
    }

    const filename = avatarUrl.slice('/api/team_avatars/'.length);
    if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
        return;
    }

    const avatarPath = join(AVATAR_DIR, filename);
    if (existsSync(avatarPath)) await unlink(avatarPath).catch(() => {});
}

export const load: PageServerLoad = async ({ locals }) => {
    if (!locals.user || locals.user.role !== 'admin') {
        throw redirect(302, '/dashboard');
    }

    const allTeams = await db.select().from(teams).orderBy(teams.name);
    const allUsers = await db.select().from(users).orderBy(users.name);

    // Get files for each team
    const teamsWithFiles = await Promise.all(allTeams.map(async (t) => {
        const teamDir = join(DATA_DIR, t.id);
        let files: { name: string, size: number, mtime: Date }[] = [];
        if (existsSync(teamDir)) {
            const filenames = await readdir(teamDir);
            const filePromises = filenames.map(async (name) => {
                const s = await stat(join(teamDir, name));
                return s.isFile() ? { name, size: s.size, mtime: s.mtime } : null;
            });
            files = (await Promise.all(filePromises)).filter(f => f !== null) as { name: string, size: number, mtime: Date }[];
        }

        // Find members
        const members = allUsers.filter(u => u.teamId === t.id);

        return {
            ...t,
            files,
            members: members.map(m => ({
                id: m.id,
                name: m.name || m.username || m.email,
                username: m.username,
                email: m.email,
                role: m.role,
                avatarUrl: m.avatarUrl,
                hasPassword: Boolean(m.passwordHash)
            }))
        };
    }));

    return {
        teams: teamsWithFiles,
        users: allUsers.map(u => ({
            id: u.id,
            name: u.name || u.username || u.email,
            username: u.username,
            email: u.email,
            role: u.role,
            teamId: u.teamId,
            avatarUrl: u.avatarUrl
        })),
        currentUser: locals.user
    };
};

export const actions: Actions = {
    provisionPlayers: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = formData.get('teamId');

        if (typeof teamId !== 'string' || !teamId) {
            return fail(400, { error: 'Squadra non valida' });
        }

        const usernames = [1, 2, 3].map((slot) => normalizePlayerUsername(formData.get(`username${slot}`)) || null);
        const passwordValue = formData.get('commonPassword');
        const password = typeof passwordValue === 'string' && passwordValue ? passwordValue : undefined;

        try {
			const credentials = await provisionTeamPlayers(teamId, {
				usernames,
				password,
				accountCount: 3
			});
            if (!credentials) return fail(404, { error: 'Squadra non trovata' });
            return { success: true, credentials };
        } catch (error) {
            if (error instanceof PlayerProvisioningError) {
                return fail(400, { error: error.message });
            }
            throw error;
        }
    },

    updateTeamPlayer: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = formData.get('teamId');
        const userId = formData.get('userId');
        const nameValue = formData.get('name');
        const name = typeof nameValue === 'string' ? nameValue.trim() : '';
        const username = normalizePlayerUsername(formData.get('username'));
        const email = normalizeOptionalEmail(formData.get('email'));
        const passwordValue = formData.get('password');
        const password = typeof passwordValue === 'string' ? passwordValue : '';

        if (typeof teamId !== 'string' || typeof userId !== 'string' || !name || !username) {
            return fail(400, { error: 'Nome e username del giocatore sono obbligatori' });
        }
        if (!isValidPlayerUsername(username)) {
            return fail(400, { error: 'Lo username deve avere 3-32 caratteri: lettere, numeri, punto, trattino o underscore' });
        }
        if (email && !isValidEmail(email)) {
            return fail(400, { error: 'Email giocatore non valida' });
        }
        if (password && password.length < 8) {
            return fail(400, { error: 'La nuova password deve contenere almeno 8 caratteri' });
        }

        const [player] = await db
            .select()
            .from(users)
            .where(and(eq(users.id, userId), eq(users.teamId, teamId), eq(users.role, 'player')))
            .limit(1);
        if (!player) return fail(404, { error: 'Giocatore non trovato in questa squadra' });

        const [usernameOwner] = await db
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.username, username), ne(users.id, userId)))
            .limit(1);
        if (usernameOwner) return fail(400, { error: 'Username già utilizzato' });

        if (email) {
            const [emailOwner] = await db
                .select({ id: users.id })
                .from(users)
                .where(and(eq(users.email, email), ne(users.id, userId)))
                .limit(1);
            if (emailOwner) return fail(400, { error: 'Email già registrata da un altro utente' });
        }

        const updateData: {
            name: string;
            username: string;
            email: string | null;
            updatedAt: Date;
            passwordHash?: string;
        } = { name, username, email, updatedAt: new Date() };
        if (password) updateData.passwordHash = await hashPlayerPassword(password);

        await db.update(users).set(updateData).where(eq(users.id, userId));
        if (password) await storePlayerPassword(userId, password);
        return { success: true, playerUpdated: true };
    },

    create: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const memberIds = formData.getAll('memberIds') as string[];
        const avatarFile = formData.get('avatar') as File | null;
        const avatarSeed = normalizeAvatarSeed(formData.get('avatarSeed'));
        const requestedCode = normalizeJoinCode(String(formData.get('joinCode') || ''));

        if (!name) return fail(400, { error: 'Nome obbligatorio' });
        if (requestedCode && !isValidManualJoinCode(requestedCode)) {
            return fail(400, { error: 'Il codice squadra deve contenere 6-16 lettere o numeri' });
        }
        if (avatarSeed && !isValidLocalAvatarSeed(avatarSeed)) {
            return fail(400, { error: 'Seed avatar non valido' });
        }

        const teamId = uuidv7();
        const joinCode = requestedCode || await generateUniqueJoinCode();
        if (requestedCode) {
            const [owner] = await db.select({ id: teams.id }).from(teams).where(eq(teams.joinCode, joinCode)).limit(1);
            if (owner) return fail(400, { error: 'Codice squadra già utilizzato' });
        }

        let avatarUrl: string | null = constellationAvatarUrl(avatarSeed || teamId);
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureDir(AVATAR_DIR);
            const filename = `${teamId}-${Date.now()}.${image.ext}`;
            const filePath = join(AVATAR_DIR, filename);
            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/team_avatars/${filename}`;
        }

        await db.insert(teams).values({
            id: teamId,
            name,
            description,
            joinCode,
            avatarUrl,
            color: '#3b82f6'
        });

        // Update members
        if (memberIds.length > 0) {
            await db.update(users).set({ teamId }).where(inArray(users.id, memberIds));
        }

        return { success: true };
    },

    update: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const name = formData.get('name') as string;
        const description = formData.get('description') as string;
        const memberIds = formData.getAll('memberIds') as string[];
        const avatarFile = formData.get('avatar') as File | null;
        const avatarSeed = normalizeAvatarSeed(formData.get('avatarSeed'));
        const requestedCode = normalizeJoinCode(String(formData.get('joinCode') || ''));

        if (!id || !name) return fail(400, { error: 'Dati incompleti' });
        if (requestedCode && !isValidManualJoinCode(requestedCode)) {
            return fail(400, { error: 'Il codice squadra deve contenere 6-16 lettere o numeri' });
        }
        if (avatarSeed && !isValidLocalAvatarSeed(avatarSeed)) {
            return fail(400, { error: 'Seed avatar non valido' });
        }

        const [current] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
        if (!current) return fail(404, { error: 'Team non trovato' });
        const joinCode = requestedCode || current.joinCode;
        if (joinCode !== current.joinCode) {
            const [owner] = await db
                .select({ id: teams.id })
                .from(teams)
                .where(and(eq(teams.joinCode, joinCode), ne(teams.id, id)))
                .limit(1);
            if (owner) return fail(400, { error: 'Codice squadra già utilizzato' });
        }

        let avatarUrl = current.avatarUrl;
        if (avatarFile && avatarFile.size > 0) {
            const image = await readValidatedImage(avatarFile);
            if (!image) {
                return fail(400, { error: 'Avatar non valido: sono ammesse solo immagini PNG, JPEG, GIF o WebP (max 5 MB)' });
            }
            await ensureDir(AVATAR_DIR);
            const filename = `${id}-${Date.now()}.${image.ext}`;
            const filePath = join(AVATAR_DIR, filename);
            await writeFile(filePath, image.buffer);
            avatarUrl = `/api/team_avatars/${filename}`;
        } else if (avatarSeed) {
            avatarUrl = constellationAvatarUrl(avatarSeed);
        }

        await db.update(teams).set({
            name,
            joinCode,
            description,
            avatarUrl,
            updatedAt: new Date()
        }).where(eq(teams.id, id));

        if (avatarUrl !== current.avatarUrl) {
            await deleteUploadedTeamAvatar(current.avatarUrl);
        }

        // Reset previous members and assign new ones
        await db.update(users).set({ teamId: null }).where(eq(users.teamId, id));
        if (memberIds.length > 0) {
            await db.update(users).set({ teamId: id }).where(inArray(users.id, memberIds));
        }

        return { success: true };
    },

    delete: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;

        try {
            // Check if team exists and get details
            const [team] = await db.select().from(teams).where(eq(teams.id, id)).limit(1);

            if (!team) {
                return fail(404, { error: 'Team non trovato' });
            }

            // Cleanup files and avatars
            const teamDir = join(DATA_DIR, id);
            if (existsSync(teamDir)) {
                await rm(teamDir, { recursive: true, force: true });
            }

            await db.update(users).set({ teamId: null }).where(eq(users.teamId, id));
            await db.delete(teams).where(eq(teams.id, id));
            await deleteUploadedTeamAvatar(team.avatarUrl);

            return { success: true };
        } catch (e) {
            console.error('Error deleting team:', e);
            return fail(500, { error: 'Errore durante l\'eliminazione del team' });
        }
    },

    uploadFile: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const files = formData.getAll('files') as File[];

        if (!teamId || files.length === 0) return fail(400, { error: 'Dati mancanti' });

        try {
            const teamDir = join(DATA_DIR, teamId);
            await ensureDir(teamDir);

            for (const file of files) {
                if (file.size === 0) continue;
                if (file.size > MAX_ATTACHMENT_SIZE) {
                    return fail(400, { error: `File troppo grande: ${file.name} (max 20 MB)` });
                }
                const safeName = sanitizeAttachmentFilename(file.name);
                if (!safeName) {
                    return fail(400, { error: `Nome o tipo di file non valido: ${file.name}` });
                }
                const filePath = join(teamDir, safeName);
                await writeFile(filePath, Buffer.from(await file.arrayBuffer()));
            }

            return { success: true };
        } catch (e) {
            console.error('Error uploading files:', e);
            return fail(500, { error: 'Errore durante il caricamento dei file' });
        }
    },

    deleteFile: async ({ request, locals }) => {
        ensureAdmin(locals);
        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const filename = formData.get('filename') as string;

        if (!teamId || !filename) return fail(400, { error: 'Dati mancanti' });
        if (/[/\\]|\.\./.test(teamId) || /[/\\]|\.\./.test(filename)) {
            return fail(400, { error: 'Percorso non valido' });
        }

        try {
            const filePath = join(DATA_DIR, teamId, filename);
            if (existsSync(filePath)) {
                await unlink(filePath);
            }
            return { success: true };
        } catch (e) {
            console.error('Error deleting file:', e);
            return fail(500, { error: 'Errore durante l\'eliminazione del file' });
        }
    }
};
