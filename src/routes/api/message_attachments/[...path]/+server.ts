import { error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = '/app/paaa_data';

const MIME_TYPES: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain'
};

// No path separators (already split) and no traversal segments.
function isSafeSegment(segment: string): boolean {
    return segment.length > 0 && segment !== '.' && segment !== '..' && !segment.includes('\\');
}

export const GET: RequestHandler = async ({ params, locals }) => {
    if (!locals.user) {
        throw error(401, 'Autenticazione richiesta');
    }

    const path = (params as { path: string }).path;
    const parts = path.split('/');

    if (!parts.every(isSafeSegment)) {
        throw error(400, 'Percorso non valido');
    }

    const isStaff = locals.user.role === 'admin' || locals.user.role === 'staff';

    // path can be:
    //   team/[teamId]/[filename]   — visible to staff and members of that team
    //   player/[userId]/[filename] — visible to staff and that user
    //   broadcast/[filename]       — visible to any authenticated user
    let fullPath = '';

    if (parts[0] === 'team' && parts.length === 3) {
        if (!isStaff && locals.user.teamId !== parts[1]) {
            throw error(403, 'Accesso negato');
        }
        fullPath = join(DATA_DIR, 'teams', parts[1], 'messages', parts[2]);
    } else if (parts[0] === 'player' && parts.length === 3) {
        if (!isStaff && locals.user.id !== parts[1]) {
            throw error(403, 'Accesso negato');
        }
        fullPath = join(DATA_DIR, 'players', parts[1], 'messages', parts[2]);
    } else if (parts[0] === 'broadcast' && parts.length === 2) {
        fullPath = join(DATA_DIR, 'broadcast_messages', parts[1]);
    } else {
        throw error(400, 'Percorso non valido');
    }

    if (!existsSync(fullPath)) {
        throw error(404, 'File non trovato');
    }

    try {
        const file = await readFile(fullPath);
        const fileName = parts[parts.length - 1];
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

        return new Response(file, {
            headers: {
                'Content-Type': contentType,
                'X-Content-Type-Options': 'nosniff',
                'Content-Disposition': `inline; filename="${fileName.replace(/"/g, '')}"`
            }
        });
    } catch {
        throw error(500, 'Errore durante la lettura del file');
    }
};
