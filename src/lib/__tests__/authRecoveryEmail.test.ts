import { describe, expect, it } from "vitest";
import { buildRecoveryEmailHtml, PASSWORD_RESET_REDIRECT_URL } from "../authRecoveryEmail";

const getRecoveryButton = (html: string) => {
  const document = new DOMParser().parseFromString(html, "text/html");
  return document.querySelector<HTMLAnchorElement>('[data-testid="recovery-email-button"]');
};

describe("recovery email HTML", () => {
  it("renders the reset-password button as a clickable link with full URL and recovery token params", () => {
    const confirmationUrl = `${PASSWORD_RESET_REDIRECT_URL}?token_hash=token-abc-123&type=recovery&redirect_to=${encodeURIComponent(PASSWORD_RESET_REDIRECT_URL)}`;
    const html = buildRecoveryEmailHtml({ confirmationUrl, siteName: "Kōban" });
    const button = getRecoveryButton(html);

    expect(button).not.toBeNull();
    expect(button?.tagName).toBe("A");
    expect(button?.textContent?.trim()).toBe("Redefinir senha");
    expect(button?.getAttribute("href")).toBe(confirmationUrl);
    expect(button?.getAttribute("target")).toBe("_blank");
    expect(button?.getAttribute("rel")).toContain("noopener");

    const href = button?.getAttribute("href");
    expect(href).toBeTruthy();
    const url = new URL(href as string);
    expect(url.origin).toBe("https://mizuapp.lovable.app");
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token_hash")).toBe("token-abc-123");
    expect(url.searchParams.get("type")).toBe("recovery");
    expect(url.searchParams.get("redirect_to")).toBe(PASSWORD_RESET_REDIRECT_URL);
  });

  it("fails when the recovery link has no token parameters", () => {
    expect(() =>
      buildRecoveryEmailHtml({ confirmationUrl: PASSWORD_RESET_REDIRECT_URL })
    ).toThrow(/recovery token/i);
  });
});