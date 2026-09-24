import { describe, it, expect, beforeEach } from "vitest";
import {
  isCustomRole,
  getActiveCustomRole,
  ACTIVE_CUSTOM_ROLE_KEY,
  rolesOf,
  hasPermission,
} from "./rolePermissions";

beforeEach(() => localStorage.clear());

describe("isCustomRole", () => {
  it("reconoce el prefijo que pone el back", () => {
    expect(isCustomRole("custom_contador")).toBe(true);
    expect(isCustomRole("maestro")).toBe(false);
  });
});

describe("getActiveCustomRole", () => {
  it("devuelve null si no hay ninguno activo", () => {
    expect(getActiveCustomRole({ roles: ["custom_contador"] })).toBeNull();
  });

  it("devuelve el activo solo si el perfil todavía lo tiene", () => {
    localStorage.setItem(ACTIVE_CUSTOM_ROLE_KEY, "custom_contador");
    expect(getActiveCustomRole({ roles: ["custom_contador"] })).toBe("custom_contador");
    expect(getActiveCustomRole({ roles: ["maestro"] })).toBeNull();
    expect(getActiveCustomRole(null)).toBeNull();
  });
});

describe("rolesOf", () => {
  it("usa el rol primario cuando no hay array de roles", () => {
    expect(rolesOf({ role: "maestro" })).toEqual(["maestro"]);
    expect(rolesOf({ role: "maestro", roles: [] })).toEqual(["maestro"]);
  });

  it("prioriza el array de roles sobre el primario", () => {
    expect(rolesOf({ role: "miembro", roles: ["maestro", "lider"] })).toEqual(["maestro", "lider"]);
  });

  it("sin perfil devuelve lista vacía", () => {
    expect(rolesOf(null)).toEqual([]);
    expect(rolesOf({})).toEqual([]);
  });

  it("un rol propio SIN departamento es global y siempre cuenta", () => {
    expect(rolesOf({ roles: ["maestro", "custom_contador"] })).toEqual(["maestro", "custom_contador"]);
  });

  it("un rol propio atado a un departamento no cuenta si no es el activo", () => {
    const profile = {
      roles: ["maestro", "custom_contador"],
      assignments: [{ role: "custom_contador", department: "jovenes" }],
    };
    expect(rolesOf(profile)).toEqual(["maestro"]);
  });

  it("al activar un rol propio, los demás roles propios quedan afuera", () => {
    localStorage.setItem(ACTIVE_CUSTOM_ROLE_KEY, "custom_contador");
    const profile = {
      roles: ["maestro", "custom_contador", "custom_tesorero"],
      assignments: [
        { role: "custom_contador", department: "jovenes" },
        { role: "custom_tesorero", department: "ninos" },
      ],
    };
    expect(rolesOf(profile)).toEqual(["maestro", "custom_contador"]);
  });
});

describe("hasPermission", () => {
  it("resuelve contra los permisos por defecto del rol", () => {
    expect(hasPermission({ role: "admin" }, "menu_configuracion")).toBe(true);
    expect(hasPermission({ role: "maestro" }, "menu_configuracion")).toBe(false);
  });

  it("lo guardado por la empresa gana sobre el default, en ambos sentidos", () => {
    expect(hasPermission({ role: "maestro" }, "menu_configuracion", { maestro: { menu_configuracion: true } })).toBe(true);
    expect(hasPermission({ role: "admin" }, "menu_configuracion", { admin: { menu_configuracion: false } })).toBe(false);
  });

  it("si la key no está guardada para ese rol, cae al default", () => {
    expect(hasPermission({ role: "admin" }, "menu_configuracion", { admin: { menu_archivo: false } })).toBe(true);
  });

  it("alcanza con que uno de los roles del perfil tenga el permiso", () => {
    expect(hasPermission({ roles: ["maestro", "admin"] }, "menu_configuracion")).toBe(true);
  });

  it("un rol desconocido no habilita nada", () => {
    expect(hasPermission({ role: "rol_inventado" }, "menu_configuracion")).toBe(false);
    expect(hasPermission(null, "menu_configuracion")).toBe(false);
  });
});
