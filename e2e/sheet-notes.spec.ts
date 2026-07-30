import { test, expect, Page } from "@playwright/test";

const HARNESS = "/dev/sheet-harness";

async function openSheet(page: Page) {
  await page.goto(HARNESS, { waitUntil: "domcontentloaded" });
  await page.getByTestId("open-sheet").click();
  await expect(page.getByTestId("sheet-panel")).toBeVisible();
  // Espera a animação de entrada do sheet terminar.
  await page.waitForTimeout(600);
}

const notesOf = (page: Page) => page.getByTestId("notes");

const heightOf = async (page: Page) =>
  await notesOf(page).evaluate((el) => (el as HTMLTextAreaElement).offsetHeight);

test.describe("Sheet — textarea de Observações", () => {
  test("expande verticalmente conforme o conteúdo e para no limite", async ({ page }) => {
    await openSheet(page);
    const notes = notesOf(page);
    await notes.click();

    const initial = await heightOf(page);
    expect(initial).toBeGreaterThanOrEqual(70);

    await notes.fill(Array.from({ length: 6 }, (_, i) => `linha ${i + 1}`).join("\n"));
    const grown = await heightOf(page);
    expect(grown).toBeGreaterThan(initial);

    // Limite máximo (220px) + scroll interno habilitado.
    await notes.fill(Array.from({ length: 40 }, (_, i) => `linha ${i + 1}`).join("\n"));
    const capped = await heightOf(page);
    expect(capped).toBeLessThanOrEqual(222);
    expect(
      await notes.evaluate((el) => getComputedStyle(el).overflowY),
    ).toBe("auto");

    // Encolhe de volta ao esvaziar.
    await notes.fill("");
    expect(await heightOf(page)).toBeLessThanOrEqual(initial + 2);
  });

  test("mantém o campo e o cursor visíveis enquanto cresce", async ({ page }) => {
    await openSheet(page);
    const notes = notesOf(page);
    await notes.click();
    await notes.fill(Array.from({ length: 10 }, (_, i) => `linha ${i + 1}`).join("\n"));
    await page.waitForTimeout(400);

    const visible = await notes.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const vh = window.visualViewport?.height ?? window.innerHeight;
      return rect.top >= 0 && rect.bottom <= vh + 1;
    });
    expect(visible).toBe(true);
    await expect(notes).toBeFocused();
  });

  test("não rola a página por baixo do sheet (sem 'pulo')", async ({ page }) => {
    await openSheet(page);
    const before = await page.evaluate(() => window.scrollY);
    await notesOf(page).click();
    await notesOf(page).fill("uma\nobservação\nbem\nlonga\naqui\nmesmo");
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
});

test.describe("Sheet — foco durante animações e transições", () => {
  test("mantém o foco no textarea durante a transição de etapa", async ({ page }) => {
    await openSheet(page);
    const notes = notesOf(page);
    await notes.click();
    await notes.type("obs");
    await expect(notes).toBeFocused();

    // Transição de etapa (re-render + animação) não pode roubar o foco do campo.
    await page.getByTestId("next-step").dispatchEvent("click");
    await page.waitForTimeout(500);
    await expect(notes).toBeFocused();
  });

  test("restaura o foco e a seleção se o campo perder foco na transição", async ({ page }) => {
    await openSheet(page);
    const notes = notesOf(page);
    await notes.click();
    await notes.fill("observação de teste");
    await notes.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(4, 9));

    // Simula a perda de foco causada por uma animação/re-render do sheet.
    await notes.evaluate((el) => (el as HTMLTextAreaElement).blur());
    await page.waitForTimeout(300);

    await expect(notes).toBeFocused();
    const selection = await notes.evaluate((el) => {
      const t = el as HTMLTextAreaElement;
      return [t.selectionStart, t.selectionEnd];
    });
    expect(selection).toEqual([4, 9]);
  });

  test("respeita 'reduzir animações' mantendo o campo estável", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSheet(page);
    const notes = notesOf(page);
    await notes.click();

    const top1 = await notes.evaluate((el) => el.getBoundingClientRect().top);
    await notes.fill("linha 1\nlinha 2");
    await page.waitForTimeout(250);
    const top2 = await notes.evaluate((el) => el.getBoundingClientRect().top);

    // Sem animações longas o campo não deve "saltar" na tela.
    expect(Math.abs(top2 - top1)).toBeLessThanOrEqual(80);
    await expect(notes).toBeFocused();
  });
});
