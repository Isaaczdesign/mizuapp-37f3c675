import { useEffect, useState } from "react";
import type { MenuDevice } from "@/lib/menuThemes";

/**
 * Breakpoint que separa o layout mobile (lista + sheets) do layout desktop
 * (sidebar de categorias + grid). Mesmo valor usado no CSS (`lg:`).
 */
export const MENU_DESKTOP_BREAKPOINT = 1024;

/** Dispositivo atual do cardápio público — define qual template é aplicado. */
export function useMenuDevice(): MenuDevice {
  const [device, setDevice] = useState<MenuDevice>(() =>
    typeof window !== "undefined" && window.innerWidth >= MENU_DESKTOP_BREAKPOINT ? "desktop" : "mobile",
  );

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${MENU_DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setDevice(mql.matches ? "desktop" : "mobile");
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return device;
}
