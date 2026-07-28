import { Headset } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { planLabel } from "@/lib/plans";
import { CustomTooltip } from "@/components/CustomTooltip";

// Soporte directo al desarrollador por WhatsApp, solo para admin y secretaría.
// El link lo arma el front, así que sigue funcionando aunque el API bloquee a la
// empresa por suscripción vencida (que es justo cuando más van a necesitar escribir).
const SUPPORT_NUMBER = import.meta.env.VITE_WHATSAPP_SOPORTE || "5491126502011";

export function SupportButton() {
  const { profile } = useAuth();
  const location = useLocation();
  const companyId = getPersistentCompanyId();

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  if (profile?.role !== "admin" && profile?.role !== "secretaria") return null;

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const congregation = (company as { congregation_name?: string; name?: string })?.congregation_name
    || (company as { name?: string })?.name
    || `Empresa #${companyId}`;
  const plan = planLabel((company as { plan?: string })?.plan);

  const message = `Hola, soy ${name || "un usuario"} (${profile.role}) de ${congregation}.\n`
    + `Empresa #${companyId}${plan ? ` · Plan ${plan}` : ""} · Pantalla: ${location.pathname}\n\n`
    + `Consulta: `;
  const url = `https://wa.me/${SUPPORT_NUMBER}?text=${encodeURIComponent(message)}`;

  return (
    <CustomTooltip title="Soporte técnico por WhatsApp">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
      >
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Soporte técnico">
          <Headset className="h-5 w-5" />
        </a>
      </Button>
    </CustomTooltip>
  );
}
