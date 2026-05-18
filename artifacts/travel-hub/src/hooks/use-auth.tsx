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
const CREDS_KEY   = "travelhub-auth-creds";

async function hashCredentials(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${username}:${password}`);
  const buf  = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    // ── Offline path ──────────────────────────────────────────────────────────
    if (!navigator.onLine) {
      const raw = localStorage.getItem(CREDS_KEY);
      if (raw) {
        try {
          const stored = JSON.parse(raw) as { hash: string; user: AuthUser };
          const inputHash = await hashCredentials(username, password);
          if (inputHash === stored.hash && stored.user.username === username) {
            setUser(stored.user);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored.user));
            return stored.user;
          }
        } catch {
          // Corrupt stored creds — fall through to error
        }
      }
      throw new Error("Contraseña incorrecta para el modo offline");
    }

    // ── Online path ───────────────────────────────────────────────────────────
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

    // Persist hashed credentials so offline login works later
    const hash = await hashCredentials(username, password);
    localStorage.setItem(CREDS_KEY, JSON.stringify({ hash, user: data }));

    return data;
  }

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    // Keep CREDS_KEY so offline re-login is possible after a manual logout
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
