import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getStudents } from "@/lib/api";
import { differenceInYears } from "date-fns";
import { MessageSquare } from "lucide-react";

const ListarAlumnos = () => {
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: getStudents,
  });

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return '-';
    return differenceInYears(new Date(), new Date(birthdate));
  };

  const handleWhatsAppClick = (phone: string | null) => {
    if (!phone) return;
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, '')}`;
    window.open(whatsappUrl, '_blank');
  };

  const maleStudents = students.filter(student => student.gender === 'masculino');
  const femaleStudents = students.filter(student => student.gender === 'femenino');

  const StudentTable = ({ students, title }: { students: typeof maleStudents, title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead>Contacto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>{student.name}</TableCell>
                <TableCell>{calculateAge(student.birthdate)}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleWhatsAppClick(student.phone)}
                    disabled={!student.phone}
                  >
                    <MessageSquare className="mr-2" />
                    Mensaje
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <StudentTable title="Varones" students={maleStudents} />
      <StudentTable title="Mujeres" students={femaleStudents} />
    </div>
  );
};

export default ListarAlumnos;