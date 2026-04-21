import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonStanding, Bell, Wrench } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import type { DepartmentType, Student, Department } from "@/types/database";
import { ClassStatsCard } from "./ClassStatsCard";

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
        maintenanceRequests?: any[];
    };
    actions: {
        onPendingRequestsClick: () => void;
        onMaintenanceClick?: () => void;
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
    const isDirectorOrAdminOrSecretary = isAdminOrSecretary || profile?.role === "director" || profile?.role === "director_general" || profile?.role === "vicedirector";

    const userDepartments = useMemo(() => {
        const depts = profile?.departments || [];
        if (depts.length === 0 && profile?.department_id) {
            const dept = departments.find(d => d.id === profile.department_id);
            if (dept) return [dept.name];
        }
        return depts;
    }, [profile?.departments, profile?.department_id, departments]);

    const userAssignedClass = profile?.assigned_class;

    const filteredStudents = isTeacherOrLeader && userAssignedClass
        ? students.filter(s => s.assigned_class === userAssignedClass)
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
            const studentDept = s.departments?.name || s.department;
            return studentDept === dept;
        });

        acc[dept] = {
            male: deptStudents.filter(s => s.gender === "masculino").length,
            female: deptStudents.filter(s => s.gender === "femenino").length,
            total: deptStudents.length
        };
        return acc;
    }, {} as DepartmentStatsMap);

    const formatDepartmentName = (name: string) => {
        if (!name) return "";
        return name.replace(/_/g, ' ').split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const departmentsWithStats = Object.entries(studentsByDepartment);
    const isSingleCard = departmentsWithStats.length === 1;

    let statsTitle = "";
    if (isTeacherOrLeader && userAssignedClass) {
        statsTitle = userAssignedClass;
    } else if (departmentsWithStats.length === 1) {
        statsTitle = formatDepartmentName(departmentsWithStats[0][0]);
    } else {
        statsTitle = "Estadísticas de Miembros";
    }

    const getStatsForClass = (deptName: string, className: string): ClassStats => {
        const deptStudents = students.filter(s => {
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
                        {statsTitle}
                    </h1>
                </div>

                {isDirectorOrAdminOrSecretary && pendingRequests.length > 0 && (
                    <Button
                        onClick={onPendingRequestsClick}
                        className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 py-5 shadow-lg shadow-primary/20 transition-all font-semibold"
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        Revisar {pendingRequests.length} Solicitud{pendingRequests.length !== 1 ? 'es' : ''}
                    </Button>
                )}

                {(profile?.role === 'conserje' || profile?.role === 'admin' || profile?.role === 'director_general' || (profile?.roles && profile.roles.includes('conserje'))) && data.maintenanceRequests && data.maintenanceRequests.length > 0 && (
                    <Button
                        onClick={actions.onMaintenanceClick}
                        className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-6 py-5 shadow-lg shadow-orange-500/20 transition-all font-semibold"
                    >
                        <Wrench className="mr-2 h-4 w-4" />
                        {data.maintenanceRequests.length} Reparacion{data.maintenanceRequests.length !== 1 ? 'es' : ''} Pendiente{data.maintenanceRequests.length !== 1 ? 's' : ''}
                    </Button>
                )}
            </div>

            {departmentsWithStats.length > 3 ? (
                <div className="px-10 relative">
                    <Carousel opts={{ align: "start" }} className="w-full">
                        <CarouselContent className="">
                            {departmentsWithStats.map(([dept, stats], index) => {
                                const departmentObj = departments.find(d => d.name === dept);
                                const hasClasses = departmentObj?.classes && departmentObj.classes.length > 0;

                                return (
                                    <CarouselItem key={dept} className="pl-6 md:basis-1/2 lg:basis-1/3">
                                        <ClassStatsCard
                                            className={formatDepartmentName(dept)}
                                            stats={stats}
                                            onClick={() => isDirectorOrAdminOrSecretary && hasClasses && departmentObj ? handleDepartmentClick(departmentObj) : () => { }}
                                        />
                                    </CarouselItem>
                                );
                            })}
                        </CarouselContent>
                        <CarouselPrevious className="absolute -left-4 top-1/2 -translate-y-1/2 bg-white text-slate-800 shadow-md" />
                        <CarouselNext className="absolute -right-4 top-1/2 -translate-y-1/2 bg-white text-slate-800 shadow-md" />
                    </Carousel>
                </div>
            ) : (
                <div className={`grid gap-6 mx-auto w-full ${isDirectorOrAdminOrSecretary && departmentsWithStats.length === 1 && departments.find(d => d.name === departmentsWithStats[0][0])?.classes?.length && departments.find(d => d.name === departmentsWithStats[0][0])!.classes!.length > 1
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                    : departmentsWithStats.length === 1
                        ? 'grid-cols-1 max-w-md'
                        : departmentsWithStats.length === 2
                            ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl'
                            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-[1100px]'
                    }`}>

                    {(profile?.role === 'director' || profile?.role === 'director_general' || profile?.role === 'vicedirector') && departmentsWithStats.length === 1 ? (
                        <>
                            {departments.find(d => d.name === departmentsWithStats[0][0])?.classes?.map((className) => (
                                <ClassStatsCard
                                    key={className}
                                    className={className}
                                    stats={getStatsForClass(departmentsWithStats[0][0], className)}
                                    onClick={() => onClassClick(departmentsWithStats[0][0], className)}
                                />
                            ))}
                        </>
                    ) : (profile?.role === 'maestro' || profile?.role === 'lider' || profile?.role === 'colaborador') ? (
                        userAssignedClass ? (
                            <ClassStatsCard
                                className={userAssignedClass}
                                stats={getStatsForClass(userDepartments[0], userAssignedClass)}
                                onClick={() => onClassClick(userDepartments[0], userAssignedClass)}
                                isSingleCard={true}
                            />
                        ) : (
                            <div className="col-span-full py-12 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white/50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-2">
                                        <PersonStanding className="h-8 w-8 opacity-20" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                        Aún no tienes una clase asignada
                                    </h3>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                        Para ver tus estadísticas y tomar asistencia, solicita a tu director que te asigne una clase en la gestión de usuarios.
                                    </p>
                                </div>
                            </div>
                        )
                    ) : (
                        departmentsWithStats.map(([dept, stats]) => {
                            const departmentObj = departments.find(d => d.name === dept);
                            const hasClasses = departmentObj?.classes && departmentObj.classes.length > 0;

                            return (
                                <ClassStatsCard
                                    key={dept}
                                    className={formatDepartmentName(dept)}
                                    stats={stats}
                                    onClick={() => isDirectorOrAdminOrSecretary && hasClasses && departmentObj ? handleDepartmentClick(departmentObj) : () => { }}
                                    isSingleCard={departmentsWithStats.length === 1}
                                />
                            )
                        })
                    )}
                </div>
            )}

            {selectedDepartment && (
                <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                    <DialogContent className="w-[95vw] max-w-4xl glass-card border-none p-0 max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="bg-primary/10 p-8 border-b border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-primary mb-1">
                                    {formatDepartmentName(selectedDepartment.name || '')}
                                </DialogTitle>
                                <p className="text-muted-foreground">Desglose de miembros por clase asignada</p>
                            </DialogHeader>
                        </div>
                        <div className="p-8">
                            {selectedDepartment.classes && selectedDepartment.classes.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {selectedDepartment.classes.map((className) => {
                                        const classStats = getStatsForClass(selectedDepartment.name || '', className);
                                        return (
                                            <div
                                                key={className}
                                                className="bg-accent/5 dark:bg-accent/10 border border-accent/20 rounded-xl p-6 cursor-pointer hover:bg-background transition-all"
                                                onClick={() => onClassClick(selectedDepartment.name || '', className)}
                                            >
                                                <div className="flex justify-between items-center mb-6">
                                                    <h4 className="text-lg font-bold">{className}</h4>
                                                    <Badge variant="secondary" className="bg-primary text-white">{classStats.total} TOTAL</Badge>
                                                </div>
                                                <div className="flex justify-around">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-2xl font-black text-blue-500">{classStats.male}</span>
                                                        <span className="text-[10px] opacity-50 uppercase">Varones</span>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-2xl font-black text-pink-500">{classStats.female}</span>
                                                        <span className="text-[10px] opacity-50 uppercase">Mujeres</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 opacity-50 italic">No hay clases configuradas</div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
