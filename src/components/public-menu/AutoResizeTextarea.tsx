import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { revealFieldInScroller } from "@/hooks/useSheetViewport";

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minRowsHeight?: number;
  maxHeight?: number;
};

/**
 * Textarea que cresce conforme o conteúdo e mantém o cursor visível
 * mesmo com o teclado do iOS aberto (usa visualViewport).
 */
export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ minRowsHeight = 76, maxHeight = 220, className = "", onInput, onFocus, style, ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref],
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      const next = Math.min(Math.max(el.scrollHeight, minRowsHeight), maxHeight);
      el.style.height = `${next}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    }, [minRowsHeight, maxHeight]);

    const ensureVisible = useCallback((smooth = true) => {
      // Rola apenas o container do sheet (nunca a página) para evitar "pulos".
      revealFieldInScroller(innerRef.current, smooth);
    }, []);


    useLayoutEffect(() => {
      resize();
    }, [resize, rest.value]);

    // O reposicionamento com teclado aberto é feito pelo useKeyboardFocusScroll
    // (listener global). Aqui só garantimos o caret visível ao crescer.
    return (
      <textarea
        {...rest}
        ref={setRefs}
        rows={1}
        style={{ minHeight: minRowsHeight, maxHeight, ...style }}
        className={`resize-none scroll-mb-24 ${className}`}
        onInput={(e) => {
          const before = innerRef.current?.offsetHeight ?? 0;
          resize();
          const after = innerRef.current?.offsetHeight ?? 0;
          if (after !== before) ensureVisible(false);
          onInput?.(e);
        }}
        onFocus={(e) => {
          resize();
          onFocus?.(e);
        }}
      />
    );

  },
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
