import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { RequestHandler } from './$types';

const EVENT_LOGO_DIR = '/app/uploads/event_logos';

// SVG intentionally excluded: user-uploaded SVG served inline is stored XSS.
const MIME_TYPES: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp'
};

export const GET: RequestHandler = async ({ params }) => {
    const { filename } = params;

    // Security: Prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw error(400, 'Invalid filename');
    }

    const filePath = join(EVENT_LOGO_DIR, filename);
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';

    if (!existsSync(filePath) || !MIME_TYPES[ext]) {
        return new Response('Not found', { status: 404 });
    }

    const file = await readFile(filePath);

    return new Response(file, {
        headers: {
            'Content-Type': MIME_TYPES[ext],
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=31536000'
        }
    });
};
