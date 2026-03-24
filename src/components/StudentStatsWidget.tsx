import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonStanding, CheckCircle2, Plus, Bell } from "lucide-react";
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
        statsTitle = "Estadísticas de Alumnos";
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
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 px-2">
                <div className="text-center md:text-left">
                    <h2 className="text-3xl font-bold tracking-tight text-primary">
                        {statsTitle}
                    </h2>
                    <p className="text-muted-foreground text-sm">Resumen general y distribución por género</p>
                </div>

                {isAdminOrSecretary && pendingRequests.length > 0 && (
                    <Button
                        onClick={onPendingRequestsClick}
                        variant="outline"
                        className="bg-orange-50/50 border-orange-200 hover:bg-orange-100 text-orange-700 hover:text-orange-800 transition-all duration-300 shadow-sm hover:shadow-md animate-bounce-slow"
                    >
                        <Bell className="mr-2 h-4 w-4" />
                        <span className="mr-2">
                            Solicitud{pendingRequests.length !== 1 ? 'es' : ''} Pendiente{pendingRequests.length !== 1 ? 's' : ''}
                        </span>
                        <Badge variant="secondary" className="bg-orange-200 text-orange-800 font-bold px-2 py-0.5 rounded-full">
                            {pendingRequests.length}
                        </Badge>
                    </Button>
                )}
            </div>

            <div className={`grid gap-6 ${isSingleCard ? 'place-items-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {departmentsWithStats.map(([dept, stats], index) => {
                    const departmentObj = departments.find(d => d.name === dept);
                    const hasClasses = departmentObj?.classes && departmentObj.classes.length > 0;
                    const malePercent = stats.total > 0 ? (stats.male / stats.total) * 100 : 0;
                    const femalePercent = stats.total > 0 ? (stats.female / stats.total) * 100 : 0;

                    return (
                        <div
                            key={dept}
                            className={`glass-card group relative p-6 cursor-pointer hover:border-primary/50 transition-all duration-500 hover:-translate-y-1 animate-slide-in ${isSingleCard ? 'w-full max-w-md' : ''}`}
                            style={{ animationDelay: `${index * 0.1}s` }}
                            onClick={() => isDirectorOrAdminOrSecretary && hasClasses && departmentObj ? handleDepartmentClick(departmentObj) : null}
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <PersonStanding className="h-12 w-12 text-primary rotate-12" />
                            </div>

                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <Badge variant="outline" className="mb-2 bg-primary/10 text-primary border-primary/20">
                                        Departamento
                                    </Badge>
                                    <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                                        {formatDepartmentName(dept)}
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-primary">{stats.total}</p>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Alumnos</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-1 text-[#3A82AF] uppercase">
                                            <PersonStanding className="h-3 w-3" /> Varones
                                        </span>
                                        <span>{stats.male} ({Math.round(malePercent)}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-accent/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#3A82AF] to-[#60b3e5] rounded-full transition-all duration-1000"
                                            style={{ width: `${malePercent}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-1 text-[#E83E8C] uppercase">
                                            <PersonStanding className="h-3 w-3" /> Mujeres
                                        </span>
                                        <span>{stats.female} ({Math.round(femalePercent)}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-accent/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#E83E8C] to-[#f988b4] rounded-full transition-all duration-1000"
                                            style={{ width: `${femalePercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {(showClassLabel || (isAdminOrSecretary && hasClasses)) && (
                                <div className="mt-8 flex items-center justify-between text-xs border-t border-accent/20 pt-4">
                                    {showClassLabel ? (
                                        <span className="flex items-center gap-1 font-medium bg-secondary/10 text-secondary px-2 py-1 rounded">
                                            <CheckCircle2 className="h-3 w-3" /> Clase: {userAssignedClass}
                                        </span>
                                    ) : <span></span>}

                                    {isDirectorOrAdminOrSecretary && hasClasses && (
                                        <span className="text-primary font-bold hover:underline flex items-center gap-1 group-hover:gap-2 transition-all">
                                            Ver detalles <Plus className="h-3 w-3" />
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedDepartment && (
                <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                    <DialogContent className="w-[95vw] max-w-4xl sm:max-w-4xl glass-card border-none p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden shadow-2xl">
                        <div className="bg-primary/10 p-8 border-b border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-primary mb-1">
                                    {formatDepartmentName(selectedDepartment.name || '')}
                                </DialogTitle>
                                <p className="text-muted-foreground">Desglose de alumnos por clase asignada</p>
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
