
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from "recharts";
import {
  Users, TrendingUp, Award, Loader2, FileDown,
  UserCheck, Star, CalendarDays, ArrowUpRight, BookOpen
} from "lucide-react";
import { format, subMonths, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { exportStatsReport } from "@/lib/statsPdfUtils";
import { toast } from "sonner";
import { useCompany } from "@/contexts/CompanyContext";
import type { Student, Profile } from "@/types/database";

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];
const GENDER_COLORS: Record<string, string> = {
  masculino: "#6366f1",
  femenino: "#ec4899",
  desconocido: "#94a3b8",
};

const GLOBAL_ROLES = ["admin", "secretaria"];

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl px-4 py-3">
      {label && <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-black" style={{ color: p.color || p.fill }}>
          {p.name}: <span className="text-slate-800 dark:text-white">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ value, max, color }: { value: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
};

export default function Estadisticas() {
  const [searchParams] = useSearchParams();
  const currentView = searchParams.get("view") || "age";
  const [selectedClass, setSelectedClass] = React.useState<string>("all");
  const [isExporting, setIsExporting] = React.useState(false);
  const { companyId } = useCompany();

  const { data: currentProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['stats-current-profile', companyId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*').eq('id', user.id).eq('company_id', companyId).single();
      if (error) throw error;
      return data;
    }
  });

  const isGlobalView = !currentProfile || GLOBAL_ROLES.includes(currentProfile.role);
  const scopedDeptId = isGlobalView ? null : currentProfile?.department_id;

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['stats-students', scopedDeptId, companyId],
    enabled: !loadingProfile,
    queryFn: async () => {
      let q = (supabase.from('students') as any)
        .select('*').eq('company_id', companyId).is('deleted_at', null);
      if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Student[];
    }
  });

  const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['stats-attendance', scopedDeptId, companyId],
    enabled: !loadingProfile,
    queryFn: async () => {
      let q = (supabase.from('attendance') as any).select('*').eq('company_id', companyId);
      if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    }
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['stats-profiles', scopedDeptId, companyId],
    enabled: !loadingProfile,
    queryFn: async () => {
      let q = (supabase.from('profiles') as any).select('*').eq('company_id', companyId);
      if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Profile[];
    }
  });

  const { data: deptInfo } = useQuery({
    queryKey: ['stats-dept', scopedDeptId, companyId],
    enabled: !!scopedDeptId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('departments') as any)
        .select('name, classes').eq('id', scopedDeptId).eq('company_id', companyId).single();
      if (error) throw error;
      return data;
    }
  });

  // ─── Data Processing ───────────────────────────────────────────────────────
  const data = useMemo(() => {
    const filteredStudents = selectedClass === "all"
      ? students
      : students.filter(s => s.assigned_class === selectedClass);

    const filteredAttendance = selectedClass === "all"
      ? attendance
      : attendance.filter(a => a.assigned_class === selectedClass);

    const filteredProfiles = selectedClass === "all"
      ? profiles
      : profiles.filter(p => p.assigned_class === selectedClass);

    const totalStudents = filteredStudents.length;

    // Attendance rate
    const presentRecords = filteredAttendance.filter(a => a.status === true).length;
    const attendanceRate = filteredAttendance.length > 0
      ? parseFloat(((presentRecords / filteredAttendance.length) * 100).toFixed(1))
      : 0;

    // Gender
    const genderCount = filteredStudents.reduce((acc: Record<string, number>, s) => {
      const g = s.gender?.toLowerCase() || 'desconocido';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});
    const genderData = Object.entries(genderCount).map(([name, value]) => ({
      name: name === 'masculino' ? 'Masculino' : name === 'femenino' ? 'Femenino' : 'Sin dato',
      key: name,
      value: value as number,
    }));

    // Age groups (bucket bars)
    const ageBuckets: { name: string; value: number }[] = [
      { name: "0–11", value: 0 }, { name: "12–17", value: 0 },
      { name: "18–29", value: 0 }, { name: "30–44", value: 0 },
      { name: "45–59", value: 0 }, { name: "60–79", value: 0 },
      { name: "80+", value: 0 },
    ];
    let totalWithAge = 0;
    let ageSum = 0;
    filteredStudents.forEach(s => {
      if (!s.birthdate) return;
      try {
        const age = differenceInYears(new Date(), new Date(s.birthdate));
        ageSum += age;
        totalWithAge++;
        if (age <= 11) ageBuckets[0].value++;
        else if (age <= 17) ageBuckets[1].value++;
        else if (age <= 29) ageBuckets[2].value++;
        else if (age <= 44) ageBuckets[3].value++;
        else if (age <= 59) ageBuckets[4].value++;
        else if (age <= 79) ageBuckets[5].value++;
        else ageBuckets[6].value++;
      } catch { /* skip */ }
    });
    const avgAge = totalWithAge > 0 ? Math.round(ageSum / totalWithAge) : 0;

    // Exact age for detailed view
    const ages = filteredStudents.filter(s => s.birthdate)
      .map(s => differenceInYears(new Date(), new Date(s.birthdate)));
    const maxAge = ages.length > 0 ? Math.max(...ages) : 0;
    const exactAgeData = Array.from({ length: maxAge + 1 }, (_, i) => ({
      name: `${i}`, value: ages.filter(a => a === i).length
    }));

    // Growth — last 12 months
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      return { monthKey: format(d, 'yyyy-MM'), name: format(d, 'MMM', { locale: es }), count: 0, total: 0 };
    });
    filteredStudents.forEach(s => {
      if (!s.created_at) return;
      const m = format(new Date(s.created_at), 'yyyy-MM');
      const idx = last12Months.findIndex(lm => lm.monthKey === m);
      if (idx !== -1) last12Months[idx].count++;
    });
    const firstKey = last12Months[0].monthKey;
    let running = filteredStudents.filter(s => s.created_at && format(new Date(s.created_at), 'yyyy-MM') < firstKey).length;
    last12Months.forEach(m => { running += m.count; m.total = running; });

    // Monthly attendance rate — last 6 months
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return { monthKey: format(d, 'yyyy-MM'), name: format(d, 'MMM', { locale: es }), present: 0, absent: 0, rate: 0 };
    });
    filteredAttendance.forEach((a: any) => {
      const dateStr = a.created_at || a.date;
      if (!dateStr) return;
      try {
        const m = format(new Date(dateStr), 'yyyy-MM');
        const idx = last6Months.findIndex(lm => lm.monthKey === m);
        if (idx === -1) return;
        if (a.status === true) last6Months[idx].present++;
        else last6Months[idx].absent++;
      } catch { /* skip */ }
    });
    last6Months.forEach(m => {
      const total = m.present + m.absent;
      m.rate = total > 0 ? Math.round((m.present / total) * 100) : 0;
    });

    // Roles
    const rolesCount = filteredProfiles.reduce((acc: Record<string, number>, p) => {
      const r = p.role || 'otro';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    const roleData = Object.entries(rolesCount)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: value as number }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    // Class distribution
    const classDistributionData = (deptInfo?.classes || []).map((c: string) => ({
      name: c,
      value: filteredStudents.filter(s => s.assigned_class === c).length
    }));

    const totalVolunteers = filteredProfiles.filter(p => p.role === 'lider' || p.role === 'maestro').length;
    const newStudents = filteredStudents.filter((s: any) => s.nuevo).length;

    return {
      totalStudents, attendanceRate, avgAge, totalVolunteers, newStudents,
      genderData, ageBuckets, exactAgeData, last12Months, last6Months,
      roleData, classDistributionData, totalAttendanceRecords: filteredAttendance.length,
      totalProfiles: filteredProfiles.length,
    };
  }, [students, attendance, profiles, selectedClass, deptInfo]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const chartIds = ["membership-chart", "distribution-chart", "gender-chart", "roles-chart"];
      const companyName = deptInfo ? `Dpto. ${deptInfo.name}` : "Estadísticas";
      await exportStatsReport(data as any, chartIds, companyName);
      toast.success("Reporte PDF generado exitosamente");
    } catch {
      toast.error("Error al generar el reporte PDF");
    } finally {
      setIsExporting(false);
    }
  };

  if (loadingProfile || loadingStudents || loadingAttendance || loadingProfiles) {
    return <LoadingOverlay message="Cargando estadísticas..." />;
  }

  const deptLabel = deptInfo?.name
    ? deptInfo.name.charAt(0).toUpperCase() + deptInfo.name.slice(1)
    : null;

  const availableClasses: string[] = deptInfo?.classes || [];
  const maxAgeBucket = Math.max(...data.ageBuckets.map(b => b.value), 1);
  const maxRoleValue = Math.max(...data.roleData.map(r => r.value), 1);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950/50 pb-12">

      {/* ── Hero Header ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 px-6 md:px-10 pt-10 pb-16">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em] mb-2">
              {isGlobalView ? "Vista Global" : `Departamento · ${deptLabel}`}
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-none">
              Estadísticas
            </h1>
            <p className="text-indigo-200 mt-2 text-sm font-medium">
              {data.totalStudents} miembros activos · {data.totalAttendanceRecords.toLocaleString()} registros de asistencia
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {availableClasses.length > 0 && (
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="h-10 px-4 rounded-xl bg-white/15 text-white text-xs font-bold border border-white/20 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <option value="all" className="text-slate-800">Todas las clases</option>
                {availableClasses.map((c: string) => (
                  <option key={c} value={c} className="text-slate-800">{c}</option>
                ))}
              </select>
            )}
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 h-10 px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-black uppercase tracking-widest border border-white/20 backdrop-blur-sm transition-all disabled:opacity-60"
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Exportar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-8 -mt-8 space-y-6">

        {/* ── KPI Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Membresía Activa",
              value: data.totalStudents,
              suffix: "",
              sub: "miembros registrados",
              icon: Users,
              color: "from-indigo-500 to-violet-600",
              light: "bg-indigo-50 dark:bg-indigo-950/50",
              text: "text-indigo-600 dark:text-indigo-400",
            },
            {
              label: "Asistencia Promedio",
              value: data.attendanceRate,
              suffix: "%",
              sub: "tasa histórica",
              icon: TrendingUp,
              color: "from-emerald-500 to-teal-600",
              light: "bg-emerald-50 dark:bg-emerald-950/50",
              text: "text-emerald-600 dark:text-emerald-400",
            },
            {
              label: "Equipo de Servicio",
              value: data.totalVolunteers,
              suffix: "",
              sub: "líderes y maestros",
              icon: Award,
              color: "from-amber-500 to-orange-500",
              light: "bg-amber-50 dark:bg-amber-950/50",
              text: "text-amber-600 dark:text-amber-400",
            },
            {
              label: "Nuevos Miembros",
              value: data.newStudents,
              suffix: "",
              sub: "marcados como nuevo",
              icon: Star,
              color: "from-rose-500 to-pink-600",
              light: "bg-rose-50 dark:bg-rose-950/50",
              text: "text-rose-600 dark:text-rose-400",
            },
          ].map((kpi, i) => (
            <div key={i} className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${kpi.color}`} />
              <div className="p-6">
                <div className={`inline-flex p-3 rounded-2xl ${kpi.light} mb-4`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.text}`} />
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">
                    {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                  </span>
                  {kpi.suffix && <span className={`text-xl font-black ${kpi.text} mb-0.5`}>{kpi.suffix}</span>}
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Quick Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Edad Promedio", value: data.avgAge > 0 ? `${data.avgAge} años` : "—", icon: CalendarDays, color: "text-violet-500" },
            { label: "Perfiles de Gestión", value: data.totalProfiles, icon: UserCheck, color: "text-indigo-500" },
            { label: "Masculino", value: `${data.genderData.find(g => g.key === 'masculino')?.value ?? 0}`, icon: Users, color: "text-blue-500" },
            { label: "Femenino", value: `${data.genderData.find(g => g.key === 'femenino')?.value ?? 0}`, icon: BookOpen, color: "text-pink-500" },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 px-5 py-4 flex items-center gap-4 shadow-sm">
              <s.icon className={`h-8 w-8 ${s.color} shrink-0`} />
              <div>
                <p className="text-xl font-black text-slate-800 dark:text-white">{s.value}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts Row 1 ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Growth area chart — takes 3 cols */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="px-7 pt-7 pb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Evolución anual</p>
                <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Crecimiento de Membresía</h2>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-black bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-full">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Últimos 12 meses
              </div>
            </div>
            <div className="h-[260px] px-4 pb-4" id="membership-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.last12Months} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#6366f1" strokeWidth={3} fill="url(#gradIndigo)" dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#6366f1' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly attendance rate — 2 cols */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="px-7 pt-7 pb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Últimos 6 meses</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Tasa de Asistencia</h2>
            </div>
            <div className="h-[260px] px-4 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.last6Months} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} domain={[0, 100]} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="rate" name="Asistencia" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} unit="%" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Charts Row 2 ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Age buckets */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg p-7" id="distribution-chart">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Demografía</p>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-6">Grupos de Edad</h2>
            <div className="space-y-4">
              {data.ageBuckets.map((b, i) => (
                <div key={b.name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{b.name} años</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-800 dark:text-white">{b.value}</span>
                      <span className="text-[10px] text-slate-400 w-8 text-right">
                        {data.totalStudents > 0 ? `${Math.round((b.value / data.totalStudents) * 100)}%` : "0%"}
                      </span>
                    </div>
                  </div>
                  <ProgressBar value={b.value} max={maxAgeBucket} color={CHART_COLORS[i % CHART_COLORS.length]} />
                </div>
              ))}
            </div>
          </div>

          {/* Gender donut */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg p-7" id="gender-chart">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Composición</p>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-2">Género</h2>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.genderData} innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                    {data.genderData.map((entry, i) => (
                      <Cell key={i} fill={GENDER_COLORS[entry.key] || CHART_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 mt-2">
              {data.genderData.map((g, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: GENDER_COLORS[g.key] || CHART_COLORS[i] }} />
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800 dark:text-white">{g.value}</span>
                    <span className="text-[10px] text-slate-400 w-8 text-right">
                      {data.totalStudents > 0 ? `${Math.round((g.value / data.totalStudents) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Roles */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg p-7" id="roles-chart">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Equipo</p>
            <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight mb-6">Roles Ministeriales</h2>
            <div className="space-y-4">
              {data.roleData.length > 0 ? data.roleData.map((r, i) => (
                <div key={r.name} className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{r.name}</span>
                    <span className="text-xs font-black text-slate-800 dark:text-white">{r.value}</span>
                  </div>
                  <ProgressBar value={r.value} max={maxRoleValue} color={CHART_COLORS[i % CHART_COLORS.length]} />
                </div>
              )) : (
                <p className="text-sm text-slate-400 text-center py-8">Sin datos de roles</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Age bar chart + Class distribution ──────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Exact age histogram */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="px-7 pt-7 pb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Detalle</p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Edades Exactas</h2>
            </div>
            <div className="h-[240px] px-4 pb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.exactAgeData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} interval={4} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Miembros" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Class distribution (if scoped) or attendance horizontal bar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="px-7 pt-7 pb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {data.classDistributionData.length > 0 ? "Por clase" : "Resumen"}
              </p>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                {data.classDistributionData.length > 0 ? "Distribución por Clase" : "Resumen de Asistencia"}
              </h2>
            </div>
            {data.classDistributionData.length > 0 ? (
              <div className="h-[240px] px-4 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classDistributionData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#94a3b8' }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Miembros" fill="#8b5cf6" radius={[0, 8, 8, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="px-7 pb-7 space-y-5">
                {[
                  { label: "Total registros", value: data.totalAttendanceRecords, color: "#6366f1" },
                  { label: "Presentes", value: Math.round(data.totalAttendanceRecords * (data.attendanceRate / 100)), color: "#10b981" },
                  { label: "Ausentes", value: data.totalAttendanceRecords - Math.round(data.totalAttendanceRecords * (data.attendanceRate / 100)), color: "#f59e0b" },
                ].map(item => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{item.label}</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">{item.value.toLocaleString()}</span>
                    </div>
                    <ProgressBar value={item.value} max={data.totalAttendanceRecords || 1} color={item.color} />
                  </div>
                ))}
                <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Tasa global</p>
                    <p className="text-3xl font-black text-emerald-600 tracking-tighter">{data.attendanceRate}%</p>
                  </div>
                  <TrendingUp className="h-10 w-10 text-emerald-300" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary Footer ───────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 rounded-3xl p-8 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-8 -right-8 w-64 h-64 bg-white rounded-full blur-3xl" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-2">
              <p className="text-indigo-200 text-xs font-black uppercase tracking-[0.2em]">Resumen</p>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                {isGlobalView ? "Visión Congregacional" : `Dpto. ${deptLabel}`}
              </h3>
              <p className="text-indigo-200 text-sm max-w-xl">
                {isGlobalView
                  ? `La congregación cuenta con ${data.totalStudents} miembros activos, un equipo de ${data.totalVolunteers} líderes y maestros, y una tasa de participación del ${data.attendanceRate}%.`
                  : `El departamento tiene ${data.totalStudents} miembros activos con una participación del ${data.attendanceRate}%. Edad promedio: ${data.avgAge} años.`
                }
              </p>
            </div>
            <div className="grid grid-cols-3 gap-6 shrink-0">
              {[
                { label: "Miembros", value: data.totalStudents },
                { label: "Asistencia", value: `${data.attendanceRate}%` },
                { label: "Edad prom.", value: data.avgAge > 0 ? `${data.avgAge}a` : "—" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-3xl font-black text-white tracking-tighter">{s.value}</p>
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
