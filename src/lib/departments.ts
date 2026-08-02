/** Valor de la opcion "todos/todas" en los selects de departamento y clase. */
export const ALL_VALUE = "all";

export const formatDepartmentName = (name?: string) =>
  name ? name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "";
