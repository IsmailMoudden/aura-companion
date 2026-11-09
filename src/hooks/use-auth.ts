import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Share initialization between navigation and page hooks to avoid competing token refreshes.
let restorePromise: Promise<Session | null> | null = null;
function restoreSession() {
  if (!restorePromise) {
    restorePromise = (async () => {
      const saved = await window.aura?.loadSession();
      const { data: current } = await supabase.auth.getSession();
      if (saved && !current.session) {
        const { data, error } = await supabase.auth.setSession(saved);
        if (error) { await window.aura?.clearSession(); throw error; }
        return data.session;
      }
      return current.session;
    })().finally(() => { restorePromise = null; });
  }
  return restorePromise;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) { setError(null); setLoading(false); }
    });
    let active = true;
    const timeout = setTimeout(() => {
      if (active) { setError('La connexion prend trop de temps. Vérifie ton réseau puis réessaie.'); setLoading(false); }
    }, 12_000);
    const unsubscribeDeepLink = window.aura?.onAuthDeepLink(async ({ accessToken, refreshToken }) => {
      await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    });
    restoreSession().then((restored) => {
      if (!active) return;
      setSession(restored);
      setUser(restored?.user ?? null);
      setError(null);
      setLoading(false);
    }).catch(() => {
      if (active) { setError('Impossible de restaurer la session. Reconnecte-toi pour continuer.'); setLoading(false); }
    }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); sub.subscription.unsubscribe(); unsubscribeDeepLink?.(); };
  }, []);

  return { session, user, loading, error };
}
