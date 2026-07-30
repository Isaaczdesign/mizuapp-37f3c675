import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Altura/offset reais da área visível do navegador.
 * No iOS o `innerHeight`/`100dvh` pode divergir do que está realmente visível
 * (barra de endereço retrátil, teclado, notch). O visualViewport é a fonte de verdade.
 */
export function useVisualViewport() {
  const [vp, setVp] = useState(() => ({
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    offsetTop: 0,
    keyboardInset: 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => {
      const height = Math.round(vv ? vv.height : window.innerHeight);
      // Com o body travado (overlay aberto) o iOS ainda desloca o viewport
      // ao focar um campo — isso causava o "salto" do sheet. Desfazemos o
      // deslocamento e ignoramos o offset transitório.
      const locked = isBodyLocked();
      if (locked && window.scrollY !== 0) window.scrollTo(0, 0);
      const offsetTop = locked ? 0 : Math.round(vv ? vv.offsetTop : 0);
      // Espaço ocupado pelo teclado (ou barras) abaixo da área visível.
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
      setVp((prev) =>
        prev.height === height && prev.offsetTop === offsetTop && prev.keyboardInset === keyboardInset
          ? prev
          : { height, offsetTop, keyboardInset },
      );
    };
    update();


    // Ao girar o iPhone (principalmente com teclado aberto) as medidas
    // chegam desatualizadas: remedimos algumas vezes após a rotação.
    const timers: number[] = [];
    const updateDeferred = () => {
      update();
      [50, 150, 350, 600].forEach((ms) => timers.push(window.setTimeout(update, ms)));
    };

    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", updateDeferred);
    window.screen?.orientation?.addEventListener?.("change", updateDeferred);
    return () => {
      timers.forEach(clearTimeout);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", updateDeferred);
      window.screen?.orientation?.removeEventListener?.("change", updateDeferred);
    };
  }, []);

  return vp;
}


let lockCount = 0;
/** Há algum overlay travando o scroll do body? */
function isBodyLocked() {
  return lockCount > 0;
}

let savedScrollY = 0;
let savedStyles: Partial<CSSStyleDeclaration> | null = null;

let touchStartY = 0;

/** Container rolável (com espaço para rolar) mais próximo do alvo do toque. */
function scrollableAncestor(target: EventTarget | null, dy: number): HTMLElement | null {
  let el = target as HTMLElement | null;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      // Só permite o gesto se ainda houver para onde rolar nesse sentido
      // (evita o "scroll chaining" para o body no iOS).
      if (!(atTop && dy > 0) && !(atBottom && dy < 0)) return el;
    }
    el = el.parentElement;
  }
  return null;
}

const onTouchStart = (e: TouchEvent) => {
  touchStartY = e.touches[0]?.clientY ?? 0;
};

const onTouchMove = (e: TouchEvent) => {
  if (e.touches.length > 1) return; // pinch/zoom
  const dy = (e.touches[0]?.clientY ?? 0) - touchStartY;
  if (scrollableAncestor(e.target, dy)) return;
  if (e.cancelable) e.preventDefault();
};

function lockBody() {
  if (lockCount === 0) {
    const body = document.body;
    savedScrollY = window.scrollY;
    savedStyles = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      overscrollBehavior: body.style.overscrollBehavior,
    } as Partial<CSSStyleDeclaration>;
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
  }
  lockCount += 1;
}

function unlockBody() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && savedStyles) {
    const body = document.body;
    body.style.position = savedStyles.position ?? "";
    body.style.top = savedStyles.top ?? "";
    body.style.left = savedStyles.left ?? "";
    body.style.right = savedStyles.right ?? "";
    body.style.width = savedStyles.width ?? "";
    body.style.overflow = savedStyles.overflow ?? "";
    body.style.overscrollBehavior = savedStyles.overscrollBehavior ?? "";
    savedStyles = null;
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchmove", onTouchMove);
    window.scrollTo(0, savedScrollY);
  }
}

/** Bloqueia o scroll do body enquanto um overlay estiver aberto (evita ver o cardápio rolando por baixo). */
export function useBodyScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) return;
    lockBody();
    return () => unlockBody();
  }, [locked]);
}

/**
 * Retorna o estilo para overlays `fixed` ocuparem exatamente a área visível,
 * respeitando notch/safe-area e barras retráteis do iOS.
 */
