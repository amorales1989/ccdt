import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import {
  broadcastNotification,
  searchProfiles,
  type BroadcastPayload,
  type ProfileSearchResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, X, Search, Send } from "lucide-react";

type Channel = "push" | "whatsapp";
type TargetType = "department" | "class" | "role" | "people";

const ROLES = [
  { value: "lider", label: "Líder" },
  { value: "maestro", label: "Maestro" },
  { value: "colaborador", label: "Colaborador" },
  { value: "ayudante", label: "Ayudante" },
  { value: "director", label: "Director" },
  { value: "vicedirector", label: "Vicedirector" },
  { value: "secretaria", label: "Secretaria" },
  { value: "conserje", label: "Conserje" },
];

const Notificaciones = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Guard
  if (profile !== undefined && profile?.role !== "admin" && profile?.role !== "secretaria") {
    navigate("/");
    return null;
  }

  const [channel, setChannel] = useState<Channel>("push");
  const [targetType, setTargetType] = useState<TargetType>("department");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  // Department target
  const [departmentId, setDepartmentId] = useState("");

  // Class target
  const [classDeptId, setClassDeptId] = useState("");
  const [assignedClass, setAssignedClass] = useState("");

  // Role target
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Persons target
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<ProfileSearchResult[]>([]);
  const [selectedPersons, setSelectedPersons] = useState<ProfileSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [sending, setSending] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", getPersistentCompanyId()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("company_id", getPersistentCompanyId())
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Classes for selected class-dept
  const classDept = departments.find((d: any) => d.id === classDeptId);
  const availableClasses: string[] = classDept?.classes || [];

  // Reset class when dept changes
  useEffect(() => {
    setAssignedClass("");
  }, [classDeptId]);

  // Search profiles with debounce
  useEffect(() => {
    if (!personQuery.trim()) {
      setPersonResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchProfiles(personQuery);
        setPersonResults(results.filter((r) => !selectedPersons.find((p) => p.id === r.id)));
        setShowDropdown(true);
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personQuery, selectedPersons]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const addPerson = (person: ProfileSearchResult) => {
    setSelectedPersons((prev) => [...prev, person]);
    setPersonQuery("");
    setPersonResults([]);
    setShowDropdown(false);
  };

  const removePerson = (id: string) => {
    setSelectedPersons((prev) => prev.filter((p) => p.id !== id));
  };

  const validate = (): string | null => {
    if (channel === "push" && !title.trim()) return "El título es requerido para notificaciones push.";
    if (!message.trim()) return "El mensaje no puede estar vacío.";
    if (targetType === "department" && !departmentId) return "Seleccioná un departamento.";
    if (targetType === "class") {
      if (!classDeptId) return "Seleccioná un departamento para la clase.";
      if (!assignedClass) return "Seleccioná una clase.";
    }
    if (targetType === "role" && selectedRoles.length === 0) return "Seleccioná al menos un rol.";
    if (targetType === "people" && selectedPersons.length === 0) return "Agregá al menos una persona.";
    return null;
  };

  const handleSend = async () => {
    const error = validate();
    if (error) {
      toast({ title: "Validación", description: error, variant: "destructive" });
      return;
    }

    const target: BroadcastPayload["target"] = { type: targetType };
    if (targetType === "department") target.department_id = departmentId;
    if (targetType === "class") {
      target.department_id = classDeptId;
      target.assigned_class = assignedClass;
    }
    if (targetType === "role") target.roles = selectedRoles;
    if (targetType === "people") target.profile_ids = selectedPersons.map((p) => p.id);

    const payload: BroadcastPayload = {
      channel,
      message: message.trim(),
      ...(link.trim() && { link: link.trim() }),
      target,
      ...(channel === "push" && { title: title.trim() }),
    };

    setSending(true);
    try {
      const result = await broadcastNotification(payload);
      const pushInfo =
        result.push
          ? ` Push: ${result.push.sent} enviados, ${result.push.fallbackToWa} derivados a WhatsApp.`
          : "";
      const waInfo =
        result.whatsapp ? ` WhatsApp: ${result.whatsapp.queued} en cola.` : "";
      toast({
        title: "Notificación enviada",
        description: `${result.recipients} destinatarios.${pushInfo}${waInfo}`,
      });
      // Reset form
      setTitle("");
      setMessage("");
      setLink("");
      setDepartmentId("");
      setClassDeptId("");
      setAssignedClass("");
      setSelectedRoles([]);
      setSelectedPersons([]);
    } catch (err: any) {
      toast({
        title: "Error al enviar",
        description: err?.message || "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Notificaciones</h1>
            <p className="text-sm text-muted-foreground">Enviá mensajes masivos a tu congregación</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-border shadow-sm p-6 space-y-6">
          {/* Canal */}
          <div>
            <Label className="text-sm font-bold text-foreground mb-3 block">Canal</Label>
            <div className="flex gap-2">
              {(["push", "whatsapp"] as Channel[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`flex-1 py-2 px-4 rounded-xl text-sm font-semibold transition-all border ${
                    channel === c
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                      : "bg-slate-50 dark:bg-slate-700 text-muted-foreground border-border hover:border-purple-300"
                  }`}
                >
                  {c === "push" ? "Push" : "WhatsApp"}
                </button>
              ))}
            </div>
          </div>

          {/* Destino */}
          <div>
            <Label className="text-sm font-bold text-foreground mb-3 block">Destino</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: "department", label: "Departamento" },
                  { value: "class", label: "Clase" },
                  { value: "role", label: "Rol" },
                  { value: "people", label: "Personas" },
                ] as { value: TargetType; label: string }[]
              ).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTargetType(t.value)}
                  className={`py-2 px-3 rounded-xl text-sm font-semibold transition-all border ${
                    targetType === t.value
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-transparent shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                      : "bg-slate-50 dark:bg-slate-700 text-muted-foreground border-border hover:border-purple-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs condicionales */}
          {targetType === "department" && (
            <div>
              <Label className="text-sm font-bold text-foreground mb-2 block">Departamento</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Seleccioná un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {targetType === "class" && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-bold text-foreground mb-2 block">Departamento</Label>
                <Select value={classDeptId} onValueChange={setClassDeptId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Seleccioná un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-bold text-foreground mb-2 block">Clase</Label>
                <Select value={assignedClass} onValueChange={setAssignedClass} disabled={!classDeptId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={classDeptId ? "Seleccioná una clase" : "Primero elegí un departamento"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((cls: string) => (
                      <SelectItem key={cls} value={cls}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {targetType === "role" && (
            <div>
              <Label className="text-sm font-bold text-foreground mb-3 block">Roles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className={`py-1.5 px-3 rounded-full text-xs font-semibold transition-all border ${
                      selectedRoles.includes(r.value)
                        ? "bg-purple-600 text-white border-purple-600"
                        : "bg-slate-50 dark:bg-slate-700 text-muted-foreground border-border hover:border-purple-300"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {targetType === "people" && (
            <div>
              <Label className="text-sm font-bold text-foreground mb-2 block">Personas</Label>
              <div ref={searchRef} className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={personQuery}
                    onChange={(e) => setPersonQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="pl-9 rounded-xl"
                  />
                </div>
                {showDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-border rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                    {searchLoading ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">Buscando...</div>
                    ) : personResults.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">Sin resultados</div>
                    ) : (
                      personResults.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addPerson(p)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
                        >
                          <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[11px] font-bold text-purple-700 dark:text-purple-300 shrink-0">
                            {p.first_name[0]}{p.last_name[0]}
                          </div>
                          <span className="font-medium">{p.first_name} {p.last_name}</span>
                          <span className="text-muted-foreground ml-auto capitalize text-xs">{p.role}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedPersons.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selectedPersons.map((p) => (
                    <Badge
                      key={p.id}
                      variant="secondary"
                      className="flex items-center gap-1 py-1 px-2 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                    >
                      {p.first_name} {p.last_name}
                      <button
                        onClick={() => removePerson(p.id)}
                        className="ml-0.5 hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Título (solo push) */}
          {channel === "push" && (
            <div>
              <Label htmlFor="notif-title" className="text-sm font-bold text-foreground mb-2 block">
                Título
              </Label>
              <Input
                id="notif-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título de la notificación"
                className="rounded-xl"
                maxLength={100}
              />
            </div>
          )}

          {/* Mensaje */}
          <div>
            <Label htmlFor="notif-message" className="text-sm font-bold text-foreground mb-2 block">
              Mensaje
            </Label>
            <Textarea
              id="notif-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribí tu mensaje aquí..."
              className="rounded-xl resize-none min-h-[100px]"
              maxLength={500}
            />
            <p className="text-right text-xs text-muted-foreground mt-1">{message.length}/500</p>
          </div>

          {/* Link opcional */}
          <div>
            <Label htmlFor="notif-link" className="text-sm font-bold text-foreground mb-2 block">
              Link <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="notif-link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://ccdt.app"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {channel === "push"
                ? "Al tocar la notificación se abrirá esta URL."
                : "Se agrega al final del mensaje (WhatsApp lo detecta automáticamente)."}
            </p>
          </div>

          {/* Botón enviar */}
          <Button
            onClick={handleSend}
            disabled={sending}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold h-11 shadow-md shadow-purple-200 dark:shadow-purple-900/30 transition-all"
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Enviar notificación
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Notificaciones;
