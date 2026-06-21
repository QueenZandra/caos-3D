import { describe, it, expect, beforeEach } from "vitest";
import { Progress } from "./Progress";
import { TOTAL_PHASES } from "./Constants";

describe("Progress", () => {
  beforeEach(() => Progress.reset());

  it("começa com apenas a Fase 1 desbloqueada e sem estrelas", () => {
    expect(Progress.maxUnlocked).toBe(1);
    expect(Progress.isUnlocked(1)).toBe(true);
    expect(Progress.isUnlocked(2)).toBe(false);
    expect(Progress.isUnlocked(TOTAL_PHASES)).toBe(false);
    expect(Progress.totalStars()).toBe(0);
  });

  it("vencer desbloqueia a próxima fase e guarda as estrelas", () => {
    Progress.recordResult(1, true, 2);
    expect(Progress.getStars(1)).toBe(2);
    expect(Progress.isUnlocked(2)).toBe(true);
    expect(Progress.isUnlocked(3)).toBe(false);
  });

  it("mantém o melhor número de estrelas (não regride)", () => {
    Progress.recordResult(1, true, 3);
    Progress.recordResult(1, true, 1);
    expect(Progress.getStars(1)).toBe(3);
  });

  it("derrota registra estrelas mas não desbloqueia", () => {
    Progress.recordResult(2, false, 1);
    // fase 2 nem estava desbloqueada; derrota não avança o progresso
    expect(Progress.isUnlocked(2)).toBe(false);
    expect(Progress.isUnlocked(3)).toBe(false);
  });

  it("limita estrelas a 0..3", () => {
    Progress.recordResult(1, true, 9);
    expect(Progress.getStars(1)).toBe(3);
  });

  it("ignora fases fora do intervalo", () => {
    Progress.recordResult(0, true, 3);
    Progress.recordResult(TOTAL_PHASES + 1, true, 3);
    expect(Progress.totalStars()).toBe(0);
    expect(Progress.maxUnlocked).toBe(1);
  });

  it("não desbloqueia além da última fase ao vencê-la", () => {
    // desbloqueia tudo vencendo em sequência
    for (let p = 1; p <= TOTAL_PHASES; p++) Progress.recordResult(p, true, 3);
    expect(Progress.maxUnlocked).toBe(TOTAL_PHASES);
    expect(Progress.totalStars()).toBe(TOTAL_PHASES * 3);
  });

  it("totalStars soma as estrelas das fases", () => {
    Progress.recordResult(1, true, 3);
    Progress.recordResult(2, true, 2);
    expect(Progress.totalStars()).toBe(5);
  });
});
