import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getAttendance, getEvents } from "@/lib/api";

const HistorialAsistencia = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Fetch events for the selected date
  const { data: events } = useQuery({
    queryKey: ['events', date],
    queryFn: async () => {
      if (!date) return [];
      const events = await getEvents();
      return events.filter(event => 
        event.date === format(date, 'yyyy-MM-dd')
      );
    },
  });

  // Fetch attendance for the first event of the selected date
  const { data: attendance } = useQuery({
    queryKey: ['attendance', events?.[0]?.id],
    queryFn: async () => {
      if (!events?.[0]?.id) return [];
      return getAttendance(events[0].id);
    },
    enabled: !!events?.[0]?.id,
  });

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
            {!events?.length ? (
              <p className="text-muted-foreground">No hay eventos registrados para esta fecha.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance?.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.students?.name}</TableCell>
                      <TableCell>{record.status ? 'Presente' : 'Ausente'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistorialAsistencia;