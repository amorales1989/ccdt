import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudents, deleteStudent } from "@/lib/api";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { STORAGE_URL } from "@/integrations/supabase/client";
import {
  Users, Search, UserPlus, Trash2, Edit2, Phone, MapPin,
  Calendar, FileText, Filter, X, ChevronDown, ChevronLeft, ChevronRight
} from "lucide-react";
import { differenceInYears, format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Student } from "@/types/database";
import AgregarAlumno from "@/pages/AgregarAlumno";

const PAGE_SIZE = 24;

const DEPT_COLORS: Record<string, string> = {
  adolescentes: "bg-violet-100 text-violet-700 border-violet-200",
  "jóvenes": "bg-blue-100 text-blue-700 border-blue-200",
  jovenes: "bg-blue-100 text-blue-700 border-blue-200",
  adultos: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "niños": "bg-amber-100 text-amber-700 border-amber-200",
  ninos: "bg-amber-100 text-amber-700 border-amber-200",
  escuelita: "bg-pink-100 text-pink-700 border-pink-200",
  calendario: "bg-slate-100 text-slate-600 border-slate-200",
};

const deptColor = (name?: string) => {
  if (!name) return "bg-slate-100 text-slate-500 border-slate-200";
  const key = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return DEPT_COLORS[key] || "bg-indigo-100 text-indigo-700 border-indigo-200";
};

const ROLE_IN_DEPT_LABELS: Record<string, string> = {
  alumno: "Alumno", ayudante: "Ayudante", colaborador: "Colaborador",
  maestro: "Maestro", lider: "Líder", visita: "Visita",
};

