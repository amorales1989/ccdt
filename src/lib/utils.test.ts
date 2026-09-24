import { describe, it, expect } from "vitest";
import { normalizeName, formatDni } from "./utils";

describe("normalizeName", () => {
  it("recorta y colapsa espacios", () => {
    expect(normalizeName("  juan   carlos  ")).toBe("Juan Carlos");
  });

  it("pone cada palabra en capital y el resto en minúscula", () => {
    expect(normalizeName("JUAN perez")).toBe("Juan Perez");
  });

  it("respeta los acentos del español", () => {
    expect(normalizeName("MARÍA josé")).toBe("María José");
  });

  it("preserva apellidos compuestos con guión", () => {
    expect(normalizeName("perez-garcía")).toBe("Perez-García");
  });

  it("preserva apellidos con apóstrofe", () => {
    expect(normalizeName("o'connor")).toBe("O'Connor");
  });

  it("devuelve string vacío para valores ausentes", () => {
    expect(normalizeName()).toBe("");
    expect(normalizeName(null)).toBe("");
    expect(normalizeName("")).toBe("");
  });
});

describe("formatDni", () => {
  it("agrupa los dígitos de a miles con puntos", () => {
    expect(formatDni("50846091")).toBe("50.846.091");
    expect(formatDni("1234")).toBe("1.234");
  });

  it("no agrega puntos si no llega a mil", () => {
    expect(formatDni("123")).toBe("123");
  });

  it("re-formatea un documento que ya venía con puntos", () => {
    expect(formatDni("12.345.678")).toBe("12.345.678");
  });

  it("devuelve el valor original si no tiene dígitos", () => {
    expect(formatDni("sin datos")).toBe("sin datos");
  });

  it("devuelve string vacío para valores ausentes", () => {
    expect(formatDni()).toBe("");
    expect(formatDni(null)).toBe("");
  });
});
