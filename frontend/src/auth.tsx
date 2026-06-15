import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, saveToken, clearToken } from "@/src/api";

type Admin = { email: string; name: string; role: string };
type Ctx = {
  admin: Admin | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const tok = await getToken();
        if (tok) {
          const me = await api.me();
          setAdmin({ email: me.email, name: me.name || "Admin", role: me.role });
        }
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await saveToken(res.access_token);
    setAdmin(res.admin);
  };

  const signOut = async () => {
    await clearToken();
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
