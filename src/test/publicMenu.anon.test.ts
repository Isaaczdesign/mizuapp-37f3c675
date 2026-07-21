import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Cliente anônimo puro: sem sessão persistida, sem auto-refresh.
// Garante que estamos exercitando as políticas de acesso público (role `anon`).
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Testes de acesso público ao cardápio.
 *
 * Objetivo: garantir que um visitante anônimo (sem login) consegue
 * renderizar o cardápio completo de um restaurante ativo — restaurante,
 * categorias, itens, variações e adicionais — usando exatamente as
 * mesmas chamadas que a página `/r/:slug` faz.
 */
describe("Cardápio público — acesso anônimo", () => {
  let slug: string;
  let restaurantId: string;

  beforeAll(async () => {
    // Descobre dinamicamente um restaurante ativo via RPC pública.
    // Se nenhum restaurante ativo existir, o teste é encerrado com falha explícita.
    const { data, error } = await (anon as any).rpc("get_public_restaurant_by_slug", {
      _slug: "sushi-ponto-fundo-ix7h",
    });
    if (error) throw error;
    const rest = Array.isArray(data) ? data[0] : data;
    if (!rest) throw new Error("Nenhum restaurante ativo encontrado para o slug de teste");
    slug = rest.slug;
    restaurantId = rest.id;
  });

  it("não deve ter sessão autenticada", async () => {
    const { data } = await anon.auth.getSession();
    expect(data.session).toBeNull();
  });

  it("resolve restaurante público via RPC get_public_restaurant_by_slug", async () => {
    const { data, error } = await (anon as any).rpc("get_public_restaurant_by_slug", { _slug: slug });
    expect(error).toBeNull();
    const rest = Array.isArray(data) ? data[0] : data;
    expect(rest).toBeTruthy();
    expect(rest.id).toBe(restaurantId);
    expect(rest.is_active).toBe(true);
    // Campos essenciais para renderizar o cabeçalho do cardápio
    expect(rest).toHaveProperty("name");
    expect(rest).toHaveProperty("slug");
    expect(rest).toHaveProperty("primary_color");
  });

  it("retorna null para slug inexistente sem erro de permissão", async () => {
    const { data, error } = await (anon as any).rpc("get_public_restaurant_by_slug", {
      _slug: "slug-que-nao-existe-xyz-123",
    });
    expect(error).toBeNull();
    const rest = Array.isArray(data) ? data[0] : data;
    expect(rest).toBeFalsy();
  });

  it("lista categorias do cardápio sem autenticação", async () => {
    const { data, error } = await anon
      .from("menu_categories")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("sort_order");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("lista itens ativos do cardápio sem autenticação", async () => {
    const { data, error } = await anon
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .order("sort_order");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("lista variações e adicionais dos itens sem autenticação", async () => {
    const { data: items, error: itemsErr } = await anon
      .from("menu_items")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true);
    expect(itemsErr).toBeNull();
    const ids = (items ?? []).map((i: any) => i.id);
    if (ids.length === 0) return; // cardápio vazio é aceitável

    const [varRes, addonRes] = await Promise.all([
      (anon as any)
        .from("menu_item_variations")
        .select("*")
        .in("menu_item_id", ids)
        .eq("is_active", true),
      (anon as any)
        .from("menu_item_addons")
        .select("*")
        .in("menu_item_id", ids)
        .eq("is_active", true),
    ]);
    expect(varRes.error).toBeNull();
    expect(addonRes.error).toBeNull();
    expect(Array.isArray(varRes.data)).toBe(true);
    expect(Array.isArray(addonRes.data)).toBe(true);
  });

  it("não expõe dados sensíveis do dono via RPC pública", async () => {
    const { data } = await (anon as any).rpc("get_public_restaurant_by_slug", { _slug: slug });
    const rest = Array.isArray(data) ? data[0] : data;
    // A RPC retorna apenas campos seguros — nenhum e-mail/dado privado do dono
    expect(rest).not.toHaveProperty("owner_id");
    expect(rest).not.toHaveProperty("owner_email");
  });

  it("bloqueia leitura direta da tabela restaurants (proteção de PII)", async () => {
    const { data, error } = await anon
      .from("restaurants")
      .select("owner_id")
      .eq("id", restaurantId);
    // Ou erro de permissão, ou lista vazia — nunca deve vazar owner_id
    const leaked = (data ?? []).some((r: any) => r.owner_id);
    expect(leaked).toBe(false);
    if (!error) expect((data ?? []).length).toBe(0);
  });

  it("renderiza o cardápio completo (fluxo idêntico ao PublicMenu.tsx)", async () => {
    // Reproduz exatamente o fluxo de loadMenu() da página pública
    const { data: restRows, error: restErr } = await (anon as any).rpc(
      "get_public_restaurant_by_slug",
      { _slug: slug }
    );
    expect(restErr).toBeNull();
    const rest = Array.isArray(restRows) ? restRows[0] : restRows;
    expect(rest).toBeTruthy();

    const [catRes, itemRes] = await Promise.all([
      anon.from("menu_categories").select("*").eq("restaurant_id", rest.id).order("sort_order"),
      anon
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", rest.id)
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    expect(catRes.error).toBeNull();
    expect(itemRes.error).toBeNull();
  });
});
