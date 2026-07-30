import logoFull from "@/assets/mizu-logo-full.png.asset.json";
import logoMark from "@/assets/mizu-logo-mark.png.asset.json";
import { cn } from "@/lib/utils";

type LogoProps = {
  variant?: "full" | "mark";
  className?: string;
};

/** Marca oficial Mizu — Gestão de Restaurantes */
export function Logo({ variant = "full", className }: LogoProps) {
  const src = variant === "full" ? logoFull.url : logoMark.url;
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
