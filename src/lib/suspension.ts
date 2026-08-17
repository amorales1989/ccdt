import type { AppRole } from "@/types/database";

type SuspensionActor = {
  id?: string;
  role?: AppRole | string;
  departments?: string[] | null;
  department_id?: string | null;
};

type SuspensionTarget = {
  id: string;
  role: string;
  departments?: string[] | null;
  department_id?: string | null;
};

// Espejo del guard de ccdt-back (profilesController.suspensionRejection). Se usa SOLO para
// habilitar/deshabilitar controles en la UI: la verdad la tiene el backend.
const GLOBAL_MANAGERS: string[] = ["admin", "secretaria"];
const DEPT_MANAGERS: string[] = ["director", "vicedirector", "director_general"];
const NEVER_SUSPENDABLE: string[] = ["admin", "secretaria", "system_admin"];
const PEER_ROLES: string[] = ["director", "vicedirector", "director_general"];

export const canManageSuspensions = (actorRole?: AppRole | string | null) =>
  !!actorRole && (GLOBAL_MANAGERS.includes(actorRole) || DEPT_MANAGERS.includes(actorRole));

export const canSuspendTarget = (
  actor: SuspensionActor | null | undefined,
  target: SuspensionTarget
): boolean => {
  const actorRole = actor?.role;
  if (!canManageSuspensions(actorRole)) return false;
  if (!target?.id || target.id === actor?.id) return false;
  if (NEVER_SUSPENDABLE.includes(target.role)) return false;

  if (DEPT_MANAGERS.includes(actorRole as string)) {
    if (PEER_ROLES.includes(target.role)) return false;
    const actorDepts = actor?.departments || [];
    const targetDepts = target.departments || [];
    const sharesName = targetDepts.some((d) => actorDepts.includes(d));
    const sharesId = !!actor?.department_id && target.department_id === actor.department_id;
    if (!sharesName && !sharesId) return false;
  }
  return true;
};