export default function TodosMiembros() {
  const { companyId } = useCompany();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterGender, setFilterGender] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  const canEdit = profile?.role === "admin" || profile?.role === "secretaria";

  const { data: rawStudents = [], isLoading } = useQuery({
    queryKey: ["all-students", companyId],
    queryFn: () => getStudents({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 0,
  });

  const students: Student[] = rawStudents;

  const allDepts = useMemo(() => {
    const names = new Set<string>();
    students.forEach(s => {
      s.dept_assignments?.forEach(d => { if (d.departments?.name) names.add(d.departments.name); });
      if (s.departments?.name) names.add(s.departments.name as string);
    });
    return Array.from(names).sort();
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const fullName = `${s.first_name} ${s.last_name || ""}`.toLowerCase();
      const doc = (s.document_number || "").toLowerCase();
      const matchSearch = !search || fullName.includes(search.toLowerCase()) || doc.includes(search.toLowerCase());
      const depts = s.dept_assignments?.map(d => d.departments?.name) ?? [s.departments?.name];
      const matchDept = filterDept === "all" || depts.some(d => d === filterDept);
      const matchGender = filterGender === "all" || s.gender === filterGender;
      return matchSearch && matchDept && matchGender;
    });
  }, [students, search, filterDept, filterGender]);

  // Reset to page 1 when filters change
  React.useEffect(() => { setPage(1); }, [search, filterDept, filterGender]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      toast.success("Miembro eliminado");
      setConfirmDelete(null);
    },
    onError: () => { toast.error("No se pudo eliminar"); setConfirmDelete(null); }
  });

  if (isLoading) return <LoadingOverlay message="Cargando miembros..." />;

  const withDept = students.filter(s => (s.dept_assignments?.length ?? 0) > 0 || s.department_id).length;
  const withoutDept = students.length - withDept;

  return (
    <>
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">

      {/* Header card — mismo estilo que otras pantallas */}
      <div className="relative group">
        <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-[3rem] -z-10 group-hover:bg-indigo-500/10 transition-all duration-700" />
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-indigo-500/5 overflow-hidden">
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
                <div className="relative h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center p-3.5 shadow-xl shadow-indigo-500/40">
                  <Users className="h-full w-full text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                  Todos los Miembros
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight flex items-center gap-1.5 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 inline-block" />
                  {students.length} registros · {withDept} en departamentos · {withoutDept} sin asignar
                </p>
              </div>
            </div>
            {canEdit && (
              <Button
                onClick={() => setShowAddModal(true)}
                className="button-gradient rounded-xl h-11 px-8 font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-indigo-500/20"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Nuevo Miembro
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o DNI..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-slate-400" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-bold transition-all ${showFilters ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-400" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
          >
            <Filter className="h-4 w-4" />
            Filtros
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>

          <span className="text-sm font-black text-slate-400 ml-auto">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {showFilters && (
          <div className="flex gap-3 mt-3 flex-wrap">
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todos los departamentos</option>
              {allDepts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            <select
              value={filterGender}
              onChange={e => setFilterGender(e.target.value)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todos los géneros</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
            </select>

            {(filterDept !== "all" || filterGender !== "all") && (
              <button
                onClick={() => { setFilterDept("all"); setFilterGender("all"); }}
                className="h-9 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members Grid */}
      {paginated.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginated.map(student => {
            const age = student.birthdate ? differenceInYears(new Date(), new Date(student.birthdate)) : null;
            const initials = `${student.first_name?.[0] ?? ""}${student.last_name?.[0] ?? ""}`.toUpperCase();
            const photoUrl = student.photo_url
              ? (student.photo_url.startsWith("http") ? student.photo_url : `${STORAGE_URL}/photos/${student.photo_url}`)
              : null;

            const depts = student.dept_assignments?.length
              ? student.dept_assignments
              : student.department_id
                ? [{ department_id: student.department_id, departments: { name: (student.departments?.name || student.department) as string, id: student.department_id }, assigned_class: student.assigned_class, role_in_dept: "alumno" }]
                : [];

            return (
              <div key={student.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-2 ring-slate-100 dark:ring-slate-800">
                        <AvatarImage src={photoUrl ?? undefined} />
                        <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-black text-sm">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-black text-slate-800 dark:text-white text-sm leading-tight truncate">
                          {student.first_name} {student.last_name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {age !== null ? `${age} años` : "Sin fecha nac."}
                          {student.gender === "masculino" ? " · M" : student.gender === "femenino" ? " · F" : ""}
                        </p>
                      </div>
                    </div>
                    {student.nuevo && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">NUEVO</span>
                    )}
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {student.document_number && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span>DNI {student.document_number}</span>
                      </div>
                    )}
                    {student.phone && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{student.phone}</span>
                      </div>
                    )}
                    {student.address && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{student.address}</span>
                      </div>
                    )}
                    {student.birthdate && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{format(new Date(student.birthdate), "d MMM yyyy", { locale: es })}</span>
                      </div>
                    )}
                  </div>

                  {depts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {depts.map((d, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${deptColor(d.departments?.name)}`}>
                          {d.departments?.name || "—"}
                          {d.assigned_class && <span className="opacity-60">· {d.assigned_class}</span>}
                          {d.role_in_dept && d.role_in_dept !== "alumno" && (
                            <span className="opacity-75">· {ROLE_IN_DEPT_LABELS[d.role_in_dept] || d.role_in_dept}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">Sin departamento asignado</span>
                  )}
                </div>

                {canEdit && (
                  <div className="border-t border-slate-50 dark:border-slate-800 px-4 py-2.5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 h-8 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg gap-1.5"
                      onClick={() => navigate(`/listar?edit=${student.id}`)}
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                    {confirmDelete === student.id ? (
                      <div className="flex gap-1 flex-1">
                        <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs rounded-lg" disabled={deleting} onClick={() => doDelete(student.id)}>
                          Confirmar
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg" onClick={() => setConfirmDelete(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        onClick={() => setConfirmDelete(student.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Users className="h-14 w-14 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 font-bold text-lg">No se encontraron miembros</p>
          <p className="text-slate-400 text-sm mt-1">Probá ajustando los filtros de búsqueda</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-400 font-medium">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-9 w-9 p-0 rounded-xl"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} className="text-slate-400 text-sm px-1">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={page === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(p as number)}
                    className={`h-9 w-9 p-0 rounded-xl font-bold ${page === p ? "bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white" : ""}`}
                  >
                    {p}
                  </Button>
                )
              )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="h-9 w-9 p-0 rounded-xl"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>

    <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agregar Miembro</DialogTitle>
        </DialogHeader>
        <AgregarAlumno
          isModal
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      </DialogContent>
    </Dialog>
    </>
  );
}
