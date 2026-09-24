import { describe, it, expect } from "vitest";
import { formatDepartmentName, sinDepartamento, esSoloCongregacion } from "./departments";

describe("formatDepartmentName", () => {
  it("reemplaza guiones bajos y capitaliza cada palabra", () => {
    expect(formatDepartmentName("escuela_dominical")).toBe("Escuela Dominical");
    expect(formatDepartmentName("jovenes")).toBe("Jovenes");
  });

  it("devuelve string vacío si no hay nombre", () => {
    expect(formatDepartmentName()).toBe("");
  });
});

describe("sinDepartamento", () => {
  it("es true cuando no hay asignaciones ni departamento suelto", () => {
    expect(sinDepartamento({ dept_assignments: [], department: null, department_id: null } as never)).toBe(true);
    expect(sinDepartamento({} as never)).toBe(true);
  });

  it("es false si tiene al menos una asignación", () => {
    expect(sinDepartamento({ dept_assignments: [{ department_id: "d1" }] } as never)).toBe(false);
  });

  it("es false si tiene department_id o department sueltos (fichas viejas)", () => {
    expect(sinDepartamento({ department_id: "d1" } as never)).toBe(false);
    expect(sinDepartamento({ department: "jovenes" } as never)).toBe(false);
  });
});

describe("esSoloCongregacion", () => {
  it("es true sin departamento y sin grupo pequeño", () => {
    expect(esSoloCongregacion({ small_groups_count: 0 } as never)).toBe(true);
    expect(esSoloCongregacion({} as never)).toBe(true);
  });

  it("es false si participa de un grupo pequeño", () => {
    expect(esSoloCongregacion({ small_groups_count: 1 } as never)).toBe(false);
  });

  it("es false si tiene departamento", () => {
    expect(esSoloCongregacion({ department_id: "d1", small_groups_count: 0 } as never)).toBe(false);
  });
});
