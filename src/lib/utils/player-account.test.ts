import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PLAYER_ACCOUNTS_PER_TEAM,
  isValidPlayerUsername,
  normalizePlayerAccountCount,
  normalizePlayerUsername,
  playerSlotName,
  playerSlotUsername,
} from "./player-account";

describe("player accounts", () => {
  test("normalizza gli username per un accesso univoco", () => {
    expect(normalizePlayerUsername("  TEAM-ABC.1 ")).toBe("team-abc.1");
  });

  test("accetta solo username semplici e sicuri da comunicare", () => {
    expect(isValidPlayerUsername("rdx4k7m2-1")).toBe(true);
    expect(isValidPlayerUsername("ab")).toBe(false);
    expect(isValidPlayerUsername("nome squadra")).toBe(false);
    expect(isValidPlayerUsername("nome@email.it")).toBe(false);
  });

  test("accetta da tre a cinque account per squadra", () => {
    expect(DEFAULT_PLAYER_ACCOUNTS_PER_TEAM).toBe(5);
    expect(normalizePlayerAccountCount("3")).toBe(3);
    expect(normalizePlayerAccountCount("4")).toBe(4);
    expect(normalizePlayerAccountCount(5)).toBe(5);
    expect(normalizePlayerAccountCount("2")).toBeNull();
    expect(normalizePlayerAccountCount("6")).toBeNull();
    expect(normalizePlayerAccountCount("3.5")).toBeNull();
  });

  test("crea gli username dal codice squadra fino al quinto slot", () => {
    expect(playerSlotUsername("RDX4K7M2", 5)).toBe("rdx4k7m2-5");
  });

  test("crea i nomi predefiniti dal codice squadra con slot a due cifre", () => {
    expect(playerSlotName("RDX4K7M2", 1)).toBe("RDX4K7M2-01");
    expect(playerSlotName("rdx4k7m2", 5)).toBe("RDX4K7M2-05");
  });
});
