import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { LabeledSwitch } from "@/components/LabeledSwitch";
import { DniIdentityInput } from "@/components/DniIdentityInput";
import { toast } from "@/hooks/use-toast";

import { useAuth } from "@/contexts/AuthContext";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { useBaptizedEnabled } from "@/hooks/useBaptizedEnabled";
import { hasPermission, type SavedPermissions } from "@/lib/rolePermissions";
import { SIN_DEPARTAMENTO } from "@/lib/departments";
import {
  getDepartments, getCompany, updateStudent, addStudentDepartment, removeStudentDepartment,
  findStudentByDni, mergeStudents, type MergeResult,
} from "@/lib/api";
import type { Student } from "@/types/database";

const formSchema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().optional(),
  gender: z.string(),
  birthdate: z.any().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  document_number: z.string().optional(),
  department_id: z.string().optional(),
  assigned_class: z.string().optional(),
  baptized: z.boolean().optional(),
});

interface EditStudentModalProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama al guardar, quitar un departamento o unificar fichas. El caller invalida sus queries. */
  onSaved: () => void;
}

/**
 * Modal de edición de miembro, compartido por Lista de Miembros y Todos los Miembros
 * para que las dos pantallas ofrezcan exactamente los mismos campos y validaciones.
 *
 * Incluye el verificador de DNI: si el documento que se escribe ya pertenece a otra
 * ficha, en vez de fallar ofrece unificarlas (POST /api/students/:id/merge).
 */
