
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthorizationOption from "@/components/AuthorizationOption";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { generateBlankFichaSalud } from "@/lib/pdfUtils";

const AutorizacionesSalida = () => {
  const { profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => getCompany(1)
  });

  const handleDownloadFicha = () => {
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
    if (profile) {
      const authorized = profile.role === 'admin' || profile.role === 'secretaria' || profile.role === 'lider';
      setIsAuthorized(authorized);

      if (!authorized) {
        console.log("User not authorized:", profile.role);
        toast({
          title: "Acceso restringido",
          description: "No tienes permisos para acceder a esta sección",
          variant: "destructive"
        });
        navigate("/");
      }
    }
  }, [profile, navigate, toast]);

  if (!profile) {
    window.location.href = '/';
    return;
  }

  return (
    <div className="animate-fade-in space-y-8 pb-8 p-4 md:p-6">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl max-w-7xl mx-auto">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8 border-b border-purple-200/60 dark:border-slate-700/60 pb-6">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M12 18v-6" /><path d="m9 15 3 3 3-3" /></svg>
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Autorizaciones</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Generá y gestioná las autorizaciones para las distintas actividades.
              </p>
            </div>
          </div>
        </div>
      </section>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
