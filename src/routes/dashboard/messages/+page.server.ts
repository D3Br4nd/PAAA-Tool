import { db } from '$lib/server/db';
import { events, factions, teams, messages, activityLogs, users } from '$lib/server/schema';
import { fail } from '@sveltejs/kit';
import { and, eq, sql } from 'drizzle-orm';
import type { PageServerLoad, Actions } from './$types';
import { uuidv7 } from 'uuidv7';
import { ensureAdmin } from '$lib/server/auth';
import { sanitizeAttachmentFilename, MAX_ATTACHMENT_SIZE } from '$lib/server/uploads';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureMessagesSchema } from '$lib/server/messages';

const DATA_DIR = '/app/paaa_data';

export const load: PageServerLoad = async ({ locals, url }) => {
    await ensureMessagesSchema();

    if (!locals.user || locals.user.role !== 'admin') {
        return { teams: [], messages: [], players: [], messagePlayers: [], totalPlayers: 0, teamsForFilter: [] };
    }

    const page = Number(url.searchParams.get('page')) || 1;
    const pageSize = 10;
    const teamFilter = url.searchParams.get('teamId');
    const playerSearch = url.searchParams.get('search') || '';

    // Fetch teams with faction and event info
    const allTeams = await db
        .select({
            id: teams.id,
            name: teams.name,
            avatarUrl: teams.avatarUrl,
            factionName: factions.name,
            eventName: events.name
        })
        .from(teams)
        .leftJoin(factions, eq(teams.factionId, factions.id))
        .leftJoin(events, eq(factions.eventId, events.id))
        .orderBy(teams.name);

    const conditions = [eq(users.role, 'player')];
    if (teamFilter) conditions.push(eq(users.teamId, teamFilter));
    if (playerSearch) conditions.push(sql`${users.name} LIKE ${`%${playerSearch}%`}`);

    const totalPlayersResult = await db.select({ count: sql<number>`count(*)` })
        .from(users)
        .where(and(...conditions));

    const allPlayers = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            avatarUrl: users.avatarUrl,
            teamName: teams.name,
            teamId: teams.id
        })
        .from(users)
        .leftJoin(teams, eq(users.teamId, teams.id))
        .where(and(...conditions))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .orderBy(users.name);

    const messagePlayers = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            avatarUrl: users.avatarUrl,
            teamName: teams.name,
            teamId: teams.id
        })
        .from(users)
        .leftJoin(teams, eq(users.teamId, teams.id))
        .where(eq(users.role, 'player'))
        .orderBy(users.name);

    // Fetch all messages (for management)
    const allMessages = await db
        .select()
        .from(messages)
        .orderBy(sql`${messages.sentAt} DESC`);

    return {
        teams: allTeams,
        messages: allMessages,
        players: allPlayers,
        messagePlayers,
        totalPlayers: totalPlayersResult[0].count,
        currentPage: page,
        pageSize,
        teamFilter
    };
};