export function EditStudentModal({ student, open, onOpenChange, onSaved }: EditStudentModalProps) {
  const { profile } = useAuth();
  const companyId = getPersistentCompanyId();
  const baptizedEnabled = useBaptizedEnabled();

  const [isUpdating, setIsUpdating] = useState(false);
  const [birthdateOpen, setBirthdateOpen] = useState(false);
  const [removingDept, setRemovingDept] = useState<string | null>(null);
  const [mergeCandidate, setMergeCandidate] = useState<{ target: Student; preview: MergeResult } | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  // Nombre del miembro que ya tiene ese DNI, detectado al salir del campo.
  const [dniDuplicadoDe, setDniDuplicadoDe] = useState<string | null>(null);

  const { data: departments } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: getDepartments,
  });

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    staleTime: 5 * 60 * 1000,
  });

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";
  const restrictedRole = profile?.role === "maestro" || profile?.role === "auxiliar_maestro"
    || profile?.role === "lider" || profile?.role === "director" || profile?.role === "vicedirector";

  // Quien puede dejar a un miembro sin ningún departamento (solo congregación).
  const puedeSinDepto = hasPermission(
    profile,
    "puede_agregar_miembros_sin_depto",
    (company as { role_permissions?: SavedPermissions } | undefined)?.role_permissions,
  );

  const form = useForm({
    defaultValues: {
      first_name: "", last_name: "", gender: "masculino", birthdate: "", address: "",
      phone: "", document_number: "", department_id: "", assigned_class: "", baptized: false,
    },
    resolver: zodResolver(formSchema),
  });

  // Cargar el miembro en el formulario al abrir.
  useEffect(() => {
    if (!student || !open) return;
    setDniDuplicadoDe(null);

    // Para roles con alcance de un solo departamento se muestra SU asignación,
    // no el departamento primario del miembro.
    let editDeptId = student.department_id || "";
    let editClass = student.assigned_class || "";
    if (restrictedRole && profile?.department_id) {
      const ownAssignment = student.dept_assignments?.find(a => a.department_id === profile.department_id);
      if (ownAssignment) {
        editDeptId = profile.department_id;
        editClass = ownAssignment.assigned_class || "";
      }
    }

    form.reset({
      first_name: student.first_name || "",
      last_name: student.last_name || "",
      gender: student.gender || "masculino",
      birthdate: student.birthdate || "",
      address: student.address || "",
      phone: (student.phone || "").replace(/^549/, ""),
      document_number: student.document_number || "",
      department_id: editDeptId,
      assigned_class: editClass,
      baptized: student.baptized || false,
    });
  }, [student, open, form, restrictedRole, profile?.department_id]);

  const watchedDepartmentId = form.watch("department_id");
  const availableClasses = React.useMemo(() => {
    if (!watchedDepartmentId || watchedDepartmentId === SIN_DEPARTAMENTO || !departments) return [];
    return departments.find(d => d.id === watchedDepartmentId)?.classes || [];
  }, [watchedDepartmentId, departments]);

  // Limpiar la clase si deja de pertenecer al departamento elegido.
  useEffect(() => {
    if (!open || !watchedDepartmentId) return;
    const currentClass = form.getValues("assigned_class");
    if (currentClass && !availableClasses.includes(currentClass)) {
      form.setValue("assigned_class", "");
    }
  }, [watchedDepartmentId, availableClasses, form, open]);

  // Al ponerle un DNI a un miembro puede aparecer que esa persona ya estaba cargada en
  // otra ficha (típicamente en otro departamento, donde la sumaron solo con el nombre).
  // En vez del 409 seco del back, se ofrece unificar las dos conservando todo el historial.
  const buscarDuplicadoPorDni = async (dni: string): Promise<boolean> => {
    const otra = await findStudentByDni(dni);
    if (!otra || otra.id === student?.id) return false;
    const preview = await mergeStudents(student!.id, otra.id, true);
    setMergeCandidate({ target: otra, preview });
    return true;
  };

  // Aviso temprano al salir del campo de DNI, sin abrir todavía el diálogo:
  // el usuario puede estar corrigiendo un tipeo. La fusión se ofrece al guardar.
  const handleDniFound = (personData: { id?: string; first_name?: string; last_name?: string },
                          source: 'student' | 'profile') => {
    // Solo se puede fusionar contra otra ficha de miembro. Un perfil sin ficha no aplica.
    if (source !== 'student' || !personData?.id || personData.id === student?.id) {
      setDniDuplicadoDe(null);
      return;
    }
    setDniDuplicadoDe(`${personData.first_name || ''} ${personData.last_name || ''}`.trim() || 'otro miembro');
  };

  const handleMerge = async () => {
    if (!student || !mergeCandidate) return;
    setIsMerging(true);
    try {
      const res = await mergeStudents(student.id, mergeCandidate.target.id, false);
      toast({
        title: "Fichas unificadas",
        description: `Se movieron ${res.asistencias - res.asistencias_duplicadas} asistencias, ${res.departamentos} departamento(s) y ${res.observaciones} observación(es).`,
        variant: "success",
      });
      setMergeCandidate(null);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "No se pudo unificar",
        description: (error as Error)?.message || "Hubo un error al unificar las fichas.",
        variant: "destructive",
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleRemoveDepartment = async (departmentId: string) => {
    if (!student) return;
    setRemovingDept(departmentId);
    try {
      await removeStudentDepartment(student.id, departmentId);
      toast({ title: "Departamento quitado", variant: "success" });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "No se pudo quitar el departamento.",
        variant: "destructive",
      });
    } finally {
      setRemovingDept(null);
    }
  };

  const handleUpdate = async (values: z.infer<typeof formSchema>) => {
    if (!student) return;
    setIsUpdating(true);
    try {
      const dniNuevo = (values.document_number || "").trim();
      if (dniNuevo && dniNuevo !== (student.document_number || "")) {
        if (await buscarDuplicadoPorDni(dniNuevo)) {
          setIsUpdating(false);
          return; // el diálogo de fusión decide qué pasa
        }
      }

      const editingOwnAssignment = restrictedRole
        && profile?.department_id
        && values.department_id === profile.department_id
        && student.department_id !== profile.department_id;

      const rawPhone = (values.phone || "").replace(/\D/g, "");
      const payload: Record<string, unknown> = {
        ...values,
        birthdate: values.birthdate || null,
        document_number: values.document_number || null,
        phone: rawPhone ? (rawPhone.startsWith("54") ? rawPhone : "549" + rawPhone) : null,
        address: values.address || null,
        assigned_class: values.assigned_class || null,
      };

      // "Sin departamento": limpia el primario y vacía la junction en el back
      // (el array vacío dispara el delete sin re-insertar).
      const dejarSinDepto = payload.department_id === SIN_DEPARTAMENTO;
      if (dejarSinDepto) {
        payload.department_id = null;
        payload.assigned_class = null;
        payload.dept_assignments = [];
      }

      if (!dejarSinDepto && editingOwnAssignment) {
        // Editar solo la asignación propia, sin pisar el departamento primario ni las
        // demás asignaciones del miembro. Preservar el rol (alumno/colaborador).
        delete payload.department_id;
        delete payload.assigned_class;
        const ownAssignment = student.dept_assignments?.find(a => a.department_id === profile.department_id);
        await addStudentDepartment(student.id, {
          department_id: profile.department_id!,
          assigned_class: values.assigned_class || null,
          role_in_dept: ownAssignment?.role_in_dept || "alumno",
        });
      }

      await updateStudent(student.id, payload);
      toast({
        title: "Miembro actualizado",
        description: "El miembro ha sido actualizado correctamente.",
        variant: "success",
      });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast({
        title: "Error al actualizar",
        description: (error as Error)?.message || "Hubo un error al actualizar el miembro.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Departamentos del miembro: la junction, con fallback al primario legacy.
  const assignments = (student?.dept_assignments?.length
    ? student.dept_assignments
    : student?.department_id
      ? [{
          department_id: student.department_id,
          departments: { name: student.departments?.name || student.department },
          assigned_class: student.assigned_class,
        }]
      : []) as Array<{ id?: string; department_id: string; departments?: { name?: string }; assigned_class?: string | null }>;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Editar Miembro</DialogTitle>
            <DialogDescription>
              Realice los cambios necesarios en la información del miembro.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="grid gap-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre*</FormLabel>
                      <FormControl><Input placeholder="Nombre" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl><Input placeholder="Apellido" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="document_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Documento</FormLabel>
                    <FormControl>
                      {/* Mismo input que en Agregar Miembro: busca el DNI al salir del campo.
                          Acá "ya existe" significa ficha duplicada, no persona a vincular. */}
                      <DniIdentityInput
                        value={field.value || ""}
                        onChange={field.onChange}
                        onFound={handleDniFound}
                        foundLabel="Duplicado"
                        foundTone="amber"
                        foundHint={dniDuplicadoDe
                          ? `Ya existe la ficha de ${dniDuplicadoDe}. Al guardar se ofrece unificarlas.`
                          : undefined}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="birthdate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Nacimiento</FormLabel>
                    <FormControl>
                      <MuiDatePickerField
                        value={field.value ? parseISO(field.value) : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        open={birthdateOpen}
                        onOpenChange={setBirthdateOpen}
                        placeholder="Seleccionar fecha de nacimiento"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Género</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione el género" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="femenino">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departamento</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || SIN_DEPARTAMENTO}
                      disabled={restrictedRole}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione un departamento" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {puedeSinDepto && (
                          <SelectItem value={SIN_DEPARTAMENTO}>
                            <span className="italic text-muted-foreground">Sin departamento</span>
                          </SelectItem>
                        )}
                        {departments?.map((department) => (
                          <SelectItem key={department.id} value={department.id}>
                            {department.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_class"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clase</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={watchedDepartmentId === SIN_DEPARTAMENTO || !watchedDepartmentId}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione una clase" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value=" ">Ninguna</SelectItem>
                        {availableClasses.map((className) => (
                          <SelectItem key={String(className)} value={String(className)}>
                            {String(className)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Teléfono"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl><Input placeholder="Dirección" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {baptizedEnabled && (
                <FormField
                  control={form.control}
                  name="baptized"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <LabeledSwitch
                          label="Bautizado"
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* Admin/secretaría pueden quitar departamentos (y dejar al miembro sin ninguno).
                  Para el resto es informativo, y solo cuando hay más de uno. */}
              {isAdminOrSecretaria && assignments.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Departamentos del miembro</p>
                  <p className="text-sm italic text-slate-500">
                    Sin departamento. Cuenta como miembro de la congregación pero no aparece en asistencia.
                  </p>
                </div>
              ) : (isAdminOrSecretaria || assignments.length > 1) ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamentos del miembro</p>
                  {assignments.map((a, idx) => {
                    const isEditable = a.department_id === profile?.department_id;
                    return (
                      <div key={a.id || idx} className="flex items-center justify-between text-sm gap-2">
                        <span className={isEditable ? "font-semibold text-primary" : "text-slate-600"}>
                          {a.departments?.name || "—"}{a.assigned_class ? ` · ${a.assigned_class}` : ""}
                        </span>
                        {isAdminOrSecretaria ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={removingDept === a.department_id}
                            onClick={() => handleRemoveDepartment(a.department_id)}
                          >
                            {removingDept === a.department_id ? "Quitando…" : "Quitar"}
                          </Button>
                        ) : isEditable ? (
                          <span className="text-[10px] font-bold text-primary uppercase">Editable</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase">Solo lectura</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Guardando...
                    </>
                  ) : "Guardar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Verificador de DNI: la persona ya existe en otra ficha */}
      <AlertDialog open={!!mergeCandidate} onOpenChange={(o) => { if (!o) setMergeCandidate(null); }}>
        <AlertDialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Esta persona ya está registrada</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  El DNI pertenece a <strong>{mergeCandidate?.target.first_name} {mergeCandidate?.target.last_name}</strong>
                  {mergeCandidate?.target.departments?.name && <> ({mergeCandidate.target.departments.name})</>}.
                  Podés unificar las dos fichas en una sola.
                </p>

                {mergeCandidate && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Se traspasa de la ficha actual
                    </p>
                    <ul className="text-slate-700 space-y-0.5">
                      <li>{mergeCandidate.preview.asistencias} asistencia(s), conservando el departamento de cada una</li>
                      <li>{mergeCandidate.preview.departamentos} departamento(s)</li>
                      <li>{mergeCandidate.preview.observaciones} observación(es)</li>
                      <li>{mergeCandidate.preview.autorizaciones} autorización(es)</li>
                      {mergeCandidate.preview.grupos_pequenos > 0 && (
                        <li>{mergeCandidate.preview.grupos_pequenos} grupo(s) pequeño(s)</li>
                      )}
                      {mergeCandidate.preview.mueve_cuenta_usuario && <li>La cuenta de usuario asociada</li>}
                    </ul>
                    {mergeCandidate.preview.asistencias_duplicadas > 0 && (
                      <p className="text-xs text-amber-700 pt-1">
                        {mergeCandidate.preview.asistencias_duplicadas} asistencia(s) están repetidas en las dos fichas
                        (mismo día y clase, o mismo evento): quedan en una sola, y si en alguna figuraba presente, se conserva presente.
                      </p>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  Sobrevive la ficha existente; los datos que tenga vacíos se completan con los de esta.
                  La ficha que estás editando se elimina, y los cambios sin guardar del formulario se descartan.
                  No se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMerging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleMerge(); }} disabled={isMerging}>
              {isMerging ? "Unificando..." : "Unificar fichas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
