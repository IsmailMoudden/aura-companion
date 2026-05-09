import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { Reveal } from "@/components/aura/reveal";

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
          <Reveal as="p" variant="soft" className="mb-6 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {eyebrow}
          </Reveal>
        )}
        {title && (
          <Reveal as="h2" delay={0.08} className="text-display text-5xl sm:text-6xl md:text-7xl">
            {title}
          </Reveal>
        )}
        {description && (
          <Reveal
            as="p"
            variant="soft"
            delay={0.18}
            className={cn(
              "mt-6 text-lg font-light text-muted-foreground",
              align === "center" && "mx-auto max-w-2xl",
            )}
          >
            {description}
          </Reveal>
        )}
        {children && <div className="mt-16">{children}</div>}
      </div>
    </section>
  );
}
