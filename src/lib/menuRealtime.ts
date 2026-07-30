import { supabase } from "@/integrations/supabase/client";

/**
 * Canal de tempo real do cardápio público.
 * O painel emite um broadcast sempre que muda algo que afeta o cardápio
 * (horários, aceitar pedidos, identidade visual, taxas...) e o cardápio
 * público revalida imediatamente no backend — sem esperar o polling.
 */
export type MenuUpdateReason =
  | "settings"
  | "hours"
  | "accepting_orders"
  | "shift"
  | "menu";

const channelName = (restaurantId: string) => `menu-updates:${restaurantId}`;

/** Emite o aviso de atualização (usado pelo painel administrativo). */
export async function broadcastMenuUpdate(
  restaurantId: string | null | undefined,
  reason: MenuUpdateReason,
) {
  if (!restaurantId) return;
  const channel = supabase.channel(channelName(restaurantId), {
    config: { broadcast: { self: false, ack: false } },
  });
  try {
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") resolve();
      });
      setTimeout(resolve, 3000);
    });
    await channel.send({
      type: "broadcast",
      event: "menu-update",
      payload: { reason, at: Date.now() },
    });
  } catch {
    /* broadcast é best-effort; o polling cobre a falha */
  } finally {
    setTimeout(() => { supabase.removeChannel(channel); }, 500);
  }
}

/** Assina as atualizações (usado pelo cardápio público). Retorna o unsubscribe. */
export function subscribeMenuUpdates(
  restaurantId: string,
  onUpdate: (reason: MenuUpdateReason) => void,
) {
  const channel = supabase
    .channel(channelName(restaurantId), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "menu-update" }, (msg) => {
      onUpdate(((msg.payload as any)?.reason ?? "settings") as MenuUpdateReason);
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
