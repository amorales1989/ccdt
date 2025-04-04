
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Secretaria = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // Redirect if not admin or secretaria
  if (profile?.role !== 'admin' && profile?.role !== 'secretaria') {
    navigate('/');
    return null;
  }

  // Add a function to update all user department IDs
  const updateAllUserDepartmentIds = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'updateDepartmentIds' }
      });

      if (error) {
        console.error('Error updating department IDs:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron actualizar los IDs de departamentos',
          variant: 'destructive'
        });
        return;
      }

      console.log('Department IDs update results:', data);
      toast({
        title: 'Actualización completada',
        description: 'Los IDs de departamentos han sido actualizados para todos los usuarios'
      });
    } catch (error) {
      console.error('Error in updateAllUserDepartmentIds:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al actualizar los IDs de departamentos'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Panel de Secretaria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Bienvenido, {profile?.first_name}!</p>
          
          <Button onClick={() => navigate("/agregar-alumno")} className="w-full">
            Agregar Alumno
          </Button>
          <Button onClick={() => navigate("/listar-alumnos")} className="w-full">
            Listar Alumnos
          </Button>
          <Button onClick={() => navigate("/attendance")} className="w-full">
            Gestionar Asistencia
          </Button>
          <Button onClick={() => navigate("/eventos")} className="w-full">
            Gestionar Eventos
          </Button>
          {(profile?.role === 'admin' || profile?.role === 'secretaria') && (
            <>
              <Button onClick={() => navigate("/gestion-usuarios")} className="w-full">
                Gestión de Usuarios
              </Button>
              <Button onClick={() => navigate("/departamentos")} className="w-full">
                Gestionar Departamentos
              </Button>
              <Button 
                onClick={updateAllUserDepartmentIds} 
                disabled={isLoading} 
                variant="outline" 
                className="w-full mb-4">
                {isLoading ? "Actualizando..." : "Actualizar IDs de departamentos para todos los usuarios"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Secretaria;
