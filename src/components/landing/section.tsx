import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export function Section({
  eyebrow,
  title,
  description,
  children,
  className,
  align = "center",
}: {
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <section className={cn("relative px-6 py-32 sm:py-40", className)}>
      <div className={cn("mx-auto max-w-6xl", align === "center" && "text-center")}>
        {eyebrow && (
          <p className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground animate-fade-up">
            {eyebrow}
          </p>
        )}
        {title && (
          <h2 className="text-display text-5xl sm:text-6xl md:text-7xl animate-fade-up" style={{ animationDelay: "0.1s" }}>
            {title}
          </h2>
        )}
        {description && (
          <p className={cn(
            "mt-6 text-lg font-light text-muted-foreground animate-fade-up",
            align === "center" && "mx-auto max-w-2xl",
          )} style={{ animationDelay: "0.2s" }}>
            {description}
          </p>
        )}
        {children && <div className="mt-16">{children}</div>}
      </div>
    </section>
  );
}
