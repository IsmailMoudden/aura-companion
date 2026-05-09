import { Link } from "@tanstack/react-router";
import { PillButton } from "./pill-button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const links = [
  { to: "/", label: "Product" },
  { to: "/overlay", label: "Overlay" },
  { to: "/app", label: "Chat" },
  { to: "/settings", label: "Settings" },
];

export function FloatingNav() {
  const { user, loading } = useAuth();
  return (
    <header className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
      <nav className="glass flex items-center gap-1 rounded-full px-2 py-2 pl-4 sm:gap-2 sm:pl-5">
        <Link to="/" className="flex items-center gap-2 pr-3">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full"
            style={{ background: "var(--gradient-orb)", boxShadow: "0 0 16px var(--glow)" }}
          />
          <span className="text-display text-lg tracking-tight">Aura</span>
        </Link>
        <span className="hidden h-5 w-px bg-white/10 sm:block" />
        <ul className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
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
        {loading ? (
          <span className="ml-1 h-9 w-20 rounded-full bg-white/[0.04]" />
        ) : user ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="ml-1 rounded-full px-4 py-2 text-sm font-light text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        ) : (
          <PillButton to="/auth" size="md" className="ml-1">Sign in</PillButton>
        )}
      </nav>
    </header>
  );
}
