import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassPanel } from "@/components/aura/glass-panel";
import { Orb } from "@/components/aura/orb";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Aura, Sign in" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  // If ?overlay=true, we came from the Electron app — redirect back via deep link after login
  const isOverlayFlow = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('overlay') === 'true';

  useEffect(() => {
    // Handle OAuth callback — Supabase puts tokens in the URL hash after redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        if (isOverlayFlow) {
          redirectToOverlay(session.access_token, session.refresh_token);
        } else {
          navigate({ to: "/app" });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, isOverlayFlow]);

  function redirectToOverlay(accessToken: string, refreshToken: string) {
    window.location.href = `aura://auth?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) {
          if (isOverlayFlow) {
            redirectToOverlay(data.session.access_token, data.session.refresh_token);
            return;
          }
          navigate({ to: "/app" });
          return;
        }
        // fallback if email confirmation is still enabled on Supabase
        toast.success("Check your email to confirm your account.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (isOverlayFlow && data.session) {
          redirectToOverlay(data.session.access_token, data.session.refresh_token);
          return;
        }
        navigate({ to: "/app" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    const redirectTo = window.location.origin + (isOverlayFlow ? "/auth?overlay=true" : "/auth");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      toast.error("Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 pt-32 pb-16">
      <div className="absolute inset-x-0 top-24 -z-10 flex justify-center">
        <Orb size={320} className="opacity-70" />
      </div>
      <GlassPanel strong className="w-full max-w-md p-8">
        <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {mode === "signup" ? "Create your space" : "Welcome back"}
        </p>
        <h1 className="text-display mb-8 text-4xl">
          {mode === "signup" ? "Begin softly." : "Step back in."}
        </h1>

        <button
          onClick={handleGoogle}
          disabled={busy}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-full bg-white/90 py-3 text-sm font-medium text-neutral-900 transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-light placeholder:text-muted-foreground focus:bg-white/[0.09] focus:outline-none"
            />
          )}
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-light placeholder:text-muted-foreground focus:bg-white/[0.09] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-light placeholder:text-muted-foreground focus:bg-white/[0.09] focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full py-3 text-sm font-medium text-[color:var(--primary-foreground)] disabled:opacity-50"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
          >
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-light text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-foreground underline-offset-4 hover:underline"
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← Back home</Link>
        </p>
      </GlassPanel>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.4-4.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.7 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 45.5c5 0 9.5-1.7 13-4.6l-6-5c-2 1.4-4.5 2.2-7 2.2-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 41.2 16.2 45.5 24 45.5z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6 5c-.4.4 6.6-4.8 6.6-13.4 0-1.5-.2-3-.4-4.5z" />
    </svg>
  );
}
