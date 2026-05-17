import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: number;
  username: string;
  role: "user" | "superadmin";
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "travelhub-auth-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as AuthUser;
          setUser(data);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } else {
          // Server says not authenticated — clear cache
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        // Network error / offline — keep optimistic localStorage state
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function login(username: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? "Error de inicio de sesión");
    }
    const data = (await res.json()) as AuthUser;
    setUser(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  async function logout(): Promise<void> {
    // Best-effort server-side session destroy
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    // Wipe client state
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    // Clear sessionStorage just in case
    try { sessionStorage.clear(); } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
