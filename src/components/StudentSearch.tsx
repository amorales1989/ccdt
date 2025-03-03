
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { Student } from "@/types/database";
import { StudentDetails } from "./StudentDetails";

interface StudentSearchProps {
  students: Student[];
}

export const StudentSearch = ({ students }: StudentSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (e.target.value.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
    setSelectedStudent(null);
  };

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setShowResults(false);
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.name.toLowerCase().includes(searchLower) ||
      (student.phone && student.phone.includes(searchTerm))
    );
  });

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Información de Alumno</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative mb-6">
          <Input
            placeholder="Buscar alumno por nombre o teléfono..."
            value={searchTerm}
            onChange={handleSearch}
            className="pr-10"
          />
          <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />

          {showResults && filteredStudents.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200 max-h-60 overflow-auto">
              <ul className="py-1">
                {filteredStudents.map((student) => (
                  <li
                    key={student.id}
                    className="px-4 py-2 hover:bg-primary/10 cursor-pointer"
                    onClick={() => handleSelectStudent(student)}
                  >
                    <div className="font-medium">{student.name}</div>
                    {student.phone && (
                      <div className="text-sm text-muted-foreground">
                        Tel: {student.phone}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showResults && filteredStudents.length === 0 && searchTerm && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200">
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No se encontraron alumnos
              </div>
            </div>
          )}
        </div>

        {selectedStudent && <StudentDetails student={selectedStudent} />}
      </CardContent>
    </Card>
  );
};
