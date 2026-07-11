import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getSmallGroups, createSmallGroup, updateSmallGroup, archiveSmallGroup,
  getSmallGroupMembers, addSmallGroupMember, updateSmallGroupMember, removeSmallGroupMember,
  createSmallGroupMeeting, getSmallGroupAttendance, saveSmallGroupAttendance,
  getUsers, getDepartments, updateStudent, SmallGroup, SmallGroupMember, SmallGroupAttendanceRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users2, Plus, Pencil, Archive, RotateCcw, UserPlus, ClipboardCheck, UserCheck, UserX, Save, LayoutGrid, TableIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { PersonSearchInput } from "@/components/PersonSearchInput";
import { DatePickerField } from "@/components/DatePickerField";
import { format } from "date-fns";

const GROUP_ADMIN_ROLES = ["admin", "secretaria", "director", "vicedirector", "director_general"];
const DEPT_DIRECTOR_ROLES = ["director", "vicedirector", "director_general"];
// Solo 'lider' crea grupos; maestro/auxiliar_maestro pueden quedar a cargo de uno, pero no crearlo.
const DEPT_LEADER_ROLES = ["lider"];
const WEEKDAYS = [
  { n: 0, label: "Dom" }, { n: 1, label: "Lun" }, { n: 2, label: "Mar" },
  { n: 3, label: "Mié" }, { n: 4, label: "Jue" }, { n: 5, label: "Vie" }, { n: 6, label: "Sáb" },
];

const emptyForm = {
  name: "", description: "", category: "",
  capacity: "", weekday: "" as string, meeting_time: "", location: "", leader_profile_id: "",
  department_id: "",
};

