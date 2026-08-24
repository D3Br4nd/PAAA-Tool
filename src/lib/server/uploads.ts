/**
 * Shared upload validation helpers.
 *
 * - Images are validated by magic bytes (not by client-declared MIME or by
 *   the original filename), and the extension is derived from the sniffed
 *   format. This blocks SVG/HTML uploads (stored XSS) and spoofed extensions.
 * - Attachment filenames are sanitized to a safe basename (no path segments)
 *   with a whitelisted extension.
 */

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB

export type SniffedImageExt = 'png' | 'jpg' | 'gif' | 'webp';

/** Detect the real image format from file content (magic bytes). */
export function sniffImageExt(buffer: Buffer): SniffedImageExt | null {
    if (buffer.length < 12) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
        return 'png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'jpg';
    }
    // GIF: GIF87a / GIF89a
    if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
        return 'gif';
    }
    // WebP: RIFF....WEBP
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
        return 'webp';
    }
    return null;
}

export type ValidatedImage = { buffer: Buffer; ext: SniffedImageExt };

/**
 * Reads and validates an uploaded image file.
 * Returns null (with no exception) when the file is not a valid raster image
 * or exceeds maxSize — callers turn that into their own 400/fail response.
 */
export async function readValidatedImage(
    file: File,
    maxSize: number = MAX_IMAGE_SIZE
): Promise<ValidatedImage | null> {
    if (file.size === 0 || file.size > maxSize) return null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = sniffImageExt(buffer);
    if (!ext) return null;

    return { buffer, ext };
}

export const ATTACHMENT_ALLOWED_EXTENSIONS = new Set(['pdf', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp']);

/**
 * Sanitizes an attachment filename: strips any path component, keeps only
 * safe characters, and enforces the extension whitelist.
 * Returns null if the resulting name/extension is not acceptable.
 */
export function sanitizeAttachmentFilename(originalName: string): string | null {
    // Strip any path components (multipart filenames can contain / or \)
    const base = originalName.split(/[/\\]/).pop() ?? '';

    const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned === '.' || cleaned === '..') return null;

    const ext = cleaned.split('.').pop()?.toLowerCase();
    if (!ext || ext === cleaned.toLowerCase() || !ATTACHMENT_ALLOWED_EXTENSIONS.has(ext)) return null;

    // Keep the name reasonably short
    return cleaned.length > 120 ? cleaned.slice(-120) : cleaned;
}
