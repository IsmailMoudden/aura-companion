import { ReactNode, useEffect, useRef, useState, CSSProperties, ElementType, createElement } from "react";
import { cn } from "@/lib/utils";

type Variant = "up" | "soft" | "scale";

export function Reveal({
  children,
  variant = "up",
  delay = 0,
  className,
  as = "div",
  once = true,
  threshold = 0.15,
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  delay?: number;
  className?: string;
  as?: ElementType;
  once?: boolean;
  threshold?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) io.unobserve(e.target);
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  const baseClass =
    variant === "soft" ? "reveal-soft" : variant === "scale" ? "reveal-scale" : "reveal";

  return createElement(
    as,
    {
      ref,
      className: cn(baseClass, visible && "is-visible", className),
      style: { transitionDelay: `${delay}s`, ...style },
    },
    children,
  );
}