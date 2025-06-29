
import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";
import AuthorizationOption from "@/components/AuthorizationOption";

const AutorizacionesSalida = () => {
  const { profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Autorizaciones</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>
    </div>
  );
};

export default AutorizacionesSalida;
