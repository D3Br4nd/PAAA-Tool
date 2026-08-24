export const DEFAULT_PLAYER_ACCOUNTS_PER_TEAM = 5;
export const MIN_PLAYER_ACCOUNTS_PER_TEAM = 3;
export const MAX_PLAYER_ACCOUNTS_PER_TEAM = 5;
export const PLAYER_USERNAME_MIN_LENGTH = 3;
export const PLAYER_USERNAME_MAX_LENGTH = 32;

export function normalizePlayerAccountCount(value: unknown): number | null {
  const count =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+$/.test(value.trim())
        ? Number(value.trim())
        : Number.NaN;

  return Number.isInteger(count) &&
    count >= MIN_PLAYER_ACCOUNTS_PER_TEAM &&
    count <= MAX_PLAYER_ACCOUNTS_PER_TEAM
    ? count
    : null;
}

export function normalizePlayerUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidPlayerUsername(value: string): boolean {
  return (
    value.length >= PLAYER_USERNAME_MIN_LENGTH &&
    value.length <= PLAYER_USERNAME_MAX_LENGTH &&
    /^[a-z0-9][a-z0-9._-]*$/.test(value)
  );
}

export function playerSlotUsername(joinCode: string, slot: number): string {
  const base = joinCode
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, PLAYER_USERNAME_MAX_LENGTH - 2);

  return `${base || "team"}-${slot}`;
}

export function playerSlotName(joinCode: string, slot: number): string {
  const teamCode = joinCode.trim().toUpperCase() || "SQUADRA";
  return `${teamCode}-${String(slot).padStart(2, "0")}`;
}
