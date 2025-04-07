
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const Notificaciones = () => {
  const { toast } = useToast();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Notificaciones</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Centro de Notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No tienes notificaciones nuevas. Las notificaciones aparecerán aquí cuando estén disponibles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Notificaciones;
