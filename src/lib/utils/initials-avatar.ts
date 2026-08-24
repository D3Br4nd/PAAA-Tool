/**
 * Local initials-avatar generator (replaces DiceBear).
 * Works on both server and client: produces a self-contained SVG with the
 * initials of the given seed on a deterministic colored background.
 * No external requests, no user-controlled markup (everything is escaped).
 */

const PALETTE = [
    '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
    '#3498db', '#9b59b6', '#34495e', '#16a085', '#d35400',
    '#8e44ad', '#2c3e50', '#27ae60', '#2980b9', '#c0392b'
];

function hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function initialsFromSeed(seed: string): string {
    const words = seed
        .replace(/[._@-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

export function initialsAvatarSvg(seed: string): string {
    const safeSeed = seed || 'default';
    const color = PALETTE[hashSeed(safeSeed) % PALETTE.length];
    const initials = escapeXml(initialsFromSeed(safeSeed));

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
        `<rect width="100" height="100" fill="${color}"/>` +
        `<text x="50" y="50" dy="0.36em" text-anchor="middle" ` +
        `font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="600" fill="#ffffff">` +
        `${initials}</text></svg>`;
}

export function initialsAvatarDataUri(seed: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(initialsAvatarSvg(seed))}`;
}
