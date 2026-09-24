import { describe, it, expect } from "vitest";
import { canManageSuspensions, canSuspendTarget } from "./suspension";

// Estas reglas son el espejo del guard de ccdt-back (profilesController.suspensionRejection).
// La UI solo habilita/deshabilita controles; la verdad la tiene el backend.
const admin = { id: "u-admin", role: "admin" };
const director = { id: "u-dir", role: "director", departments: ["jovenes"], department_id: "d-jov" };

describe("canManageSuspensions", () => {
  it("lo permite a los roles globales y de departamento", () => {
    ["admin", "secretaria", "director", "vicedirector", "director_general"].forEach((r) =>
      expect(canManageSuspensions(r)).toBe(true)
    );
  });

  it("lo niega al resto y a los valores ausentes", () => {
    ["maestro", "lider", "conserje", "miembro"].forEach((r) =>
      expect(canManageSuspensions(r)).toBe(false)
    );
    expect(canManageSuspensions(null)).toBe(false);
    expect(canManageSuspensions(undefined)).toBe(false);
  });
});

describe("canSuspendTarget", () => {
  it("un admin puede suspender a un maestro de cualquier departamento", () => {
    expect(canSuspendTarget(admin, { id: "u-1", role: "maestro", departments: ["ninos"] })).toBe(true);
  });

  it("nadie puede suspender a admin, secretaría ni system_admin", () => {
    ["admin", "secretaria", "system_admin"].forEach((role) =>
      expect(canSuspendTarget(admin, { id: "u-2", role })).toBe(false)
    );
  });

  it("nadie puede suspenderse a sí mismo", () => {
    expect(canSuspendTarget(admin, { id: admin.id, role: "admin" })).toBe(false);
    expect(canSuspendTarget(director, { id: director.id, role: "director" })).toBe(false);
  });

  it("un rol sin permiso de gestión no puede suspender a nadie", () => {
    expect(canSuspendTarget({ id: "u-m", role: "maestro" }, { id: "u-1", role: "lider" })).toBe(false);
  });

  it("sin target válido devuelve false", () => {
    expect(canSuspendTarget(admin, { id: "", role: "maestro" })).toBe(false);
  });

  it("un director puede suspender dentro de su departamento", () => {
    expect(canSuspendTarget(director, { id: "u-1", role: "maestro", departments: ["jovenes"] })).toBe(true);
  });

  it("un director NO puede suspender fuera de su departamento", () => {
    expect(canSuspendTarget(director, { id: "u-1", role: "maestro", departments: ["ninos"] })).toBe(false);
  });

  it("un director alcanza con compartir department_id aunque no compartan nombre", () => {
    expect(
      canSuspendTarget(director, { id: "u-1", role: "maestro", departments: [], department_id: "d-jov" })
    ).toBe(true);
  });

  it("un director no puede suspender a sus pares", () => {
    ["director", "vicedirector", "director_general"].forEach((role) =>
      expect(canSuspendTarget(director, { id: "u-1", role, departments: ["jovenes"] })).toBe(false)
    );
  });

  it("un admin sí puede suspender a un director (no es par suyo)", () => {
    expect(canSuspendTarget(admin, { id: "u-1", role: "director", departments: ["jovenes"] })).toBe(true);
  });
});
