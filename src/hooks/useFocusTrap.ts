import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Prende o foco dentro de um overlay (sheet/dialog) enquanto ele estiver ativo.
 * - Tab/Shift+Tab circulam apenas pelos elementos do painel.
 * - Se o foco escapar (ex.: teclado do iOS fechando), ele volta para o painel.
 * - Ao fechar, devolve o foco para o elemento que abriu o overlay.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const containerRef = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getItems = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );

    // Foco inicial sem provocar scroll/salto de layout.
    const focusFirst = () => {
      if (container.contains(document.activeElement)) return;
      const items = getItems();
      (items[0] ?? container).focus({ preventScroll: true });
    };
    if (!container.hasAttribute("tabindex")) container.setAttribute("tabindex", "-1");
    const initial = window.setTimeout(focusFirst, 60);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        e.stopPropagation();
        onEscape();
        return;
      }
      if (e.key !== "Tab") return;
      const items = getItems();
      if (items.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (current === first || !container.contains(current))) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && (current === last || !container.contains(current))) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    // Foco escapou para fora (teclado fechando, clique no fundo): traz de volta.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node | null;
      if (target && !container.contains(target)) {
        focusFirst();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      clearTimeout(initial);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active, onEscape]);

  return containerRef;
}
