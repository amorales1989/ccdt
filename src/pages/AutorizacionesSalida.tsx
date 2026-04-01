
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
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Autorizaciones</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Generá y gestioná las autorizaciones para las distintas actividades.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
