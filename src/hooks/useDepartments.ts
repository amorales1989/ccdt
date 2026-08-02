import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { getDepartments } from "@/lib/api";
import { Department, DepartmentType, Profile } from "@/types/database";

/** Roles que ven todos los departamentos de la empresa. */
const GLOBAL_ROLES = ["admin", "secretaria", "system_admin"];

const hasGlobalScope = (profile?: Profile | null) =>
  Boolean(profile && (GLOBAL_ROLES.includes(profile.role) || profile.roles?.some(r => GLOBAL_ROLES.includes(r))));

/**
 * Departamentos que el perfil puede ver: por nombre (profile.departments),
 * por department_id, o por sus asignaciones.
 */
export const scopeDepartments = (departments: Department[], profile?: Profile | null): Department[] => {
  if (!profile) return [];
  if (hasGlobalScope(profile)) return departments;

  return departments.filter(dept =>
    profile.departments?.includes(dept.name as DepartmentType) ||
    dept.id === profile.department_id ||
    profile.assignments?.some(a => a.department_id === dept.id || a.department === dept.name)
  );
};

/**
 * Fuente unica de departamentos. Siempre filtrados por empresa (ver getDepartments).
 * `scoped: true` deja solo los que el perfil tiene permitidos.
 */
export const useDepartments = ({ scoped = false }: { scoped?: boolean } = {}) => {
  const { profile } = useAuth();
  const companyId = getPersistentCompanyId();

  const { data = [], isLoading, error, refetch } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: getDepartments,
  });

  const departments = scoped ? scopeDepartments(data, profile) : data;

  return {
    departments,
    isLoading,
    error,
    refetch,
    getByName: (name?: string | null) => departments.find(d => d.name === name),
    getById: (id?: string | null) => departments.find(d => d.id === id),
  };
};
