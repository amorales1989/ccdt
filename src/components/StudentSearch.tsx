
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus } from "lucide-react";
import { Student } from "@/types/database";
import { StudentDetails } from "./StudentDetails";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

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
    const fullName = `${student.first_name} ${student.last_name || ''}`.toLowerCase();

    return (
      fullName.includes(searchLower) ||
      (student.phone && student.phone.includes(searchTerm)) ||
      (student.document_number && student.document_number.includes(searchTerm))
    );
  });

  return (
    <Card className="mb-8 overflow-visible border-none bg-transparent shadow-none">
      <CardHeader className="pb-4">
        <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary animate-fade-in">
          Información de Alumno
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative flex items-center bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-accent/30 shadow-sm focus-within:ring-2 focus-within:ring-primary/50 transition-all duration-300">
            <Search className="ml-4 h-6 w-6 text-primary/60" />
            <Input
              placeholder="Buscar por nombre, apellidos, DNI o número de teléfono..."
              value={searchTerm}
              onChange={handleSearch}
              className="border-0 focus-visible:ring-0 py-7 px-4 text-lg bg-transparent placeholder:text-muted-foreground/50"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setShowResults(false); }}
                className="mr-4 p-1 rounded-full hover:bg-accent/20 text-muted-foreground transition-colors"
              >
                <Search className="h-4 w-4 rotate-45" />
              </button>
            )}
          </div>

          {showResults && filteredStudents.length > 0 && (
            <div className="absolute z-50 mt-2 w-full glass-card overflow-hidden animate-fade-in max-h-[400px]">
              <ScrollArea className="h-full max-h-[400px]">
                <ul className="py-2 divide-y divide-accent/10">
                  {filteredStudents.map((student, index) => {
                    const displayName = student.last_name
                      ? `${student.first_name} ${student.last_name}`
                      : student.first_name;

                    return (
                      <li
                        key={student.id}
                        className="px-6 py-4 hover:bg-primary/5 cursor-pointer transition-colors duration-200 flex justify-between items-center group/item animate-slide-in"
                        style={{ animationDelay: `${index * 0.03}s` }}
                        onClick={() => handleSelectStudent(student)}
                      >
                        <div>
                          <div className="font-semibold text-lg text-foreground group-hover/item:text-primary transition-colors">{displayName}</div>
                          <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                            {student.document_number && (
                              <span className="flex items-center gap-1 bg-accent/20 px-2 py-0.5 rounded text-xs font-medium uppercase">
                                DNI: {student.document_number}
                              </span>
                            )}
                            {student.phone && (
                              <span className="flex items-center gap-1 italic">
                                📱 {student.phone}
                              </span>
                            )}
                            {student.departments?.name && (
                              <span className="flex items-center gap-1 opacity-70">
                                🏢 {student.departments.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </div>
          )}

          {showResults && filteredStudents.length === 0 && searchTerm && (
            <div className="absolute z-50 mt-2 w-full glass-card p-8 text-center animate-fade-in border-dashed">
              <div className="flex flex-col items-center gap-2">
                <Search className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="font-medium text-lg">No se encontraron resultados</p>
                <p className="text-sm text-muted-foreground">Intenta con otros términos de búsqueda</p>
              </div>
            </div>
          )}
        </div>

        {selectedStudent && (
          <div className="mt-8 animate-fade-in delay-100">
            <StudentDetails student={selectedStudent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
