import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { BibleReferencePicker } from "./BibleReferencePicker";

interface BibleReferenceMultiPickerProps {
  value?: string;
  onChange: (value: string) => void;
  // Avisa al padre si hay una cita empezada (libro seleccionado) que todavía no se agregó con "+".
  onPendingChange?: (pending: boolean) => void;
}

export function BibleReferenceMultiPicker({ value, onChange, onPendingChange }: BibleReferenceMultiPickerProps) {
  const [draft, setDraft] = useState("");
  const refs = (value || "").split(";").map((s) => s.trim()).filter(Boolean);
  const pending = !!draft.trim();

  useEffect(() => {
    onPendingChange?.(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const add = () => {
    const r = draft.trim();
    if (!r || refs.includes(r)) return;
    onChange([...refs, r].join("; "));
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(refs.filter((_, i) => i !== idx).join("; "));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <BibleReferencePicker value={draft} onChange={setDraft} />
        </div>
        <Button
          type="button"
          size="icon"
          variant={pending ? "default" : "outline"}
          className={`h-9 w-9 shrink-0 ${pending ? "animate-pulse" : ""}`}
          onClick={add}
          disabled={!pending}
          title="Agregar referencia"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {pending && (
        <p className="text-xs font-medium text-amber-600">
          Tocá <span className="font-bold">+</span> para agregar esta cita a la base bíblica.
        </p>
      )}
      {refs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {refs.map((r, i) => (
            <Badge key={`${r}-${i}`} variant="secondary" className="gap-1 font-medium">
              {r}
              <button type="button" onClick={() => remove(i)} className="hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
