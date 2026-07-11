
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthorizationOption from "@/components/AuthorizationOption";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { DEFAULT_PERMISSIONS } from "@/lib/rolePermissions";
import { generateBlankFichaSalud } from "@/lib/pdfUtils";
import { isDemoMode } from "@/lib/demo";
import { FileText, HelpCircle } from "lucide-react";
import { TourGuide } from "@/components/TourGuide";
import type { Step } from "react-joyride";

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

  const handleDownloadFicha = () => {
    if (isDemoMode()) {
      toast({
        title: "Ficha de Salud",
        description: "En el modo demo no se descargan documentos.",
      });
      return;
    }
    try {
      generateBlankFichaSalud(company);
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
      const authorized = savedPerms && 'menu_autorizaciones' in savedPerms
        ? savedPerms.menu_autorizaciones !== false
        : DEFAULT_PERMISSIONS[role]?.menu_autorizaciones !== false;
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-12">
      <TourGuide tourKey="autorizaciones_salida" steps={tourSteps} run={runTour} onClose={() => setRunTour(false)} />

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div data-tour="aut-header" className="relative overflow-hidden bg-gradient-to-br from-purple-700 via-pink-600 to-rose-600 px-6 md:px-10 pt-10 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        </div>
        <div className="relative z-10 max-w-[1600px] mx-auto flex items-end justify-between gap-4">
          <div>
            <p className="text-pink-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Documentos</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
              Autorizaciones
            </h1>
            <p className="text-pink-200 mt-2 text-sm font-medium">
              Generá y gestioná las autorizaciones para las distintas actividades.
            </p>
          </div>
          <button
            onClick={() => setRunTour(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm transition-all"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Ayuda
          </button>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 -mt-8 pb-28">
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
      </div>
    </div>
  );
};

export default AutorizacionesSalida;
