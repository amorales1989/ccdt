
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthorizationOption from "@/components/AuthorizationOption";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { DEFAULT_PERMISSIONS, hasPermission, type SavedPermissions } from "@/lib/rolePermissions";
import { generateBlankFichaSalud } from "@/lib/pdfUtils";
import { isDemoMode } from "@/lib/demo";
import { FileText, HelpCircle } from "lucide-react";
import { TourGuide } from "@/components/TourGuide";
import type { Step } from "react-joyride";
import { FileOutput } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { PageHeader } from "@/components/PageHeader";

const AutorizacionesSalida = () => {
  const { profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [runTour, setRunTour] = useState<boolean | undefined>(undefined);
  const tourSteps: Step[] = [
    { target: '[data-tour="aut-header"]', content: "Acá generás autorizaciones para campamentos, salidas, y descargás la ficha de salud.", disableBeacon: true },
    { target: '[data-tour="aut-opciones"]', content: "Elegí el tipo de documento que necesitás generar." },
  ];
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId())
  });

  const handleDownloadFicha = async () => {
    if (isDemoMode()) {
      toast({
        title: "Ficha de Salud",
        description: "En el modo demo no se descargan documentos.",
      });
      return;
    }
    try {
      await generateBlankFichaSalud(company);
      toast({
        title: "Ficha de Salud",
        description: "La ficha en blanco se ha descargado correctamente."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo generar la ficha de salud.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // Esperar a que cargue company para no evaluar permisos con datos incompletos.
    if (profile && company !== undefined) {
      // Permiso configurable desde Configuración › Permisos (role_permissions),
      // con fallback a los permisos por defecto del rol.
      const role = profile.role || '';
      const savedPerms = (company as any)?.role_permissions?.[role];
      const authorized = (savedPerms && 'menu_autorizaciones' in savedPerms
        ? savedPerms.menu_autorizaciones !== false
        : DEFAULT_PERMISSIONS[role]?.menu_autorizaciones !== false)
        // Roles propios de la empresa: viven en profiles.roles, no en profile.role.
        || hasPermission(profile, 'menu_autorizaciones', (company as { role_permissions?: SavedPermissions } | undefined)?.role_permissions);
      setIsAuthorized(authorized);

      if (!authorized) {
        toast({
          title: "Acceso restringido",
          description: "No tienes permisos para acceder a esta sección",
          variant: "destructive"
        });
        navigate("/");
      }
    }
  }, [profile, company, navigate, toast]);

  if (!profile) {
    window.location.href = '/';
    return;
  }

  return (
    <PageShell>
      <TourGuide tourKey="autorizaciones_salida" steps={tourSteps} run={runTour} onClose={() => setRunTour(false)} />

      <PageHeader
        data-tour="aut-header"
        title="Autorizaciones"
        subtitle="Generá y gestioná las autorizaciones para las distintas actividades."
        icon={FileOutput}
      />

        <div data-tour="aut-opciones" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AuthorizationOption
            title="Autorización de Campamento"
            description="Genera autorizaciones para campamentos"
            icon="tent"
            route="/autorizaciones/campamento"
          />
          <AuthorizationOption
            title="Autorización de Salidas"
            description="Genera autorizaciones para salidas"
            icon="signpost"
            route="/autorizaciones/simple"
          />
          <AuthorizationOption
            title="Ficha de Salud"
            description="Descarga la ficha médica para completar a mano"
            icon="heart"
            onClick={handleDownloadFicha}
          />
        </div>
    </PageShell>
  );
};

export default AutorizacionesSalida;
