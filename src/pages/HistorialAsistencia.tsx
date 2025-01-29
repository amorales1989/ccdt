import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

const HistorialAsistencia = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const asistencias = [
    { id: 1, nombre: "Juan Pérez", estado: "Presente" },
    { id: 2, nombre: "María García", estado: "Ausente" },
  ];

  return (
    <div className="p-6">
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Asistencia del {date?.toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asistencias.map((asistencia) => (
                  <TableRow key={asistencia.id}>
                    <TableCell>{asistencia.nombre}</TableCell>
                    <TableCell>{asistencia.estado}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistorialAsistencia;