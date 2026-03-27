
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { Users, TrendingUp, DollarSign, Award, Loader2, Info, FileDown, Building2, ShieldCheck } from "lucide-react";
import { format, subMonths, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { exportStatsReport } from "@/lib/statsPdfUtils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const COLORS = ["#002366", "#003a8c", "#0050b3", "#096dd9", "#1890ff", "#40a9ff", "#69c0ff"];

const GLOBAL_ROLES = ["admin", "secretaria"];

export default function Estadisticas() {

    // 0. Get current user profile (for role+department scoping)
    const { data: currentProfile, isLoading: loadingProfile } = useQuery({
        queryKey: ['stats-current-profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            if (error) throw error;
            return data;
        }
    });

    const isGlobalView = !currentProfile || GLOBAL_ROLES.includes(currentProfile.role);
    const scopedDeptId = isGlobalView ? null : currentProfile?.department_id;

    // 1. Fetch Students (scoped by department if needed)
    const { data: students = [], isLoading: loadingStudents } = useQuery({
        queryKey: ['stats-students', scopedDeptId],
        enabled: !loadingProfile,
        queryFn: async () => {
            let q = supabase.from('students').select('*');
            if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
            const { data, error } = await q;
            if (error) throw error;
            return data;
        }
    });

    // 2. Fetch Attendance (scoped by department if needed)
    const { data: attendance = [], isLoading: loadingAttendance } = useQuery({
        queryKey: ['stats-attendance', scopedDeptId],
        enabled: !loadingProfile,
        queryFn: async () => {
            let q = supabase.from('attendance').select('*');
            if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
            const { data, error } = await q;
            if (error) throw error;
            return data;
        }
    });

    // 3. Fetch Profiles - for global view only show all, for scoped show same dept
    const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
        queryKey: ['stats-profiles', scopedDeptId],
        enabled: !loadingProfile,
        queryFn: async () => {
            let q = supabase.from('profiles').select('*');
            if (scopedDeptId) q = q.eq('department_id', scopedDeptId);
            const { data, error } = await q;
            if (error) throw error;
            return data;
        }
    });

    // 4. Fetch dept name if scoped
    const { data: deptInfo } = useQuery({
        queryKey: ['stats-dept', scopedDeptId],
        enabled: !!scopedDeptId,
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('name')
                .eq('id', scopedDeptId)
                .single();
            if (error) throw error;
            return data;
        }
    });

    // --- DATA PROCESSING ---
    const processedData = useMemo(() => {
        if (!students.length && !attendance.length) return null;

        const totalStudents = students.length;

        // Gender Distribution
        const genderCount = students.reduce((acc: Record<string, number>, s) => {
            const g = s.gender?.toLowerCase() || 'desconocido';
            acc[g] = (acc[g] || 0) + 1;
            return acc;
        }, {});
        const genderData: { name: string; value: number }[] = Object.entries(genderCount).map(([name, value]) => ({
            name: name === 'masculino' ? 'Masculino' : name === 'femenino' ? 'Femenino' : 'Desconocido',
            value
        }));

        // Age Groups
        const ageGroups: Record<string, number> = {
            "0-11 años": 0,
            "12-17 años": 0,
            "18-29 años": 0,
            "30-44 años": 0,
            "45-59 años": 0,
            "60-79 años": 0,
            "80+ años": 0,
            "Sin datos": 0
        };
        students.forEach(s => {
            if (!s.birthdate) { ageGroups["Sin datos"]++; return; }
            try {
                const age = differenceInYears(new Date(), new Date(s.birthdate));
                if (age <= 11) ageGroups["0-11 años"]++;
                else if (age <= 17) ageGroups["12-17 años"]++;
                else if (age <= 29) ageGroups["18-29 años"]++;
                else if (age <= 44) ageGroups["30-44 años"]++;
                else if (age <= 59) ageGroups["45-59 años"]++;
                else if (age <= 79) ageGroups["60-79 años"]++;
                else ageGroups["80+ años"]++;
            } catch { ageGroups["Sin datos"]++; }
        });
        const ageData = Object.entries(ageGroups).map(([name, value]) => ({ name, value }));

        // Membership Growth (last 12 months)
        const last12Months = Array.from({ length: 12 }, (_, i) => {
            const d = subMonths(new Date(), 11 - i);
            return { monthKey: format(d, 'yyyy-MM'), name: format(d, 'MMM', { locale: es }), count: 0, total: 0 };
        });
        students.forEach(s => {
            if (!s.created_at) return;
            const m = format(new Date(s.created_at), 'yyyy-MM');
            const idx = last12Months.findIndex(lm => lm.monthKey === m);
            if (idx !== -1) last12Months[idx].count++;
        });

        const firstMonthKey = last12Months[0].monthKey;
        let runningTotal = students.filter(s => s.created_at && format(new Date(s.created_at), 'yyyy-MM') < firstMonthKey).length;
        last12Months.forEach(m => { runningTotal += m.count; m.total = runningTotal; });

        // Attendance
        const presentRecords = attendance.filter(a => a.status === true).length;
        const attendanceRate = attendance.length > 0 ? ((presentRecords / attendance.length) * 100).toFixed(1) : "0";

        // Roles
        const rolesCount = profiles.reduce((acc: Record<string, number>, p) => {
            const r = p.role || 'Otros';
            acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, {});
        const roleData: { name: string; value: number }[] = Object.entries(rolesCount)
            .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
            .sort((a, b) => b.value - a.value);

        return {
            totalStudents,
            genderData,
            ageData,
            last12Months,
            attendanceRate,
            roleData,
            totalVolunteers: profiles.filter(p => p.role === 'lider' || p.role === 'maestro').length,
            newStudents: students.filter(s => s.nuevo).length
        };
    }, [students, attendance, profiles]);

    const [isExporting, setIsExporting] = React.useState(false);

    const handleExport = async () => {
        if (!processedData) return;
        setIsExporting(true);
        try {
            const chartIds = ["membership-chart", "age-chart", "gender-chart", "roles-chart"];
            const companyName = deptInfo ? `Dpto. ${deptInfo.name}` : "CCDT";
            await exportStatsReport(processedData, chartIds, companyName);
            toast.success("Reporte PDF generado exitosamente");
        } catch (error) {
            console.error("Error exporting report:", error);
            toast.error("Error al generar el reporte PDF");
        } finally {
            setIsExporting(false);
        }
    };

    if (loadingProfile || loadingStudents || loadingAttendance || loadingProfiles) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-muted-foreground font-medium animate-pulse text-lg tracking-tight">Consolidando registros ministeriales...</p>
            </div>
        );
    }

    const data = processedData;
    const deptLabel = deptInfo?.name ? deptInfo.name.charAt(0).toUpperCase() + deptInfo.name.slice(1) : null;

    return (
        <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: "Membresía Activa", value: data?.totalStudents || "0", icon: Users, trend: "Miembros actuales", color: "text-blue-600", bg: "bg-blue-50" },
                    { title: "Tasa Participación", value: `${data?.attendanceRate}%`, icon: TrendingUp, trend: "Promedio histórico", color: "text-emerald-600", bg: "bg-emerald-50" },
                    { title: "Equipos Servicio", value: data?.totalVolunteers || "0", icon: Award, trend: "Líderes y Maestros", color: "text-purple-600", bg: "bg-purple-50" },
                    { title: "Ingresos (Mock)", value: "$6,240", icon: DollarSign, trend: "Referencial", color: "text-amber-600", bg: "bg-amber-50" },
                ].map((kpi, i) => (
                    <Card key={i} className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 group">
                        <CardContent className="p-7">
                            <div className="flex justify-between items-start">
                                <div className={`p-4 rounded-2xl ${kpi.bg} dark:bg-slate-800 ${kpi.color} shadow-inner group-hover:scale-110 transition-transform duration-500`}>
                                    <kpi.icon className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800/80 whitespace-nowrap">
                                    {kpi.trend}
                                </span>
                            </div>
                            <div className="mt-6">
                                <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{kpi.title}</p>
                                <h3 className="text-4xl font-black mt-1 text-[#002366] dark:text-white tracking-tighter">{kpi.value}</h3>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Growth Area Chart */}
                <Card className="rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <CardHeader className="pb-2 pt-10 px-10">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse"></div>
                            <CardTitle className="text-2xl font-black tracking-tight text-[#002366] dark:text-white">Curva de Membresía</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500 font-medium">Evolución acumulada de registros en el último año</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] pt-8 px-6" id="membership-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data?.last12Months}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#002366" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#002366" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} dy={15} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }} itemStyle={{ color: '#002366', fontWeight: 900, fontSize: '14px' }} />
                                <Area type="monotone" dataKey="total" name="Miembros" stroke="#002366" strokeWidth={5} fillOpacity={1} fill="url(#colorTotal)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Age group Bar Chart */}
                <Card className="rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <CardHeader className="pb-2 pt-10 px-10">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></div>
                            <CardTitle className="text-2xl font-black tracking-tight text-[#002366] dark:text-white">Capas Generacionales</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500 font-medium">Distribución por rangos etarios ministeriales</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] pt-8 px-6" id="age-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.ageData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} dy={15} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '20px', border: 'none' }} />
                                <Bar dataKey="value" name="Miembros" fill="#002366" radius={[14, 14, 0, 0]} barSize={55} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Gender Pie Chart */}
                <Card className="rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <CardHeader className="pb-2 pt-10 px-10">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></div>
                            <CardTitle className="text-2xl font-black tracking-tight text-[#002366] dark:text-white">Equilibrio Demográfico</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500 font-medium">Composición por género de la membresía</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] pt-6 flex items-center justify-center" id="gender-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={data?.genderData} innerRadius={75} outerRadius={110} paddingAngle={10} dataKey="value" stroke="none">
                                    {data?.genderData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '20px' }} />
                                <Legend iconType="circle" wrapperStyle={{ fontWeight: 700 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Roles Horizontal Bar */}
                <Card className="rounded-[2.5rem] border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
                    <CardHeader className="pb-2 pt-10 px-10">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-600 animate-pulse"></div>
                            <CardTitle className="text-2xl font-black tracking-tight text-[#002366] dark:text-white">Organigrama Ministerial</CardTitle>
                        </div>
                        <CardDescription className="text-slate-500 font-medium">Distribución de roles activos según perfil</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px] pt-8 px-6" id="roles-chart">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data?.roleData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800, fill: '#1e293b' }} width={120} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '20px' }} />
                                <Bar dataKey="value" name="Personal" fill="#002366" radius={[0, 10, 10, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Insights Section */}
            <div className="pt-4">
                <Card className="bg-gradient-to-r from-[#f8fafc] to-white dark:from-slate-900 dark:to-slate-800 border-[3px] border-slate-50/50 dark:border-slate-800 rounded-[4rem] p-6 md:p-14 shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10 flex flex-col xl:flex-row gap-16 items-center">
                        <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-700 min-w-[340px] relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
                            <div className="flex items-center gap-4 mb-6">
                                <Info className="h-8 w-8 text-blue-600" />
                                <h4 className="text-2xl font-bold text-[#002366] dark:text-white tracking-tight">Status del Sistema</h4>
                            </div>
                            <p className="text-sm font-medium text-slate-500 leading-relaxed mb-6">
                                Basado en <span className="text-blue-600 font-bold">{attendance.length}</span> registros de asistencia y <span className="text-indigo-600 font-bold">{profiles.length}</span> perfiles de gestión.
                                {!isGlobalView && deptLabel && (
                                    <span className="block mt-2 text-amber-600 font-bold">📌 Vista filtrada: {deptLabel}</span>
                                )}
                            </p>
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1">
                                    <p className="text-5xl font-black text-[#002366] dark:text-blue-400 tracking-tighter">{data?.newStudents}</p>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Nuevos Miembros</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-5xl font-black text-emerald-600 tracking-tighter">{data?.attendanceRate}%</p>
                                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Compromiso</p>
                                </div>
                            </div>
                            <div className="mt-10">
                                <button
                                    onClick={handleExport}
                                    disabled={isExporting || !data}
                                    className="w-full py-4 bg-[#002366] dark:bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-2xl hover:bg-blue-800 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isExporting ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" />Capturando datos...</>
                                    ) : (
                                        <><FileDown className="h-4 w-4" />Exportar Reporte (PDF)</>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 text-center xl:text-left">
                            <h3 className="text-4xl md:text-5xl font-black text-[#002366] dark:text-white leading-[1.05] tracking-tighter">
                                {isGlobalView ? "Visión Global" : `Dpto. ${deptLabel}`} <br />
                                <span className="text-blue-500">Multidimensional</span>
                            </h3>
                            <p className="text-xl text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-4xl">
                                {isGlobalView
                                    ? <>La base de datos refleja una membresía de <span className="text-blue-600 font-black">{data?.totalStudents}</span> integrantes con una participación promedio del <span className="text-emerald-600 font-black">{data?.attendanceRate}%</span>. La concentración en Jóvenes y Adolescentes sugiere un ecosistema dinámico.</>
                                    : <>Tu departamento cuenta con <span className="text-blue-600 font-black">{data?.totalStudents}</span> miembros y un índice de compromiso del <span className="text-emerald-600 font-black">{data?.attendanceRate}%</span>. Estos datos son exclusivos de tu área de gestión.</>
                                }
                            </p>
                            <div className="flex flex-wrap justify-center xl:justify-start gap-4">
                                {(isGlobalView
                                    ? ["Visión 2026", "Big Data Rhema", "Ecosistema Vivo", "Gestión Proactiva"]
                                    : [`Dpto. ${deptLabel}`, "Mi Área", "Gestión Focalizada", "Datos en Tiempo Real"]
                                ).map(tag => (
                                    <span key={tag} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800/80 text-[#002366] dark:text-blue-300 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-blue-50 transition-colors">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
