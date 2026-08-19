import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Motivos de baja. El valor es lo que se guarda en students.deleted_reason y en la bitácora,
// así que no cambiarlo una vez que hay datos: se rompería el filtro del archivo.
export const MOTIVOS_BAJA = [
  { value: "mudanza", label: "Se mudó" },
  { value: "dejo_de_asistir", label: "Dejó de asistir" },
  { value: "cambio_iglesia", label: "Se cambió de congregación" },
  { value: "fallecimiento", label: "Falleció" },
  { value: "duplicado", label: "Ficha duplicada o cargada por error" },
  { value: "otro", label: "Otro" },
] as const;

export const labelMotivo = (value?: string | null) =>
  MOTIVOS_BAJA.find(m => m.value === value)?.label || null;

interface BajaMiembroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string, nota: string | null) => void;
  memberName?: string;
  isLoading?: boolean;
}

export const BajaMiembroDialog: React.FC<BajaMiembroDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  memberName,
  isLoading = false,
}) => {
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");

  useEffect(() => {
    if (open) { setMotivo(""); setNota(""); }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {memberName ? `Dar de baja a ${memberName}` : "Dar de baja al miembro"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Deja de aparecer en las listas, pero su ficha y su historial quedan archivados
            por si vuelve más adelante.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="motivo-baja">Motivo <span className="text-destructive">*</span></Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger id="motivo-baja">
                <SelectValue placeholder="Elegí un motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_BAJA.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nota-baja">Detalle (opcional)</Label>
            <Textarea
              id="nota-baja"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ej: se mudó a Córdoba por trabajo"
              rows={2}
            />
          </div>
        </div>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm(motivo, nota.trim() || null);
            }}
            disabled={isLoading || !motivo}
            className="bg-destructive hover:bg-destructive/90 text-white"
          >
            {isLoading ? "Dando de baja..." : "Dar de baja"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
