
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getEnvironment, switchEnvironment } from "@/lib/envUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Secretaria = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [currentEnv, setCurrentEnv] = useState<string>("development");
  
  useEffect(() => {
    // Fetch the current environment when the component mounts
    const fetchEnvironment = async () => {
      const env = await getEnvironment();
      setCurrentEnv(env);
    };
    
    fetchEnvironment();
  }, []);

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
  
  // Function to handle environment change
  const handleEnvironmentChange = async (value: string) => {
    if (value === currentEnv) return;
    
    setIsLoading(true);
    try {
      const success = await switchEnvironment(value as 'development' | 'production');
      if (success) {
        setCurrentEnv(value);
        toast({
          title: 'Entorno cambiado',
          description: `Ahora estás en el entorno de ${value === 'development' ? 'desarrollo' : 'producción'}`,
          variant: 'success'
        });
      } else {
        toast({
          title: 'Error',
          description: 'No se pudo cambiar el entorno',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error changing environment:', error);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al cambiar el entorno',
        variant: 'destructive'
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
          
          {/* Environment selector for admins */}
          {profile?.role === 'admin' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Entorno de Base de Datos</label>
              <Select defaultValue={currentEnv} onValueChange={handleEnvironmentChange} disabled={isLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar entorno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Desarrollo</SelectItem>
                  <SelectItem value="production">Producción</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Entorno actual: {currentEnv === 'development' ? 'Desarrollo' : 'Producción'}
              </p>
            </div>
          )}
          
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
