import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";

// Flag por empresa (companies.baptized_enabled) que muestra/oculta el campo
// "bautizado" en toda la app. Default: habilitado.
export function useBaptizedEnabled(): boolean {
  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });
  return (company as any)?.baptized_enabled !== false;
}
