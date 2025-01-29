import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

const estudiantes = [
  { id: 1, nombre: "Juan Pérez", edad: 15, telefono: "123-456-7890" },
  { id: 2, nombre: "María García", edad: 14, telefono: "098-765-4321" },
];

const Index = () => {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alumnos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estudiantes.map((estudiante) => (
                <TableRow key={estudiante.id}>
                  <TableCell>{estudiante.nombre}</TableCell>
                  <TableCell>{estudiante.edad}</TableCell>
                  <TableCell>{estudiante.telefono}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link to={`/alumno/${estudiante.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;