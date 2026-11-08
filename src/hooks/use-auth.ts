import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    const restore = async () => {
      const saved = await window.aura?.loadSession();
      if (saved) await supabase.auth.setSession(saved);
      return supabase.auth.getSession();
    };
    const unsubscribeDeepLink = window.aura?.onAuthDeepLink(async ({ accessToken, refreshToken }) => {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    });
    restore().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => { sub.subscription.unsubscribe(); unsubscribeDeepLink?.(); };
  }, []);

  return { session, user, loading };
}
