import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initialsAvatarSvg } from '$lib/utils/initials-avatar';

const UPLOAD_DIR = '/app/uploads/faction_avatars';

// SVG intentionally excluded: user-uploaded SVG served inline is stored XSS.
const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
};

export const GET: RequestHandler = async ({ params }) => {
    const { filename } = params;

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw error(400, 'Invalid filename');
    }

    const filePath = join(UPLOAD_DIR, filename);
    const ext = '.' + filename.split('.').pop()?.toLowerCase();

    if (existsSync(filePath) && MIME_TYPES[ext]) {
        try {
            const file = await readFile(filePath);

            return new Response(file, {
                headers: {
                    'Content-Type': MIME_TYPES[ext],
                    'X-Content-Type-Options': 'nosniff',
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        } catch {
            // Fall through to generated fallback
        }
    }

    const seed = filename.split('.')[0] || 'faction';
    return new Response(initialsAvatarSvg(seed), {
        headers: {
            'Content-Type': 'image/svg+xml',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=86400'
        }
    });
};
