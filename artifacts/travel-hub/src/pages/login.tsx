import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, LogIn, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const { login } = useAuth();
  const isOnline = useOnlineStatus();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      if (user.role === "superadmin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (err) {
      toast({
        title: isOnline ? "Error de inicio de sesión" : "Error de acceso offline",
        description:
          err instanceof Error ? err.message : "Credenciales incorrectas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center gap-2.5">
            <Shield className="w-8 h-8 text-primary" />
            <span className="text-3xl font-bold tracking-tight text-primary">OffBunker</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            La información de tu viaje, blindada y offline.
          </p>
        </div>

        {/* Offline notice */}
        {!isOnline && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <WifiOff className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Sin conexión</p>
              <p className="text-xs mt-0.5 opacity-80">
                Puedes acceder con el último usuario y contraseña que usaste en esta sesión.
              </p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold mb-1">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground mb-5">
            {isOnline
              ? "Introduce tus credenciales para continuar"
              : "Verificación local — solo el último usuario registrado puede acceder"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Usuario</Label>
              <Input
                id="username"
                type="text"
                className="mt-1.5"
                placeholder="nombre de usuario"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                className="mt-1.5"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading}
            >
              {loading ? (
                "Iniciando sesión…"
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  {isOnline ? "Iniciar sesión" : "Acceder sin conexión"}
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
