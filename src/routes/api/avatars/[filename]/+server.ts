import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { initialsAvatarSvg } from '$lib/utils/initials-avatar';

const UPLOAD_DIR = '/app/uploads/avatars';

// SVG intentionally excluded: user-uploaded SVG served inline is stored XSS.
const MIME_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
};

/**
 * GET /api/avatars/[filename]
 * Serves avatar files from the uploads directory.
 * Falls back to a locally generated initials SVG if the file is missing.
 */
export const GET: RequestHandler = async ({ params }) => {
    const { filename } = params;

    // Security: Prevent directory traversal
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
                    'Cache-Control': 'public, max-age=86400' // 24h cache
                }
            });
        } catch {
            // Fall through to generated fallback
        }
    }

    // Fallback: locally generated initials avatar (no external services)
    const seed = filename.split('.')[0] || 'default';
    return new Response(initialsAvatarSvg(seed), {
        headers: {
            'Content-Type': 'image/svg+xml',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=86400'
        }
    });
};
