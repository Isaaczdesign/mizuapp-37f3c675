import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { restaurant_id: string | null; display_name: string | null; onboarding_complete: boolean } | null;
  roles: string[];
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  roles: [],
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let fetchedFor: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (fetchedFor !== session.user.id) {
          fetchedFor = session.user.id;
          setTimeout(() => fetchProfile(session.user.id), 0);
        }
      } else {
        fetchedFor = null;
        setProfile(null);
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (fetchedFor !== session.user.id) {
          fetchedFor = session.user.id;
          fetchProfile(session.user.id);
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("restaurant_id, display_name, onboarding_complete").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(profileRes.data ?? null);
    setRoles(rolesRes.data?.map((r) => r.role) ?? []);
    setLoading(false);
  }

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, roles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
