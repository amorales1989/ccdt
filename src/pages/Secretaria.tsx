import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Secretaria() {
  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Panel de Secretaría</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Bienvenido al panel de secretaría. Aquí podrás gestionar tareas administrativas.</p>
        </CardContent>
      </Card>
    </div>
  );
}