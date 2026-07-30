import logoFull from "@/assets/mizu-logo-wordmark.png";
import logoMark from "@/assets/mizu-logo-mark.png";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark";
  className?: string;
};

/** Marca oficial Mizu — Gestão de Restaurantes */
export function Logo({ variant = "full", className }: LogoProps) {
  const src = variant === "full" ? logoFull : logoMark;
  return (
    <img
      src={src}
      alt="Mizu — Gestão de Restaurantes"
      className={cn("w-auto object-contain select-none", className)}
      draggable={false}
    />
  );
}

export default Logo;
