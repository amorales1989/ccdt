import { describe, it, expect } from "vitest";
import { PLANS, PACK_SIZE, effectiveLimit, planLimit, planLabel, getPlan } from "./plans";

describe("catálogo de planes", () => {
  // Contrato compartido: el back tiene su propia copia en ccdt-Back/src/config/plans.js
  // con el mismo test. Si uno de los dos cambia, el otro falla.
  it("mantiene los límites acordados con el back", () => {
    expect(Object.fromEntries(PLANS.map((p) => [p.value, p.limit]))).toEqual({
      inicial: 100,
      estandar: 250,
      avanzado: 500,
      premium: 750,
      corporativo: null,
    });
    expect(PACK_SIZE).toBe(25);
  });

  it("resuelve plan, label y límite por value", () => {
    expect(getPlan("premium")?.label).toBe("Premium");
    expect(planLabel("estandar")).toBe("Estándar");
    expect(planLimit("avanzado")).toBe(500);
  });

  it("devuelve null para un plan inexistente o ausente", () => {
    expect(planLabel("no_existe")).toBeNull();
    expect(planLimit(null)).toBeNull();
    expect(getPlan(undefined)).toBeUndefined();
  });
});

describe("effectiveLimit", () => {
  it("suma PACK_SIZE miembros por cada pack", () => {
    expect(effectiveLimit("inicial", 0)).toBe(100);
    expect(effectiveLimit("inicial", 3)).toBe(175);
    expect(effectiveLimit("premium", 10)).toBe(1000);
  });

  it("corporativo queda ilimitado aunque tenga packs", () => {
    expect(effectiveLimit("corporativo", 5)).toBeNull();
  });

  it("plan desconocido o ausente no impone límite", () => {
    expect(effectiveLimit("no_existe", 2)).toBeNull();
    expect(effectiveLimit(null, 2)).toBeNull();
  });

  it("packs nulo o indefinido no rompe el cálculo", () => {
    expect(effectiveLimit("inicial", null)).toBe(100);
    expect(effectiveLimit("inicial")).toBe(100);
  });
});