const GruposPequenos = () => {
  const { toast } = useToast();
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = GROUP_ADMIN_ROLES.includes(profile?.role || "");
  const isDeptLeader = DEPT_LEADER_ROLES.includes(profile?.role || "") && !!profile?.department_id;
  const isDeptDirector = DEPT_DIRECTOR_ROLES.includes(profile?.role || "");
  const canCreate = isAdmin || isDeptLeader;
  // Quién puede elegir miembros de TODA la congregación al agregar (resto: solo su propio depto)
  const canBrowseAllDepartments = ["admin", "secretaria"].includes(profile?.role || "");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SmallGroup | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailGroup, setDetailGroup] = useState<SmallGroup | null>(null);
  const [detailView, setDetailView] = useState<"members" | "attendance">("members");
  const [newMember, setNewMember] = useState({ first_name: "", last_name: "", phone: "" });
  const [newMemberRole, setNewMemberRole] = useState<"leader" | "co_leader" | "member">("member");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [dateOpen, setDateOpen] = useState(false);

  const [pageView, setPageView] = useState<"grupos" | "miembros">("grupos");
  const [groupsFilter, setGroupsFilter] = useState<"active" | "archived">("active");
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["small-groups", groupsFilter],
    queryFn: () => getSmallGroups(groupsFilter),
  });

  // Vista "Miembros": tabla con los datos de los integrantes de un grupo activo.
  const [tableGroupId, setTableGroupId] = useState<string>("");
  const { data: activeGroups = [] } = useQuery({
    queryKey: ["small-groups", "active"],
    queryFn: () => getSmallGroups("active"),
    enabled: pageView === "miembros",
  });
  // Con un solo grupo activo, se muestra directo; con varios, hay que elegir.
  const effectiveTableGroupId = activeGroups.length === 1 ? activeGroups[0].id : tableGroupId;
  const { data: tableMembers = [] } = useQuery({
    queryKey: ["small-group-members", effectiveTableGroupId],
    queryFn: () => getSmallGroupMembers(effectiveTableGroupId),
    enabled: pageView === "miembros" && !!effectiveTableGroupId,
  });
  const { data: allUsers = [] } = useQuery({ queryKey: ["users-for-groups"], queryFn: getUsers, enabled: canCreate });
  const leaderOptions = isAdmin
    ? allUsers
    : allUsers.filter((u) => u.department_id === (isDeptDirector ? form.department_id : profile?.department_id));

  // Director-level: puede tener varios deptos asignados, hay que elegir en cuál cae el grupo nuevo.
  const { data: allDepartments = [] } = useQuery({ queryKey: ["departments-for-groups"], queryFn: getDepartments, enabled: isDeptDirector });
  const myDeptOptions = allDepartments.filter((d) => (profile?.departments || []).includes(d.name));

  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: ["small-groups"] });

  const createMutation = useMutation({
    mutationFn: createSmallGroup,
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Grupo creado", variant: "success" });
      setIsModalOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SmallGroup> }) => updateSmallGroup(id, data),
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Grupo actualizado", variant: "success" });
      setIsModalOpen(false);
      setSelectedGroup(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: archiveSmallGroup,
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Grupo archivado", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => updateSmallGroup(id, { status: "active" }),
    onSuccess: () => {
      invalidateGroups();
      toast({ title: "Grupo reactivado", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: members = [], refetch: refetchMembers } = useQuery({
    queryKey: ["small-group-members", detailGroup?.id],
    queryFn: () => getSmallGroupMembers(detailGroup!.id),
    enabled: !!detailGroup,
  });

  // Como en Tomar Asistencia: elegís la fecha y listo, sin pasos intermedios. La "reunión"
  // (small_group_meetings) es un detalle interno: se obtiene o crea sola para esa fecha.
  const { data: meetingForDate } = useQuery({
    queryKey: ["small-group-meeting-for-date", detailGroup?.id, meetingDate],
    queryFn: () => createSmallGroupMeeting(detailGroup!.id, { meeting_date: meetingDate }),
    enabled: !!detailGroup && detailView === "attendance" && !!meetingDate,
    staleTime: Infinity,
  });
  const activeMeetingId = meetingForDate?.id || null;

  const { data: attendanceRoster = [], refetch: refetchAttendance } = useQuery({
    queryKey: ["small-group-attendance", detailGroup?.id, activeMeetingId],
    queryFn: () => getSmallGroupAttendance(detailGroup!.id, activeMeetingId!),
    enabled: !!detailGroup && !!activeMeetingId,
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: Parameters<typeof addSmallGroupMember>[1]) => addSmallGroupMember(detailGroup!.id, data),
    onSuccess: () => {
      refetchMembers();
      invalidateGroups();
      toast({ title: "Miembro agregado", variant: "success" });
      setNewMember({ first_name: "", last_name: "", phone: "" });
    },
    onError: (e: Error) => toast({ title: "No se pudo agregar", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeSmallGroupMember(detailGroup!.id, memberId),
    onSuccess: () => {
      refetchMembers();
      invalidateGroups();
      toast({ title: "Miembro quitado", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role_in_group }: { memberId: string; role_in_group: "leader" | "co_leader" | "member" }) =>
      updateSmallGroupMember(detailGroup!.id, memberId, { role_in_group }),
    onSuccess: () => {
      refetchMembers();
      invalidateGroups();
      toast({ title: "Rol actualizado", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Edición de datos de un miembro respaldado por `students` (propaga a todo el sistema, porque
  // todo referencia el mismo student_id: departamentos, otros grupos, etc.).
  const [editMember, setEditMember] = useState<SmallGroupMember | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", phone: "" });

  const editStudentMutation = useMutation({
    mutationFn: () => updateStudent(editMember!.student!.id, {
      first_name: editForm.first_name.trim(),
      last_name: editForm.last_name.trim() || null,
      phone: editForm.phone.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["small-group-members"] });
      queryClient.invalidateQueries({ queryKey: ["small-group-attendance"] });
      toast({ title: "Miembro actualizado en todo el sistema", variant: "success" });
      setEditMember(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEditMember = (m: SmallGroupMember) => {
    if (!m.student) return; // solo editables los respaldados por students (no perfiles/cuentas)
    setEditForm({ first_name: m.student.first_name || "", last_name: m.student.last_name || "", phone: m.student.phone || "" });
    setEditMember(m);
  };

  // Sacar del grupo desde la tabla (usa el grupo de la vista Miembros, no el panel de detalle).
  const removeTableMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeSmallGroupMember(effectiveTableGroupId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["small-group-members"] });
      invalidateGroups();
      toast({ title: "Sacado del grupo", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [pendingAttendance, setPendingAttendance] = useState<Record<string, boolean>>({});

  const saveAttendanceMutation = useMutation({
    mutationFn: () => saveSmallGroupAttendance(
      detailGroup!.id,
      activeMeetingId!,
      Object.entries(pendingAttendance).map(([member_id, present]) => ({ member_id, present }))
    ),
    onSuccess: () => {
      refetchAttendance();
      toast({ title: "Asistencia guardada", variant: "success" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setForm(emptyForm);
    setIsEditing(false);
    setSelectedGroup(null);
    setIsModalOpen(true);
  };

  const openEdit = (group: SmallGroup) => {
    setForm({
      name: group.name, description: group.description || "", category: group.category || "",
      capacity: group.capacity ? String(group.capacity) : "",
      weekday: group.weekday !== null ? String(group.weekday) : "", meeting_time: group.meeting_time || "",
      location: group.location || "", leader_profile_id: "",
    });
    setSelectedGroup(group);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const openDetail = (group: SmallGroup) => {
    setDetailGroup(group);
    setDetailView("members");
    setMeetingDate(new Date().toISOString().slice(0, 10));
    setPendingAttendance({});
  };

  const handleDateChange = (date: string) => {
    setMeetingDate(date);
    setPendingAttendance({});
  };

  const handleSubmitForm = () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      weekday: form.weekday !== "" ? Number(form.weekday) : undefined,
      meeting_time: form.meeting_time || undefined,
      location: form.location.trim() || undefined,
    };
    if (isEditing && selectedGroup) {
      updateMutation.mutate({ id: selectedGroup.id, data: payload });
    } else {
      createMutation.mutate({
        ...payload,
        leader_profile_id: form.leader_profile_id || undefined,
        department_id: isDeptDirector ? (form.department_id || undefined) : undefined,
      });
    }
  };

  const memberLabel = (m: SmallGroupMember | SmallGroupAttendanceRow) => {
    const p = m.student || m.profile;
    return p ? `${p.first_name} ${p.last_name || ""}`.trim() : "—";
  };

  const roleLabel: Record<string, string> = { leader: "Líder", co_leader: "Co-líder", member: "Miembro" };

  const existingMemberIds = members
    .map((m) => m.student?.id || m.profile?.id)
    .filter((id): id is string => !!id);

  const presentCount = attendanceRoster.filter((m) => pendingAttendance[m.id] ?? m.present ?? false).length;
  const absentCount = attendanceRoster.length - presentCount;
  const isArchived = detailGroup?.status === "archived";

  if (isLoading) return <LoadingOverlay message="Cargando grupos..." />;

  return (
    <div className="animate-fade-in pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700 px-6 md:px-10 pt-10 pb-16">
        <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-teal-200 text-xs font-black uppercase tracking-[0.2em] mb-2">Comunidad</p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">Grupos Pequeños</h1>
            <p className="text-teal-200 mt-2 text-sm font-medium">
              {groups.length} {groups.length === 1 ? "grupo" : "grupos"}
            </p>
          </div>
          {canCreate && (
            <Button
              onClick={openCreate}
              className="h-11 px-6 rounded-xl bg-white/15 hover:bg-white/25 text-white font-black text-[10px] uppercase tracking-widest border border-white/20 backdrop-blur-sm gap-2"
            >
              <Plus className="h-4 w-4" /> Nuevo Grupo
            </Button>
          )}
        </div>
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 md:px-8 -mt-8 pb-4">
        {/* Pestañas de vista (Grupos/Miembros) + filtro (Activos/Archivados), en una sola fila alineada */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setPageView("grupos")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${pageView === "grupos"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grupos
            </button>
            <button
              onClick={() => setPageView("miembros")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${pageView === "miembros"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
            >
              <TableIcon className="h-3.5 w-3.5" /> Miembros
            </button>
          </div>

          {pageView === "grupos" && (
            <div className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => setGroupsFilter("active")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${groupsFilter === "active"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                Activos
              </button>
              <button
                onClick={() => setGroupsFilter("archived")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 ${groupsFilter === "archived"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"}`}
              >
                <Archive className="h-3.5 w-3.5" /> Archivados
              </button>
            </div>
          )}
        </div>

        {pageView === "grupos" && (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.length > 0 ? groups.map((group) => (
            <div
              key={group.id}
              onClick={() => openDetail(group)}
              className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
            >
              <div className="h-1.5 w-full bg-teal-500" />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                      <Users2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-base leading-tight">{group.name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5 text-teal-600 dark:text-teal-400">
                        {group.member_count ?? 0} {group.member_count === 1 ? "miembro" : "miembros"}
                      </p>
                    </div>
                  </div>
                  {(isAdmin || group.created_by === user?.id) && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      {group.status === "archived" ? (
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 rounded-lg text-slate-400 hover:text-emerald-600"
                          onClick={() => reactivateMutation.mutate(group.id)}
                          title="Reactivar grupo"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-indigo-600" onClick={() => openEdit(group)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-500">
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Archivar grupo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{group.name}" quedará de solo lectura: no se van a poder agregar miembros, tomar asistencia ni editarlo hasta reactivarlo. El historial se conserva.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => archiveMutation.mutate(group.id)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl">
                                  Archivar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {group.description && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">{group.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {group.category && <Badge variant="secondary" className="text-[10px] font-bold">{group.category}</Badge>}
                  {group.weekday !== null && group.meeting_time && (
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {WEEKDAYS.find((w) => w.n === group.weekday)?.label} {group.meeting_time.slice(0, 5)}
                    </Badge>
                  )}
                  {group.status === "archived" && <Badge variant="destructive" className="text-[10px] font-bold">Archivado</Badge>}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5">
                  <span className="font-bold uppercase tracking-wider text-slate-400">A cargo: </span>
                  {group.leaders && group.leaders.length > 0
                    ? group.leaders.map((l) => `${l.first_name} ${l.last_name || ""}`.trim()).join(", ")
                    : <span className="italic">Sin líder asignado</span>}
                </p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-24 flex flex-col items-center justify-center gap-4 text-center">
              <div className="h-20 w-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Users2 className="h-10 w-10 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="font-black text-slate-400 text-lg">
                  {groupsFilter === "archived" ? "Sin grupos archivados" : "Sin grupos pequeños"}
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  {groupsFilter === "archived"
                    ? "Los grupos que archives van a aparecer acá."
                    : (isAdmin ? "Creá el primer grupo." : "Todavía no formás parte de ningún grupo.")}
                </p>
              </div>
            </div>
          )}
        </div>
        </>
        )}

        {pageView === "miembros" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 md:p-6">
            {activeGroups.length === 0 ? (
              <div className="py-16 text-center">
                <Users2 className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="font-black text-slate-400">No hay grupos activos</p>
              </div>
            ) : (
              <>
                {activeGroups.length > 1 && (
                  <div className="mb-4 max-w-xs">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grupo</Label>
                    <Select value={tableGroupId} onValueChange={setTableGroupId}>
                      <SelectTrigger className="h-11 rounded-xl mt-1"><SelectValue placeholder="Elegí un grupo" /></SelectTrigger>
                      <SelectContent>
                        {activeGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!effectiveTableGroupId ? (
                  <p className="text-sm text-slate-400 italic py-8 text-center">Elegí un grupo para ver sus miembros.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-bold">Nombre</TableHead>
                          <TableHead className="font-bold">Rol</TableHead>
                          <TableHead className="font-bold">Teléfono</TableHead>
                          <TableHead className="font-bold text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableMembers.length > 0 ? tableMembers.map((m) => {
                          const p = m.student || m.profile;
                          const name = p ? `${p.first_name} ${p.last_name || ""}`.trim() : "—";
                          const isSelf = !!m.profile && m.profile.id === user?.id;
                          return (
                            <TableRow key={m.id}>
                              <TableCell className="font-semibold text-slate-700 dark:text-slate-200">{name}</TableCell>
                              <TableCell>
                                <Badge variant={m.role_in_group === "member" ? "outline" : "secondary"} className="text-[10px] font-bold">
                                  {roleLabel[m.role_in_group]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-600 dark:text-slate-300">{p?.phone || "—"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {m.student && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={() => openEditMember(m)} title="Editar datos">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {!isSelf && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" title="Sacar del grupo">
                                          <UserX className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="rounded-2xl">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>¿Sacar del grupo?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {name} dejará de ser parte de este grupo. No se borra del sistema — sigue en su departamento y demás grupos.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => removeTableMemberMutation.mutate(m.id)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl">
                                            Sacar del grupo
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {isSelf && <span className="text-[10px] text-slate-300 italic">—</span>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        }) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-sm text-slate-400 italic py-8">
                              Este grupo no tiene miembros.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Dialog Crear/Editar */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black">{isEditing ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Jóvenes de Barrio Norte" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl min-h-[70px] resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Categoría</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Estudio bíblico" className="h-11 rounded-xl" />
            </div>
            {!isEditing && isDeptDirector && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</Label>
                <Select value={form.department_id} onValueChange={(v) => setForm({ ...form, department_id: v, leader_profile_id: "" })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Elegí un departamento" /></SelectTrigger>
                  <SelectContent>
                    {myDeptOptions.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Día</Label>
                <Select value={form.weekday} onValueChange={(v) => setForm({ ...form, weekday: v })}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {WEEKDAYS.map((w) => <SelectItem key={w.n} value={String(w.n)}>{w.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora</Label>
                <Input type="time" value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cupo</Label>
                <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lugar</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Casa de familia, salón..." className="h-11 rounded-xl" />
            </div>
            {!isEditing && (!isDeptDirector || form.department_id) && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Líder (necesita cuenta en la app){!isAdmin ? " — de ese departamento" : ""}
                </Label>
                <Select value={form.leader_profile_id} onValueChange={(v) => setForm({ ...form, leader_profile_id: v })}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={isDeptLeader ? "Vos (por defecto)" : "Elegir más tarde"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leaderOptions.filter((u) => u.id !== null).map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.first_name} {u.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-10 px-4 text-xs font-bold">Cancelar</Button>
            <Button
              onClick={handleSubmitForm}
              disabled={!form.name.trim() || (!isEditing && isDeptDirector && !form.department_id) || createMutation.isPending || updateMutation.isPending}
              className="button-gradient rounded-xl h-10 px-6 font-black text-xs uppercase tracking-wider"
            >
              {isEditing ? "Guardar cambios" : "Crear grupo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog editar datos de un miembro (student) — propaga a todo el sistema */}
      <Dialog open={!!editMember} onOpenChange={(open) => !open && setEditMember(null)}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black">Editar miembro</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400 -mt-1">Los cambios se aplican en todos los lugares donde esté esta persona (departamentos y otros grupos).</p>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Apellido</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono (WhatsApp)</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="h-11 rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setEditMember(null)} className="rounded-xl h-10 px-4 text-xs font-bold">Cancelar</Button>
            <Button
              onClick={() => editStudentMutation.mutate()}
              disabled={!editForm.first_name.trim() || editStudentMutation.isPending}
              className="button-gradient rounded-xl h-10 px-6 font-black text-xs uppercase tracking-wider"
            >
              {editStudentMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sheet Detalle: Roster + Asistencia */}
      <Sheet open={!!detailGroup} onOpenChange={(open) => !open && setDetailGroup(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-black">{detailGroup?.name}</SheetTitle>
          </SheetHeader>

          {detailGroup?.status === "archived" && (
            <div className="mt-3 flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Grupo archivado — solo lectura</p>
              {(isAdmin || detailGroup.created_by === user?.id) && (
                <Button
                  size="sm" variant="ghost"
                  className="h-7 px-2 rounded-lg text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100"
                  onClick={() => reactivateMutation.mutate(detailGroup.id)}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Reactivar
                </Button>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4 mb-4">
            <Button size="sm" variant={detailView === "members" ? "default" : "outline"} className="rounded-lg text-xs font-bold" onClick={() => setDetailView("members")}>
              <UserPlus className="h-3.5 w-3.5 mr-1" /> Integrantes
            </Button>
            <Button size="sm" variant={detailView === "attendance" ? "default" : "outline"} className="rounded-lg text-xs font-bold" onClick={() => setDetailView("attendance")}>
              <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Asistencia
            </Button>
          </div>

          {detailView === "members" && (
            <div className="space-y-4">
              {!isArchived && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Agregar miembro existente{canBrowseAllDepartments ? "" : " (tu departamento)"}
                    </Label>
                    <div className="flex gap-2">
                      <Select value={newMemberRole} onValueChange={(v) => setNewMemberRole(v as "leader" | "co_leader" | "member")}>
                        <SelectTrigger className="h-12 w-[110px] rounded-xl shrink-0 text-xs font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Miembro</SelectItem>
                          <SelectItem value="co_leader">Co-líder</SelectItem>
                          <SelectItem value="leader">Líder</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1">
                        <PersonSearchInput
                          departmentId={canBrowseAllDepartments ? undefined : (profile?.department_id || undefined)}
                          excludeIds={existingMemberIds}
                          onSelect={(person) => {
                            if (person.source === "student") {
                              addMemberMutation.mutate({ student_id: person.id, role_in_group: newMemberRole });
                            } else {
                              addMemberMutation.mutate({ profile_id: person.id, role_in_group: newMemberRole });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                    <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Agregar contacto nuevo (sin cuenta)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Nombre" value={newMember.first_name} onChange={(e) => setNewMember({ ...newMember, first_name: e.target.value })} className="h-10 rounded-xl" />
                      <Input placeholder="Apellido" value={newMember.last_name} onChange={(e) => setNewMember({ ...newMember, last_name: e.target.value })} className="h-10 rounded-xl" />
                    </div>
                    <Input placeholder="Teléfono (WhatsApp)" value={newMember.phone} onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })} className="h-10 rounded-xl" />
                    <Button
                      size="sm"
                      disabled={!newMember.first_name.trim() || addMemberMutation.isPending}
                      onClick={() => addMemberMutation.mutate({ first_name: newMember.first_name, last_name: newMember.last_name || undefined, phone: newMember.phone || undefined })}
                      className="rounded-xl text-xs font-bold w-full"
                    >
                      <UserPlus className="h-3.5 w-3.5 mr-1" /> Agregar
                    </Button>
                  </div>
                </>
              )}

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4">
                {(() => {
                  const leaders = members.filter((m) => m.role_in_group === "leader" || m.role_in_group === "co_leader");
                  const plainMembers = members.filter((m) => m.role_in_group === "member");
                  const renderRow = (m: SmallGroupMember) => {
                    const isSelf = !!m.profile && m.profile.id === user?.id;
                    return (
                    <div key={m.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 gap-2">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{memberLabel(m)}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.profile ? (
                          <Select
                            value={m.role_in_group}
                            disabled={isArchived}
                            onValueChange={(v) => updateMemberRoleMutation.mutate({ memberId: m.id, role_in_group: v as "leader" | "co_leader" | "member" })}
                          >
                            <SelectTrigger className="h-8 w-[110px] rounded-lg text-[10px] font-bold uppercase"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="leader">Líder</SelectItem>
                              <SelectItem value="co_leader">Co-líder</SelectItem>
                              <SelectItem value="member">Miembro</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-[10px] uppercase font-bold text-slate-400 px-2">{roleLabel[m.role_in_group]}</p>
                        )}
                        {!isArchived && !isSelf && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500" title="Sacar del grupo">
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Sacar del grupo?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {memberLabel(m)} dejará de ser parte de este grupo. No se borra del sistema — sigue en su departamento y demás grupos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeMemberMutation.mutate(m.id)} className="bg-red-500 hover:bg-red-600 text-white rounded-xl">
                                  Sacar del grupo
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                    );
                  };

                  return (
                    <>
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">A cargo</p>
                        {leaders.length > 0
                          ? leaders.map(renderRow)
                          : <p className="text-xs text-slate-400 italic">Sin líder asignado.</p>}
                      </div>

                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Miembros</p>
                        {plainMembers.length > 0
                          ? plainMembers.map(renderRow)
                          : <p className="text-xs text-slate-400 italic">Sin miembros todavía.</p>}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {detailView === "attendance" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de reunión</Label>
                <div className="glass-card flex items-center gap-3 px-4 py-2.5">
                  <DatePickerField
                    value={meetingDate ? new Date(meetingDate + "T00:00:00") : undefined}
                    onChange={(date) => handleDateChange(date ? format(date, "yyyy-MM-dd") : "")}
                    open={dateOpen}
                    onOpenChange={setDateOpen}
                    className="bg-transparent border-none outline-none text-sm font-semibold text-slate-700 dark:text-slate-200 w-full"
                  />
                </div>
              </div>

              {activeMeetingId && (
                <>
                  {/* Stats pill */}
                  <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <UserCheck className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-green-600 leading-none">{presentCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Presentes</div>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <UserX className="h-4 w-4 text-red-500" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-red-500 leading-none">{absentCount}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ausentes</div>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                        <Users2 className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <div className="text-lg font-black text-teal-600 leading-none">{attendanceRoster.length}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {attendanceRoster.map((m) => {
                      const current = pendingAttendance[m.id] ?? m.present ?? false;
                      const name = memberLabel(m);
                      const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
                      return (
                        <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <p className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{name}</p>
                          <button
                            onClick={() => setPendingAttendance((prev) => ({ ...prev, [m.id]: !current }))}
                            disabled={isArchived}
                            className={`w-10 h-10 rounded-xl font-black text-sm transition-all duration-200 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed ${current
                              ? "bg-green-500 text-white shadow-md shadow-green-200 scale-105"
                              : "bg-red-100 text-red-500 hover:bg-red-200"}`}
                          >
                            {current ? "P" : "A"}
                          </button>
                        </div>
                      );
                    })}
                    {attendanceRoster.length === 0 && <p className="text-xs text-slate-400 italic">Sin miembros activos.</p>}
                  </div>

                  <Button
                    onClick={() => saveAttendanceMutation.mutate()}
                    disabled={isArchived || saveAttendanceMutation.isPending || Object.keys(pendingAttendance).length === 0}
                    className="w-full h-12 button-gradient shadow-lg font-bold text-sm rounded-2xl"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveAttendanceMutation.isPending ? "Guardando..." : "Guardar asistencia"}
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default GruposPequenos;
