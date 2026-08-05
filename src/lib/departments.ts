import type { Student } from "@/types/database";

/** Valor de la opcion "todos/todas" en los selects de departamento y clase. */
export const ALL_VALUE = "all";

export const formatDepartmentName = (name?: string) =>
  name ? name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "";

/** Valor del filtro/select "Sin departamento" (solo congregacion). */
export const SIN_DEPARTAMENTO = "__none__";

/** Los campos que miran los predicados de abajo. Estructural a proposito: Home.tsx
 *  trabaja con una proyeccion reducida de Student, no con el objeto completo. */
type ScopeDepartamento = Pick<Student, "department" | "department_id" | "dept_assignments">
  & { small_groups_count?: number };

/** Miembro sin ningun departamento asignado. Incluye a los que solo estan en un
 *  grupo pequeño: para excluirlos usar esSoloCongregacion. */
export const sinDepartamento = (s: ScopeDepartamento) =>
  (s.dept_assignments?.length ?? 0) === 0 && !s.department_id && !s.department;

/** Miembro que asiste a la congregacion pero no esta en ningun departamento, clase
 *  ni grupo pequeño. No aparece en asistencia ni cobertura, pero cuenta para el
 *  limite de miembros del plan. `small_groups_count` lo calcula el SP get_students. */
export const esSoloCongregacion = (s: ScopeDepartamento) =>
  sinDepartamento(s) && (s.small_groups_count ?? 0) === 0;