export function useSheetViewport(open: boolean) {
  const vp = useVisualViewport();
  useBodyScrollLock(open);

  return {
    position: "fixed" as const,
    left: 0,
    right: 0,
    top: vp.offsetTop ? `${vp.offsetTop}px` : 0,
    height: vp.height ? `${vp.height}px` : "100dvh",
  };
}

/** Container rolável mais próximo (o corpo do sheet). */
function closestScroller(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/**
 * Reposiciona o campo focado dentro do container rolável do sheet, sem usar
 * `scrollIntoView` (que rola ancestrais/página e causa o "pulo").
 * Só rola quando o campo está realmente fora da área visível.
 */
/** Usuário pediu "reduzir animações" no sistema operacional. */
export function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Hook reativo para `prefers-reduced-motion`. */
export function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export function revealFieldInScroller(el: HTMLElement | null, smooth = true) {
  if (!el || !document.contains(el)) return;
  const scroller = closestScroller(el);
  if (!scroller) return;

  const vv = window.visualViewport;
  const viewTop = vv ? vv.offsetTop : 0;
  const viewBottom = viewTop + (vv ? vv.height : window.innerHeight);
  // Limita também à caixa do próprio scroller (o sheet pode não ocupar tudo).
  const box = scroller.getBoundingClientRect();
  const top = Math.max(viewTop, box.top);
  const bottom = Math.min(viewBottom, box.bottom);
  const rect = el.getBoundingClientRect();
  const margin = 16;

  let delta = 0;
  if (rect.bottom > bottom - margin) delta = rect.bottom - (bottom - margin);
  else if (rect.top < top + margin) delta = rect.top - (top + margin);
  // Ao corrigir pelo rodapé, nunca rola além do topo do campo.
  if (delta > 0) delta = Math.min(delta, Math.max(0, rect.top - (top + margin)));

  if (Math.abs(delta) < 2) return;

  // Com "reduzir animações" o reposicionamento é instantâneo (sem sensação de salto).
  const behavior: ScrollBehavior = smooth && !prefersReducedMotion() ? "smooth" : "auto";
  scroller.scrollTo({ top: scroller.scrollTop + delta, behavior });
}

/**
 * Mantém o campo focado sempre visível quando o teclado abre/fecha,
 * sem "saltos": cancela o scroll nativo do navegador e reposiciona
 * suavemente dentro do container rolável do sheet.
 */
export function useKeyboardFocusScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let focused: HTMLElement | null = null;
    let raf = 0;
    const timers: number[] = [];

    const isField = (el: Element | null): el is HTMLElement =>
      !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

    const reveal = (smooth = true) => {
      if (!focused || !document.contains(focused)) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => revealFieldInScroller(focused, smooth));
    };


    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!isField(target)) return;
      focused = target;
      // O iOS rola o "layout viewport" ao focar dentro de um elemento fixo:
      // desfazemos esse deslocamento em cada frame do primeiro meio segundo,
      // eliminando o salto visual do sheet.
      const undoPageScroll = () => {
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      };
      undoPageScroll();
      const start = performance.now();
      const tick = () => {
        undoPageScroll();
        if (performance.now() - start < 600) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // Espera o teclado terminar de abrir antes de reposicionar.
      [120, 320, 520].forEach((ms) => timers.push(window.setTimeout(() => reveal(false), ms)));
    };

    // Durante as transições do sheet o elemento focado pode perder o foco
    // (re-render/animação). Se nenhum outro campo assumiu, devolvemos o foco.
    const onFocusOut = (e: FocusEvent) => {
      const prev = e.target as HTMLElement | null;
      timers.push(
        window.setTimeout(() => {
          const active = document.activeElement;
          if (isField(active)) return; // outro campo assumiu o foco
          if (active && active !== document.body) return; // botão/link recebeu o foco
          if (prev && isField(prev) && document.contains(prev)) {
            const start = (prev as HTMLTextAreaElement).selectionStart;
            const end = (prev as HTMLTextAreaElement).selectionEnd;
            prev.focus({ preventScroll: true });
            if (typeof start === "number" && typeof end === "number") {
              try { (prev as HTMLTextAreaElement).setSelectionRange(start, end); } catch { /* noop */ }
            }
            focused = prev;
            reveal(false);
            return;
          }
          focused = null;
        }, 0),
      );
    };
    const onViewportChange = () => reveal(false);

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
    };
  }, [active]);
}
