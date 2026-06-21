import { describe, it, expect, afterEach } from "vitest";
import { GameConfig } from "./GameConfig";

describe("GameConfig.difficulty (DifficultyScaler)", () => {
  afterEach(() => {
    GameConfig.playerCount = 2;
  });

  it("4 jogadores = dificuldade plena (multiplicadores 1)", () => {
    GameConfig.playerCount = 4;
    expect(GameConfig.difficulty).toEqual({ spawnRate: 1, timer: 1, objective: 1 });
  });

  it("2 jogadores = mais fácil (menos objetivo, mais tempo, spawn lento)", () => {
    GameConfig.playerCount = 2;
    const d = GameConfig.difficulty;
    expect(d.objective).toBeLessThan(1);
    expect(d.timer).toBeGreaterThan(1);
    expect(d.spawnRate).toBeLessThan(1);
  });

  it("3 jogadores fica entre 2 e 4", () => {
    GameConfig.playerCount = 3;
    const d3 = GameConfig.difficulty;
    GameConfig.playerCount = 2;
    const d2 = GameConfig.difficulty;
    expect(d3.objective).toBeGreaterThan(d2.objective);
    expect(d3.objective).toBeLessThan(1);
    expect(d3.spawnRate).toBeGreaterThan(d2.spawnRate);
  });

  it("contagens fora do previsto caem no padrão (dificuldade plena)", () => {
    GameConfig.playerCount = 1;
    expect(GameConfig.difficulty).toEqual({ spawnRate: 1, timer: 1, objective: 1 });
  });
});

describe("GameConfig.reset", () => {
  it("limpa players e lastResult", () => {
    GameConfig.players = [{ index: 0, charId: "sirius", inputKind: "keyboard-wasd" }];
    GameConfig.lastResult = {
      phaseName: "x",
      win: true,
      stars: 3,
      collected: 1,
      goal: 1,
      destruction: 0,
    };
    GameConfig.reset();
    expect(GameConfig.players).toEqual([]);
    expect(GameConfig.lastResult).toBeNull();
  });
});
