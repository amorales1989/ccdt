
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Student } from "@/types/database";

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
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-semibold mb-4">
              {student.first_name} {student.last_name}
            </h3>
            
            <div className="space-y-3">
              <div>
                <span className="font-medium">Nombre:</span> {student.first_name}
              </div>
              
              {student.last_name && (
                <div>
                  <span className="font-medium">Apellido:</span> {student.last_name}
                </div>
              )}
              
              {student.document_number && (
                <div>
                  <span className="font-medium">DNI:</span> {student.document_number}
                </div>
              )}
              
              <div>
                <span className="font-medium">Departamento:</span>{" "}
                {student.department ? formatDepartment(student.department) : "No asignado"}
              </div>
              
              {student.assigned_class && (
                <div>
                  <span className="font-medium">Clase:</span> {student.assigned_class}
                </div>
              )}
              
              <div>
                <span className="font-medium">Género:</span>{" "}
                {student.gender === "masculino" ? "Masculino" : "Femenino"}
              </div>
              
              {student.birthdate && (
                <div>
                  <span className="font-medium">Fecha de nacimiento:</span>{" "}
                  {formatBirthdate(student.birthdate)}
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {student.phone && (
              <div>
                <span className="font-medium">Teléfono:</span> {student.phone}
              </div>
            )}
            
            {student.address && (
              <div>
                <span className="font-medium">Dirección:</span> {student.address}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
