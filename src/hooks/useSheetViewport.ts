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
      const offsetTop = Math.round(vv ? vv.offsetTop : 0);
      // Espaço ocupado pelo teclado (ou barras) abaixo da área visível.
      const keyboardInset = Math.max(0, Math.round(window.innerHeight - height - offsetTop));
      setVp({ height, offsetTop, keyboardInset });
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
let savedScrollY = 0;
let savedStyles: Partial<CSSStyleDeclaration> | null = null;

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
    };
    body.style.position = "fixed";
    body.style.top = `-${savedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
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
    savedStyles = null;
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