async function ensureDir(dir: string) {
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

export const actions: Actions = {
    sendMessage: async ({ request, locals }) => {
        await ensureMessagesSchema();
        const user = ensureAdmin(locals);

        const formData = await request.formData();
        const teamId = formData.get('teamId') as string;
        const recipientId = formData.get('recipientId') as string;
        const content = formData.get('content') as string;
        const expiresAt = parseExpiresAt(formData.get('expiresAt') as string | null);
        const attachment = formData.get('attachment') as File | null;

        if ((!teamId && !recipientId) || !content) {
            return fail(400, { error: 'Dati mancanti' });
        }

        const messageId = uuidv7();
        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;

        if (attachment && attachment.size > 0) {
            if (attachment.size > MAX_ATTACHMENT_SIZE) {
                return fail(400, { error: 'Allegato troppo grande (max 20 MB)' });
            }
            const safeName = sanitizeAttachmentFilename(attachment.name);
            if (!safeName) {
                return fail(400, { error: 'Nome o tipo di file non valido (ammessi: pdf, txt, immagini)' });
            }
            const teamDir = teamId ? join(DATA_DIR, 'teams', teamId, 'messages') : join(DATA_DIR, 'players', recipientId, 'messages');
            await ensureDir(teamDir);
            const filePath = join(teamDir, safeName);
            await writeFile(filePath, Buffer.from(await attachment.arrayBuffer()));
            attachmentUrl = teamId ? `/api/message_attachments/team/${teamId}/${safeName}` : `/api/message_attachments/player/${recipientId}/${safeName}`;
            attachmentName = safeName;
        }

        await db.insert(messages).values({
            id: messageId,
            senderId: user.id,
            recipientTeamId: teamId || null,
            recipientId: recipientId || null,
            content,
            attachmentUrl,
            attachmentName,
            expiresAt,
            isRead: false
        });

        // Add to activity logs
        await db.insert(activityLogs).values({
            id: uuidv7(),
            teamId: teamId || null,
            type: 'message_sent',
            content: `Messaggio inviato a ${recipientId ? 'giocatore' : 'team'}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
        });

        return { success: true };
    },

    sendBroadcast: async ({ request, locals }) => {
        await ensureMessagesSchema();
        const user = ensureAdmin(locals);

        const formData = await request.formData();
        const content = formData.get('content') as string;
        const expiresAt = parseExpiresAt(formData.get('expiresAt') as string | null);
        const attachment = formData.get('attachment') as File | null;

        if (!content) {
            return fail(400, { error: 'Dati mancanti' });
        }

        const messageId = uuidv7();
        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;

        if (attachment && attachment.size > 0) {
            if (attachment.size > MAX_ATTACHMENT_SIZE) {
                return fail(400, { error: 'Allegato troppo grande (max 20 MB)' });
            }
            const safeName = sanitizeAttachmentFilename(attachment.name);
            if (!safeName) {
                return fail(400, { error: 'Nome o tipo di file non valido (ammessi: pdf, txt, immagini)' });
            }
            const broadcastDir = join(DATA_DIR, 'broadcast_messages');
            await ensureDir(broadcastDir);
            const filePath = join(broadcastDir, safeName);
            await writeFile(filePath, Buffer.from(await attachment.arrayBuffer()));
            attachmentUrl = `/api/message_attachments/broadcast/${safeName}`;
            attachmentName = safeName;
        }

        await db.insert(messages).values({
            id: messageId,
            senderId: user.id,
            isBroadcast: true,
            content,
            attachmentUrl,
            attachmentName,
            expiresAt,
            isRead: false
        });

        // Add to activity logs
        await db.insert(activityLogs).values({
            id: uuidv7(),
            type: 'broadcast_sent',
            content: `Broadcast inviato: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`
        });

        return { success: true };
    },

    updateMessage: async ({ request, locals }) => {
        await ensureMessagesSchema();
        ensureAdmin(locals);

        const formData = await request.formData();
        const messageId = formData.get('id') as string;
        const content = formData.get('content') as string;
        const expiresAt = parseExpiresAt(formData.get('expiresAt') as string | null);

        if (!messageId || !content) {
            return fail(400, { error: 'Dati mancanti' });
        }

        await db.update(messages).set({
            content,
            expiresAt
        }).where(eq(messages.id, messageId));

        return { success: true };
    },

    deleteMessage: async ({ request, locals }) => {
        await ensureMessagesSchema();
        ensureAdmin(locals);

        const formData = await request.formData();
        const messageId = formData.get('id') as string;

        if (!messageId) return fail(400, { error: 'Dati mancanti' });

        const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
        if (message) {
            // Delete attachment if exists
            if (message.attachmentUrl && message.attachmentName && !/[/\\]|\.\./.test(message.attachmentName)) {
                let filePath = '';
                if (message.isBroadcast) {
                    filePath = join(DATA_DIR, 'broadcast_messages', message.attachmentName!);
                } else if (message.recipientTeamId) {
                    filePath = join(DATA_DIR, 'teams', message.recipientTeamId, 'messages', message.attachmentName!);
                }

                if (filePath && existsSync(filePath)) {
                    await unlink(filePath).catch(() => { });
                }
            }

            await db.delete(messages).where(eq(messages.id, messageId));
        }

        return { success: true };
    }
};

function parseExpiresAt(value: string | null): Date | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return null;
    return new Date(timestamp);
}
