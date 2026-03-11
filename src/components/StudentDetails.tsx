
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Student } from "@/types/database";
import { StudentObservations } from "./StudentObservations";
import { User, MapPin, Phone, Calendar, Hash, Building2, BookA, UserSquare2 } from "lucide-react";

interface StudentDetailsProps {
  student: Student;
}

export const StudentDetails = ({ student }: StudentDetailsProps) => {
  const formatDepartment = (dept: string) => {
    return dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatBirthdate = (birthdate: string | null) => {
    if (!birthdate) return "";

    // Parse the date without adding an extra day
    const parsedDate = parseISO(birthdate);

    return format(parsedDate, "dd MMMM yyyy", { locale: es });
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50/50 via-white/80 to-purple-50/50 dark:from-slate-900/80 dark:via-slate-800/80 dark:to-slate-900/80 rounded-2xl m-2 border border-indigo-100/50 dark:border-slate-700/50 shadow-inner overflow-hidden animate-fade-in p-6">
      <div className="flex flex-col md:flex-row gap-6">

        {/* Columna Izquierda: Info Personal */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 border-b border-indigo-100 dark:border-slate-700 pb-3 mb-4">
            <div className="bg-indigo-100 dark:bg-indigo-900/50 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
              <UserSquare2 className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
              Datos Personales
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Nombre Completo</p>
                <p className="font-medium text-foreground">{student.first_name} {student.last_name}</p>
              </div>
            </div>

            {student.document_number && (
              <div className="flex items-start gap-2.5">
                <Hash className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Documento</p>
                  <p className="font-medium text-foreground">{student.document_number}</p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-2.5">
              <User className="h-4 w-4 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Género</p>
                <p className="font-medium text-foreground capitalize">{student.gender}</p>
              </div>
            </div>

            {student.birthdate && (
              <div className="flex items-start gap-2.5">
                <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Nacimiento</p>
                  <p className="font-medium text-foreground">{formatBirthdate(student.birthdate)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Separador vertical en escitorio */}
        <div className="hidden md:block w-px bg-indigo-100 dark:bg-slate-700 my-2"></div>

        {/* Columna Derecha: Contacto y Área */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-3 border-b border-indigo-100 dark:border-slate-700 pb-3 mb-4 mt-6 md:mt-0">
            <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg text-purple-600 dark:text-purple-400">
              <MapPin className="h-5 w-5" />
            </div>
            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400">
              Contacto y Área
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {student.phone ? (
              <div className="flex items-start gap-2.5">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Teléfono</p>
                  <p className="font-medium text-foreground">{student.phone}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 opacity-50">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <p className="text-sm italic text-muted-foreground">Sin teléfono registrado</p>
              </div>
            )}

            {student.address ? (
              <div className="flex items-start gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Dirección</p>
                  <p className="font-medium text-foreground">{student.address}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 opacity-50">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <p className="text-sm italic text-muted-foreground">Sin dirección registrada</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-start gap-2.5">
                <Building2 className="h-4 w-4 text-primary mt-0.5" />
                <div>
                  <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Departamento</p>
                  <p className="font-medium text-primary">{student.department ? formatDepartment(student.department) : "No asignado"}</p>
                </div>
              </div>

              {student.assigned_class && (
                <div className="flex items-start gap-2.5">
                  <BookA className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Clase</p>
                    <p className="font-medium text-primary">{student.assigned_class}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-indigo-100 dark:border-slate-700">
        <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/50">
          <StudentObservations studentId={student.id} />
        </div>
      </div>
    </div>
  );
};
