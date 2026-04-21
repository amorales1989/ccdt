import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Clock, ChevronRight, AlertCircle, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MaintenanceSummaryWidgetProps {
    requests: any[];
}

export function MaintenanceSummaryWidget({ requests }: MaintenanceSummaryWidgetProps) {
    const navigate = useNavigate();

    const pending = requests.filter(r => r.status === 'pendiente');
    const inProcess = requests.filter(r => r.status === 'en_proceso');

    const recentRequests = [...requests]
        .sort((a, b) => {
            const priorityMap: any = { 'urgente': 3, 'alta': 2, 'normal': 1, 'baja': 0 };
            const pA = priorityMap[a.priority] || 0;
            const pB = priorityMap[b.priority] || 0;
            if (pA !== pB) return pB - pA;
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
        .slice(0, 5);

    const getPriorityStyles = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'urgente': return "bg-red-50 text-red-600 border-red-100";
            case 'alta': return "bg-orange-50 text-orange-600 border-orange-100";
            default: return "bg-slate-50 text-slate-500 border-slate-100";
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header delicado y minimalista */}
            <div className="flex flex-col md:flex-row md:items-end justify-between px-2 gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">
                        Panel de Mantenimiento
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Estado de las instalaciones</p>
                </div>

                <div className="flex gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{pending.length} Pendientes</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{inProcess.length} En curso</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Lista de Prioridades */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Atención Prioritaria
                        </h2>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate("/mantenimiento")}
                            className="text-primary font-bold text-xs hover:bg-primary/5"
                        >
                            Ver todas
                        </Button>
                    </div>

                    <div className="grid gap-3">
                        {recentRequests.length > 0 ? (
                            recentRequests.map((req, index) => (
                                <div
                                    key={req.id}
                                    onClick={() => navigate("/mantenimiento")}
                                    className="group flex flex-row items-center p-2 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-transparent hover:border-slate-200 hover:shadow-sm transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-left-4"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className={`w-[4.25rem] h-[4.25rem] shrink-0 flex flex-col items-center justify-center rounded-xl ml-1 ${getPriorityStyles(req.priority).split(' ').slice(0, 2).join(' ')}`}>
                                        <Wrench className="h-6 w-6 opacity-80" />
                                    </div>

                                    <div className="flex-1 px-4 flex flex-col justify-center min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-primary transition-colors">
                                                {req.title}
                                            </h3>
                                            <Badge variant="outline" className={`text-[9px] font-black uppercase px-2 py-0 border-none ${getPriorityStyles(req.priority)}`}>
                                                {req.priority || 'Normal'}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                                            <span className="flex items-center gap-1.5 text-slate-500">
                                                <MapPin className="h-3 w-3 opacity-60" />
                                                {req.location || 'UBICACIÓN N/D'}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="h-3 w-3 opacity-60" />
                                                {req.status?.replace('_', ' ') || 'PENDIENTE'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="pr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <ChevronRight className="h-5 w-5 text-primary" />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                                <p className="text-slate-400 font-medium text-sm italic">No hay solicitudes que requieran atención inmediata</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Card de Acción (Color Naranja/Ambar Premium) */}
                <div className="space-y-6">
                    <Card className="border-none shadow-2xl bg-gradient-to-br from-orange-500 to-amber-600 overflow-hidden rounded-3xl relative h-full flex flex-col group min-h-[280px]">
                        {/* Efecto de luz ambiental */}
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-white/30 transition-colors duration-700" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-400/20 rounded-full blur-[60px] -ml-16 -mb-16" />

                        <CardContent className="p-8 flex flex-col flex-1 justify-between relative z-10">
                            <div className="space-y-6">
                                <div className="h-14 w-14 bg-white/20 rounded-2xl flex items-center justify-center text-white ring-1 ring-white/30 backdrop-blur-md group-hover:scale-110 transition-transform duration-500 shadow-lg">
                                    <Wrench className="h-7 w-7" />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-2xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
                                        Gestión de Mantenimiento
                                    </h3>
                                    <p className="text-orange-50 text-sm font-medium leading-relaxed drop-shadow-sm">
                                        Accede al panel completo para actualizar estados, añadir fotos o documentar resoluciones técnicas.
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={() => navigate("/mantenimiento")}
                                className="w-full bg-white hover:bg-orange-50 text-orange-600 font-black h-14 rounded-2xl shadow-2xl mt-8 group-active:scale-[0.98] transition-all border-none"
                            >
                                IR AL PANEL COMPLETO
                                <ChevronRight className="ml-2 h-5 w-5" />
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
