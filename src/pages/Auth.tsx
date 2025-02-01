import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<string>("maestro");
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, {
          first_name: firstName,
          last_name: lastName,
          role: role as "admin" | "lider" | "director" | "maestro" | "secretaria",
        });
        toast({
          title: "Registro exitoso",
          description: "Por favor revisa tu correo electrónico para confirmar tu cuenta.",
        });
      }
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? "Iniciar Sesión" : "Registro"}</CardTitle>
          <CardDescription>
            {isLogin
              ? "Ingresa tus credenciales para acceder"
              : "Crea una nueva cuenta"}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maestro">Maestro</SelectItem>
                      <SelectItem value="lider">Líder</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="secretaria">Secretaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full">
              {isLogin ? "Iniciar Sesión" : "Registrarse"}
            </Button>
            <Button
              type="button"
              variant="link"
              onClick={() => setIsLogin(!isLogin)}
              className="w-full"
            >
              {isLogin
                ? "¿No tienes una cuenta? Regístrate"
                : "¿Ya tienes una cuenta? Inicia sesión"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}