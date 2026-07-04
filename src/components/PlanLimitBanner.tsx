import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { getCompany, getMemberCount } from "@/lib/api";
import { effectiveLimit, PLAN_WARN_RATIO } from "@/lib/plans";
import { useAuth } from "@/contexts/AuthContext";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { isDemoMode } from "@/lib/demo";

export function PlanLimitBanner() {
  const { profile } = useAuth();
  const companyId = getPersistentCompanyId();

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    enabled: !!profile && (profile.role === "admin" || profile.role === "secretaria"),
  });

  const { data: total } = useQuery({
    queryKey: ["member-count"],
    queryFn: getMemberCount,
    enabled: !!profile && (profile.role === "admin" || profile.role === "secretaria"),
  });

  if (!profile || isDemoMode()) return null;
  if (profile.role !== "admin" && profile.role !== "secretaria") return null;

  const limit = effectiveLimit(company?.plan, company?.extra_member_packs);
  if (limit == null || total == null) return null;

  if (total >= limit) {
    return (
      <div className="relative z-20 mb-4 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Alcanzaste el límite de tu plan ({total}/{limit} miembros). Ampliá tu plan para seguir agregando miembros o contactá al administrador.
        </span>
      </div>
    );
  }

  if (total >= Math.floor(limit * PLAN_WARN_RATIO)) {
    return (
      <div className="relative z-20 mb-4 w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Estás llegando al límite de tu plan ({total}/{limit} miembros).
        </span>
      </div>
    );
  }

  return null;
}
