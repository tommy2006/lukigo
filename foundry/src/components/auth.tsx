"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { Spinner } from "./ui";

interface AuthCtx { user: User; profile: Profile | null; reloadProfile: () => Promise<void> }
const Ctx = createContext<AuthCtx | null>(null);

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside RequireAuth");
  return c;
}

/** Wrap any signed-in page. Redirects to /login if no session. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  const reloadProfile = useCallback(async () => {
    const { data: { user } } = await supabase().auth.getUser();
    if (!user) return;
    const { data } = await supabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
    setProfile(data);
  }, []);

  useEffect(() => {
    supabase().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      const { data } = await supabase().from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(data);
      setReady(true);
    });
    const { data: sub } = supabase().auth.onAuthStateChange((e) => { if (e === "SIGNED_OUT") router.replace("/login"); });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!ready || !user) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  return <Ctx.Provider value={{ user, profile, reloadProfile }}>{children}</Ctx.Provider>;
}
