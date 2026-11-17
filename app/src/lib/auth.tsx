import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { currentProfile, onAuthChange, type Profile } from "./backend";

type Ctx = { profile: Profile | null; loading: boolean; refresh: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ profile: null, loading: true, refresh: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => currentProfile().then(setProfile, () => setProfile(null)).finally(() => setLoading(false)), []);
  useEffect(() => { refresh(); return onAuthChange(refresh); }, [refresh]);
  return <AuthCtx.Provider value={{ profile, loading, refresh }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
