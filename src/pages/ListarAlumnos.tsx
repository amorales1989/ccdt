import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { deleteStudent, getStudents, getDepartments, updateStudent } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DepartmentType, Student } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "El nombre debe tener al menos 2 caracteres.",
  }),
  gender: z.enum(["masculino", "femenino"]),
  birthdate: z.string(),
  address: z.string().optional(),
  department: z.string(),
  assigned_class: z.string(),
});

const ListarAlumnos = () => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [phoneCode, setPhoneCode] = useState("54");
  const [phoneNumber, setPhoneNumber] = useState("");
	const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      gender: "masculino",
      birthdate: "",
      address: "",
      department: "",
      assigned_class: "",
    },
  });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const studentsData = await getStudents();
      setStudents(studentsData);
    } catch (error) {
      console.error("Error al obtener los alumnos:", error);
      toast({
        title: "Error",
        description: "Error al obtener los alumnos",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (student: Student) => {
    setStudentToEdit(student);
    form.reset({
      name: student.name,
      gender: student.gender,
      birthdate: student.birthdate || "",
      address: student.address || "",
      department: student.department,
      assigned_class: student.assigned_class,
    });
    setPhoneCode(student.phone ? student.phone.substring(0, 2) : "54");
    setPhoneNumber(student.phone ? student.phone.substring(2) : "");
    setIsDialogOpen(true);
  };

  const handleDelete = async (studentId: string) => {
    try {
      await deleteStudent(studentId);
      toast({
        title: "Alumno eliminado",
        description: "El alumno ha sido eliminado exitosamente",
      });
      fetchStudents(); // Refresh student list
    } catch (error) {
      console.error("Error al eliminar el alumno:", error);
      toast({
        title: "Error",
        description: "Error al eliminar el alumno",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!studentToEdit) return;

    const formattedPhone = phoneCode + phoneNumber;

    try {
      await updateStudent(studentToEdit.id, {
        name: data.name,
        phone: formattedPhone,
        address: data.address || null,
        gender: data.gender,
        birthdate: data.birthdate || null,
        department: data.department,
        assigned_class: data.assigned_class,
      });
      toast({
        title: "Alumno actualizado",
        description: "El alumno ha sido actualizado exitosamente",
      });
      fetchStudents(); // Refresh student list
      setIsDialogOpen(false); // Close the dialog
    } catch (error) {
      console.error("Error al actualizar el alumno:", error);
      toast({
        title: "Error",
        description: "Error al actualizar el alumno",
        variant: "destructive",
      });
    }
  };

  if (!isAdminOrSecretaria && (!profile?.departments?.length)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tiene departamentos asignados. Contacte al administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-6">
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alumnos</CardTitle>
          <CardDescription>
            Aquí puedes ver y gestionar todos los alumnos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Género</TableHead>
                <TableHead>Fecha de Nacimiento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Clase</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>{student.gender}</TableCell>
                  <TableCell>{student.birthdate}</TableCell>
                  <TableCell>{student.phone}</TableCell>
                  <TableCell>{student.department.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{student.assigned_class}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(student)}
                    >
                      Editar
                    </Button>{" "}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(student.id)}
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de edición de alumno */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Alumno</DialogTitle>
            <DialogDescription>
              Actualiza la información del alumno {studentToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input 
                  id="name"
                  {...form.register("name")}
                  placeholder="Nombre completo"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select 
                    defaultValue={form.getValues("gender")}
                    onValueChange={(value) => form.setValue("gender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Fecha de nacimiento</Label>
                  <Input 
                    id="birthdate"
                    type="date"
                    {...form.register("birthdate")}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">+</span>
                    <Input
                      id="phoneCode"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      placeholder="54"
                    />
                  </div>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Sin 0 ni 15 al inicio, ej: 1159080306"
                  />
                </div>
                <span className="text-xs text-muted-foreground">No incluir el 0 ni el 15 al inicio del número. Ejemplo correcto: 1159080306</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input 
                  id="address"
                  {...form.register("address")}
                  placeholder="Dirección"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Select 
                    defaultValue={form.getValues("department")}
                    onValueChange={(value) => form.setValue("department", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assigned_class">Clase</Label>
                  <Input 
                    id="assigned_class"
                    {...form.register("assigned_class")}
                    placeholder="Clase"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ListarAlumnos;
