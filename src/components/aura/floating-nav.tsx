import { Link } from "@tanstack/react-router";
import { PillButton } from "./pill-button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

export function FloatingNav() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  const displayName = user?.user_metadata?.full_name as string | undefined;
  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "A";

  return (
    <header className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <nav className="glass flex items-center gap-1 rounded-full px-2 py-2 pl-4 sm:gap-2 sm:pl-5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 pr-3">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full"
            style={{ background: "var(--gradient-orb)", boxShadow: "0 0 16px var(--glow)" }}
          />
          <span className="text-display text-lg tracking-tight">Aura</span>
        </Link>

        <span className="hidden h-5 w-px bg-white/10 sm:block" />

        {/* Nav links */}
        <ul className="hidden items-center gap-1 sm:flex">
          {[
            { to: "/", label: "Product" },
            { to: "/overlay", label: "Overlay" },
            ...(user ? [{ to: "/app", label: "Chat" }] : []),
            { to: "/settings", label: "Settings" },
          ].map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                className="rounded-full px-4 py-2 text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
                activeOptions={{ exact: l.to === "/" }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Auth area */}
        {loading ? (
          <span className="ml-1 h-9 w-9 rounded-full bg-white/[0.04]" />
        ) : user ? (
          <div className="relative ml-1">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-light transition-all hover:ring-1 hover:ring-white/20"
              style={{ background: "var(--gradient-orb)", boxShadow: "0 0 14px var(--glow-soft)" }}
              title={user.email}
            >
              {initials}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div
                  className="absolute right-0 top-11 z-20 min-w-[180px] overflow-hidden rounded-2xl border border-white/[0.08] py-1"
                  style={{ background: "oklch(0.35 0.08 240 / 0.95)", backdropFilter: "blur(24px)" }}
                >
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    {displayName && <p className="text-[13px] font-light truncate">{displayName}</p>}
                    <p className="text-[11px] font-light text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2.5 text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={signOut}
                    className="w-full px-4 py-2.5 text-left text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <PillButton to="/auth" size="md" className="ml-1">Sign in</PillButton>
        )}
      </nav>
    </header>
  );
}
