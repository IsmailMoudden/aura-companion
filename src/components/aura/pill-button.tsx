import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Link } from "@tanstack/react-router";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
  to?: string;
  href?: string;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, variant = "primary", size = "md", to, href, children, ...props }, ref) => {
    const base = cn(
      "group relative inline-flex items-center justify-center gap-2 rounded-full font-light transition-all duration-500",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
      size === "lg" ? "px-9 py-4 text-base" : "px-6 py-3 text-sm",
      variant === "primary"
        ? "text-[color:var(--primary-foreground)] hover:scale-[1.02]"
        : "glass text-foreground hover:bg-white/[0.08]",
      className,
    );
    const content = (
      <>
        {variant === "primary" && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-glow)" }}
          />
        )}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </>
    );
    if (href) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={base}>
          {content}
        </a>
      );
    }
    if (to) {
      return (
        <Link to={to} className={base}>
          {content}
        </Link>
      );
    }
    return (
      <button ref={ref} className={base} {...props}>
        {content}
      </button>
    );
  },
);
PillButton.displayName = "PillButton";
