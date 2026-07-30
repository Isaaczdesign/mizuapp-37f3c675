import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from "react";

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

    const ensureVisible = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const vv = window.visualViewport;
      const bottomLimit = (vv?.height ?? window.innerHeight) - 16;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > bottomLimit || rect.top < 8) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }, []);

    useLayoutEffect(() => {
      resize();
    }, [resize, rest.value]);

    useEffect(() => {
      const vv = window.visualViewport;
      if (!vv) return;
      const onVV = () => {
        if (document.activeElement === innerRef.current) {
          window.setTimeout(ensureVisible, 60);
        }
      };
      vv.addEventListener("resize", onVV);
      vv.addEventListener("scroll", onVV);
      return () => {
        vv.removeEventListener("resize", onVV);
        vv.removeEventListener("scroll", onVV);
      };
    }, [ensureVisible]);

    return (
      <textarea
        {...rest}
        ref={setRefs}
        rows={1}
        style={{ minHeight: minRowsHeight, maxHeight, ...style }}
        className={`resize-none scroll-mb-32 ${className}`}
        onInput={(e) => {
          resize();
          ensureVisible();
          onInput?.(e);
        }}
        onFocus={(e) => {
          resize();
          window.setTimeout(ensureVisible, 250);
          onFocus?.(e);
        }}
      />
    );
  },
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
