import { useQuery } from "@tanstack/react-query";
import { getCompanyRoles, type CompanyRole } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { BUILTIN_ROLES, BUILTIN_ROLE_LABELS } from "@/lib/rolePermissions";

export interface RoleOption {
  key: string;
  label: string;
  /** true = creado por la empresa (editable/eliminable desde Configuración). */
  custom: boolean;
  /** Solo en los custom: id de la fila en company_roles. */
  id?: string;
}

/** Roles disponibles para la empresa: los 12 del sistema + los creados desde Configuración.
 *  Único lugar donde la UI resuelve la etiqueta de un rol. */
export function useRoles() {
  const { data: customRoles = [], isLoading } = useQuery<CompanyRole[]>({
    queryKey: ["company-roles", getPersistentCompanyId()],
    queryFn: getCompanyRoles,
    staleTime: 5 * 60 * 1000,
  });

  const custom: RoleOption[] = customRoles.map(r => ({
    key: r.key, label: r.label, custom: true, id: r.id,
  }));

  const builtin: RoleOption[] = BUILTIN_ROLES.map(key => ({
    key, label: BUILTIN_ROLE_LABELS[key] || key, custom: false,
  }));

  const roles = [...builtin, ...custom];
  const labelOf = (key: string) => roles.find(r => r.key === key)?.label || key;

  return { roles, builtin, custom, labelOf, isLoading };
}
