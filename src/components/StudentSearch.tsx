
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
    <div className="relative w-full z-50">
      <div className="relative flex items-center bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/50 focus-within:bg-white dark:focus-within:bg-slate-900 shadow-sm">
        <Search className="ml-4 h-5 w-5 text-slate-400" />
        <Input
          placeholder="Buscar miembro de la congregación"
          value={searchTerm}
          onChange={handleSearch}
          className="border-0 focus-visible:ring-0 py-6 px-3 text-sm font-medium bg-transparent placeholder:text-slate-400 w-full"
        />
        {searchTerm && (
          <button
            onClick={() => { setSearchTerm(""); setShowResults(false); }}
            className="mr-3 p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
          >
            <Plus className="h-4 w-4 rotate-45" />
          </button>
        )}
      </div>

      {showResults && filteredStudents.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <ScrollArea className="max-h-[350px]">
            <ul className="py-2">
              {filteredStudents.map((student, index) => {
                const displayName = student.last_name
                  ? `${student.first_name} ${student.last_name}`
                  : student.first_name;

                return (
                  <li
                    key={student.id}
                    className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors flex justify-between items-center group"
                    onClick={() => handleSelectStudent(student)}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">{displayName}</div>
                      <div className="flex gap-3 text-[11px] font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                        {student.department && <span>{student.department}</span>}
                        {student.assigned_class && <span>• {student.assigned_class}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
      )}

      {showResults && filteredStudents.length === 0 && searchTerm && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 p-6 text-center animate-in fade-in">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-sm text-slate-700 dark:text-slate-300">No se encontraron resultados</p>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in p-4" onClick={(e) => { if (e.target === e.currentTarget) setSelectedStudent(null) }}>
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-10 bg-white/50 backdrop-blur hover:bg-white" onClick={() => setSelectedStudent(null)}>
              <Plus className="h-4 w-4 rotate-45" />
            </Button>
            <StudentDetails student={selectedStudent} />
          </div>
        </div>
      )}
    </div>
  );
};
