import React, { useState, useMemo } from 'react';
import { Student } from "@/types/database";
import { Table, TableBody, TableCell, TableRow, TableHeader, TableHead } from "@/components/ui/table";
import { differenceInYears, parse, isValid, getMonth, getDate, isBefore, isSameDay } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";

export interface BirthdayListProps {
    students: Student[];
}

export const BirthdayList: React.FC<BirthdayListProps> = ({ students }) => {
    const [selectedMonth, setSelectedMonth] = useState<string>("all");

    const calculateAge = useMemo(() => (dateOfBirth: string | null | undefined): number | null => {
        if (!dateOfBirth) return null;
        const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) return null;
        return differenceInYears(new Date(), parsedDate);
    }, []);

    const getDayAndMonth = (dateOfBirth: string | null | undefined) => {
        if (!dateOfBirth) return null;
        const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) return null;
        return {
            month: getMonth(parsedDate), // 0-11
            day: getDate(parsedDate)     // 1-31
        };
    };

    const hasBirthdayPassed = (dateOfBirth: string | null | undefined) => {
        if (!dateOfBirth) return false;
        const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());
        if (!isValid(parsedDate)) return false;

        const today = new Date();
        const currentYearBirthday = new Date(today.getFullYear(), getMonth(parsedDate), getDate(parsedDate));

        // If it's today it hasn't completely "passed", we'll only highlight red if strictly before today
        return isBefore(currentYearBirthday, today) && !isSameDay(currentYearBirthday, today);
    };

    const filteredAndSortedStudents = useMemo(() => {
        // 1. Filter out students without a valid birthdate
        const withBirthdays = students.filter(s => getDayAndMonth(s.birthdate) !== null);

        // 2. Filter by selected month if requested
        const thisMonthFiltered = withBirthdays.filter(s => {
            if (selectedMonth === "all") return true;
            const m = getDayAndMonth(s.birthdate)?.month;
            return m === parseInt(selectedMonth, 10);
        });

        // 3. Sort by day and month ascending (January -> December)
        return thisMonthFiltered.sort((a, b) => {
            const aDate = getDayAndMonth(a.birthdate);
            const bDate = getDayAndMonth(b.birthdate);
            if (!aDate || !bDate) return 0;

            if (aDate.month !== bDate.month) return aDate.month - bDate.month;
            return aDate.day - bDate.day;
        });
    }, [students, selectedMonth]);

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    return (
        <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            <div className="glass-card p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Filtrar Cumpleaños
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mes de Cumpleaños</Label>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los meses</SelectItem>
                                {monthNames.map((m, idx) => (
                                    <SelectItem key={idx} value={idx.toString()}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 dark:bg-slate-800/50">
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Nombre</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 hidden md:table-cell">Departamento / Clase</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300">Edad Actual</TableHead>
                            <TableHead className="font-bold text-slate-700 dark:text-slate-300 text-right">Fecha de Cumpleaños</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedStudents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6 text-slate-500 font-medium">
                                    No hay miembros con cumpleaños registrados en este rango.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredAndSortedStudents.map((student) => {
                                const passed = hasBirthdayPassed(student.birthdate);
                                const bDate = getDayAndMonth(student.birthdate);
                                const birthdayDisplay = bDate ? `${bDate.day} de ${monthNames[bDate.month]}` : '';

                                return (
                                    <TableRow
                                        key={student.id}
                                        className={`transition-colors hover:bg-slate-50 ${passed ? 'bg-red-50/70 hover:bg-red-100/60 dark:bg-red-900/10 dark:hover:bg-red-900/20' : ''}`}
                                    >
                                        <TableCell className="font-medium p-4">
                                            <div className="flex items-center gap-3 text-sm">
                                                <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
                                                    <AvatarImage src={student.photo_url || (student.gender?.toLowerCase() === 'femenino' ? '/avatarM.png' : '/avatarH.png')} alt={`${student.first_name}`} className="object-cover" />
                                                    <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-bold">
                                                        {student.first_name.charAt(0)}{student.last_name?.charAt(0) || ""}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="uppercase font-semibold text-slate-900 dark:text-slate-100">{student.first_name} {student.last_name}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-slate-400 hidden md:table-cell">
                                            <div>{student.departments?.name || student.department || 'Sin departamento'}</div>
                                            <div className="text-xs text-slate-400">{student.assigned_class || 'Sin clase'}</div>
                                        </TableCell>
                                        <TableCell className="text-slate-600 dark:text-slate-400">
                                            {calculateAge(student.birthdate) !== null ? `${calculateAge(student.birthdate)} años` : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <div className={`inline-flex items-center gap-1.5 ${passed ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                {birthdayDisplay}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
