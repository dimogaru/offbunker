import { useState } from "react";
import { useLocation } from "wouter";
import {
  Shield, PlusCircle, Pencil, Trash2, LogOut, ShieldCheck, KeyRound,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserRow {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: "include", ...opts });
  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-users"],
    queryFn: () => apiFetch("/api/users") as Promise<UserRow[]>,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [passwordUser, setPasswordUser] = useState<UserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [formRole, setFormRole] = useState("user");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createMut = useMutation({
    mutationFn: (data: { username: string; password: string; role: string }) =>
      apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      resetForm();
      toast({ title: "Usuario creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: number; username?: string; password?: string }) =>
      apiFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      invalidate();
      setEditUser(null);
      resetForm();
      toast({ title: "Usuario actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const passwordMut = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      apiFetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      invalidate();
      setPasswordUser(null);
      setPasswordValue("");
      toast({ title: "Contraseña actualizada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      setDeleteUser(null);
      toast({ title: "Usuario eliminado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetForm() {
    setFormUsername("");
    setFormPassword("");
    setFormRole("user");
  }

  function openCreate() { resetForm(); setCreateOpen(true); }

  function openEdit(u: UserRow) {
    setFormUsername(u.username);
    setFormPassword("");
    setFormRole(u.role);
    setEditUser(u);
  }

  async function handleLogout() {
    await logout();
    qc.clear();
    window.location.replace("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">OffBunker</span>
            <span className="hidden sm:flex ml-1 items-center gap-1 text-xs font-medium text-muted-foreground">
              | Panel de Administración
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Crea y administra las cuentas de usuario
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <PlusCircle className="w-4 h-4" />
            Nuevo usuario
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando usuarios…</p>
        ) : (
           <div className="rounded-xl border border-border overflow-x-auto">
             <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-3 font-medium">Usuario</th>
                  <th className="text-left px-4 py-3 font-medium">Rol</th>
                   <th className="text-left px-4 py-3 font-medium">Contraseña</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Creado</th>
                   <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-border hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.role === "superadmin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.role === "superadmin" ? "Admin" : "Usuario"}
                      </span>
                    </td>
                     <td className="px-4 py-3">
                       <div className="flex items-center gap-2">
                         <span className="text-muted-foreground tracking-widest" aria-label="Contraseña protegida">
                           ••••••••
                         </span>
                         <button
                           onClick={() => {
                             setPasswordValue("");
                             setPasswordUser(u);
                           }}
                           className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                           title={`Cambiar contraseña de ${u.username}`}
                         >
                           <KeyRound className="w-3.5 h-3.5" />
                           Cambiar
                         </button>
                       </div>
                     </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {new Date(u.createdAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteUser(u)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Eliminar"
                          disabled={u.id === user?.id}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No hay usuarios registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Create dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { setCreateOpen(false); resetForm(); } else setCreateOpen(true); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Usuario</Label>
              <Input
                className="mt-1.5"
                placeholder="nombre de usuario"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input
                className="mt-1.5"
                type="password"
                placeholder="••••••••"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
            <div>
              <Label>Rol</Label>
              <select
                className="mt-1.5 w-full border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
              >
                <option value="user">Usuario</option>
                <option value="superadmin">Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() =>
                createMut.mutate({
                  username: formUsername,
                  password: formPassword,
                  role: formRole,
                })
              }
              disabled={!formUsername.trim() || !formPassword || createMut.isPending}
            >
              {createMut.isPending ? "Creando…" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editUser}
        onOpenChange={(o) => { if (!o) { setEditUser(null); resetForm(); } }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Usuario</Label>
              <Input
                className="mt-1.5"
                placeholder={editUser?.username}
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
              />
            </div>
            <div>
              <Label>
                Nueva contraseña{" "}
                <span className="text-muted-foreground font-normal">
                  (dejar vacío para no cambiar)
                </span>
              </Label>
              <Input
                className="mt-1.5"
                type="password"
                placeholder="••••••••"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!editUser) return;
                const data: { id: number; username?: string; password?: string } = { id: editUser.id };
                if (formUsername.trim()) data.username = formUsername.trim();
                if (formPassword) data.password = formPassword;
                updateMut.mutate(data);
              }}
              disabled={
                (!formUsername.trim() && !formPassword) || updateMut.isPending
              }
            >
              {updateMut.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password dialog */}
      <Dialog
        open={!!passwordUser}
        onOpenChange={(o) => {
          if (!o) {
            setPasswordUser(null);
            setPasswordValue("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Nueva contraseña para{" "}
              <span className="font-medium text-foreground">{passwordUser?.username}</span>.
              La contraseña actual no se puede mostrar porque está protegida.
            </p>
            <div>
              <Label htmlFor="new-user-password">Nueva contraseña</Label>
              <Input
                id="new-user-password"
                className="mt-1.5"
                type="password"
                placeholder="••••••••"
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordUser(null);
                setPasswordValue("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!passwordUser || !passwordValue) return;
                passwordMut.mutate({ id: passwordUser.id, password: passwordValue });
              }}
              disabled={!passwordValue || passwordMut.isPending}
            >
              {passwordMut.isPending ? "Guardando…" : "Cambiar contraseña"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(o) => { if (!o) setDeleteUser(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar usuario "{deleteUser?.username}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente la cuenta y todos sus viajes y
              documentos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() =>
                deleteUser && deleteMut.mutate(deleteUser.id)
              }
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
