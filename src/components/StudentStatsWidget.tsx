import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonStanding, CheckCircle2, Plus, Bell } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { DepartmentType, Student, Department } from "@/types/database";

interface ClassStats {
    male: number;
    female: number;
    total: number;
}

type DepartmentStatsMap = Record<DepartmentType, ClassStats>;

export interface StudentStatsWidgetProps {
    auth: {
        profile: any;
        isAdminOrSecretary: boolean;
        isTeacherOrLeader: boolean;
    };
    data: {
        students: Student[];
        departments: Department[];
        pendingRequests: any[];
    };
    actions: {
        onPendingRequestsClick: () => void;
        onClassClick: (departmentName: string, className: string) => void;
    };
}

export function StudentStatsWidget({ auth, data, actions }: StudentStatsWidgetProps) {
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);

    const handleDepartmentClick = (department: Department) => {
        setSelectedDepartment(department);
        setDetailsDialogOpen(true);
    };

    const { profile, isAdminOrSecretary, isTeacherOrLeader } = auth;
    const { students, departments, pendingRequests } = data;
    const { onPendingRequestsClick, onClassClick } = actions;
    const isDirectorOrAdminOrSecretary = isAdminOrSecretary || profile?.role === "director";

    const userDepartments = profile?.departments || [];
    const userAssignedClass = profile?.assigned_class;

    const filteredStudents = isTeacherOrLeader && userAssignedClass
        ? students.filter(s => s.assigned_class === userAssignedClass || s.isAuthorized)
        : students;

    let departmentsToShow: DepartmentType[] = [];

    if (isAdminOrSecretary) {
        departmentsToShow = departments
            .map(dept => dept.name as DepartmentType)
            .filter(name => name && name !== 'calendario');
    } else {
        departmentsToShow = userDepartments.filter((dept: any) =>
            dept !== 'calendario' && departments.some(d => d.name === dept)
        ) as DepartmentType[];
    }

    const studentsByDepartment = departmentsToShow.reduce<DepartmentStatsMap>((acc, dept) => {
        if (!isAdminOrSecretary && !userDepartments.includes(dept)) {
            return acc;
        }

        let deptStudents = filteredStudents.filter(s => {
            const studentDept = s.department && s.departments?.name ? s.departments.name : s.department;
            return studentDept === dept || s.isAuthorized;
        });
        acc[dept] = {
            male: deptStudents.filter(s => s.gender === "masculino").length,
            female: deptStudents.filter(s => s.gender === "femenino").length,
            total: deptStudents.length
        };
        return acc;
    }, {} as DepartmentStatsMap);

    const formatDepartmentName = (name: string) => {
        return name.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const departmentsWithStats = Object.entries(studentsByDepartment);
    const isSingleCard = departmentsWithStats.length === 1;
    const showClassLabel = isTeacherOrLeader && userAssignedClass;

    let statsTitle = "";
    if (isTeacherOrLeader && userAssignedClass) {
        statsTitle = userAssignedClass;
    } else if (departmentsWithStats.length === 1) {
        statsTitle = formatDepartmentName(departmentsWithStats[0][0]);
    } else {
        statsTitle = "Estadísticas de Miembros";
    }

    const getStatsForClass = (deptName: string, className: string): ClassStats => {
        const deptStudents = filteredStudents.filter(s => {
            const studentDept = s.departments?.name || s.department;
            return studentDept === deptName && s.assigned_class === className;
        });

        return {
            male: deptStudents.filter(s => s.gender === "masculino").length,
            female: deptStudents.filter(s => s.gender === "femenino").length,
            total: deptStudents.length
        };
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col items-center justify-center text-center mb-10 gap-4 mt-6">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                        Resumen Institucional
                    </h1>
                </div>

                {isAdminOrSecretary && pendingRequests.length > 0 && (
                    <Button
                        onClick={onPendingRequestsClick}
                        className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 shadow-lg shadow-primary/20 transition-all font-semibold"
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        Revisar {pendingRequests.length} Solicitud{pendingRequests.length !== 1 ? 'es' : ''}
                    </Button>
                )}
            </div>

            {departmentsWithStats.length > 3 ? (
                <div className="px-10 relative">
                    <Carousel
                        opts={{
                            align: "start",
                        }}
                        className="w-full"
                    >
                        <CarouselContent className="">
                            {departmentsWithStats.map(([dept, stats], index) => {
                                const departmentObj = departments.find(d => d.name === dept);
                                const hasClasses = departmentObj?.classes && departmentObj.classes.length > 0;
                                const malePercent = stats.total > 0 ? (stats.male / stats.total) * 100 : 0;
                                const femalePercent = stats.total > 0 ? (stats.female / stats.total) * 100 : 0;

                                return (
                                    <CarouselItem key={dept} className="pl-6 md:basis-1/2 lg:basis-1/3">
                                        <div
                                            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all duration-300 group h-full"
                                            style={{ animationDelay: `${index * 0.1}s` }}
                                            onClick={() => isDirectorOrAdminOrSecretary && hasClasses && departmentObj ? handleDepartmentClick(departmentObj) : null}
                                        >
                                            <div className="flex justify-between items-start mb-8">
                                                <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                                    <PersonStanding className="h-6 w-6" />
                                                </div>
                                            </div>

                                            <div className="mb-8">
                                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                                                    {formatDepartmentName(dept)}
                                                </h3>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-slate-900 dark:text-white">{stats.total}</span>
                                                    <span className="text-sm font-semibold text-slate-500">MIEMBROS</span>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                                    <div
                                                        className="h-full bg-indigo-500 transition-all duration-1000"
                                                        style={{ width: `${malePercent}%` }}
                                                    ></div>
                                                    <div
                                                        className="h-full bg-fuchsia-400 transition-all duration-1000"
                                                        style={{ width: `${femalePercent}%` }}
                                                    ></div>
                                                </div>
                                                <div className="flex justify-between text-sm font-medium text-slate-500">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                        <span>Masculino {stats.male}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-fuchsia-400"></div>
                                                        <span>Femenino {stats.female}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white hover:bg-slate-100 text-slate-800 shadow-md" />
                        <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2 bg-white hover:bg-slate-100 text-slate-800 shadow-md" />
                    </Carousel>
                </div>
            ) : (
                <div className={`grid gap-6 ${isSingleCard ? 'place-items-center' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {departmentsWithStats.map(([dept, stats], index) => {
                        const departmentObj = departments.find(d => d.name === dept);
                        const hasClasses = departmentObj?.classes && departmentObj.classes.length > 0;
                        const malePercent = stats.total > 0 ? (stats.male / stats.total) * 100 : 0;
                        const femalePercent = stats.total > 0 ? (stats.female / stats.total) * 100 : 0;

                        return (
                            <div
                                key={dept}
                                className={`bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all duration-300 group ${isSingleCard ? 'w-full max-w-md' : ''}`}
                                style={{ animationDelay: `${index * 0.1}s` }}
                                onClick={() => isDirectorOrAdminOrSecretary && hasClasses && departmentObj ? handleDepartmentClick(departmentObj) : null}
                            >
                                <div className="flex justify-between items-start mb-8">
                                    <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                        <PersonStanding className="h-6 w-6" />
                                    </div>
                                </div>

                                <div className="mb-8">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                                        {formatDepartmentName(dept)}
                                    </h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-slate-900 dark:text-white">{stats.total}</span>
                                        <span className="text-sm font-semibold text-slate-500">MIEMBROS</span>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                                        <div
                                            className="h-full bg-indigo-500 transition-all duration-1000"
                                            style={{ width: `${malePercent}%` }}
                                        ></div>
                                        <div
                                            className="h-full bg-fuchsia-400 transition-all duration-1000"
                                            style={{ width: `${femalePercent}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-sm font-medium text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                            <span>Masculino {stats.male}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-fuchsia-400"></div>
                                            <span>Femenino {stats.female}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selectedDepartment && (
                <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                    <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl glass-card border-none p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl">
                        <div className="bg-primary/10 p-8 border-b border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-primary mb-1">
                                    {formatDepartmentName(selectedDepartment.name || '')}
                                </DialogTitle>
                                <p className="text-muted-foreground">Desglose de miembros por clase asignada</p>
                            </DialogHeader>
                        </div>

                        <div className="p-8 max-h-[70vh] overflow-y-auto">
                            {selectedDepartment.classes && selectedDepartment.classes.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {selectedDepartment.classes.map((className, idx) => {
                                        const classStats = getStatsForClass(selectedDepartment.name || '', className);
                                        return (
                                            <div
                                                key={className}
                                                className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl p-6 cursor-pointer hover:bg-background hover:shadow-xl hover:border-primary/30 transition-all duration-300 animate-fade-in"
                                                style={{ animationDelay: `${idx * 0.05}s` }}
                                                onClick={() => onClassClick(selectedDepartment.name || '', className)}
                                            >
                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-lg font-bold text-foreground">{className}</h4>
                                                    <div className="bg-primary text-white px-3 py-1 rounded-full text-xs font-black">
                                                        {classStats.total} TOTAL
                                                    </div>
                                                </div>

                                                <div className="flex justify-around gap-8">
                                                    <div className="flex flex-col items-center group/gender">
                                                        <div className="bg-[#3A82AF]/10 p-3 rounded-2xl group-hover/gender:bg-[#3A82AF]/20 transition-colors mb-2">
                                                            <PersonStanding className="h-8 w-8 text-[#3A82AF]" />
                                                        </div>
                                                        <span className="text-2xl font-black text-[#3A82AF]">{classStats.male}</span>
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Varones</span>
                                                    </div>

                                                    <div className="flex flex-col items-center group/gender">
                                                        <div className="bg-[#E83E8C]/10 p-3 rounded-2xl group-hover/gender:bg-[#E83E8C]/20 transition-colors mb-2">
                                                            <PersonStanding className="h-8 w-8 text-[#E83E8C]" />
                                                        </div>
                                                        <span className="text-2xl font-black text-[#E83E8C]">{classStats.female}</span>
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mujeres</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 opacity-50">
                                    <p className="text-lg font-medium">No hay clases configuradas</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
