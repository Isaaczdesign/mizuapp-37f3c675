export const PASSWORD_RESET_REDIRECT_URL = "https://mizuapp.lovable.app/reset-password";

type RecoveryEmailHtmlOptions = {
  confirmationUrl: string;
  siteName?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const assertRecoveryConfirmationUrl = (confirmationUrl: string) => {
  const url = new URL(confirmationUrl);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const hasRecoveryToken =
    url.searchParams.has("code") ||
    url.searchParams.has("token_hash") ||
    url.searchParams.has("token") ||
    hashParams.has("access_token");

  if (!hasRecoveryToken) {
    throw new Error("Recovery email link must include a recovery token parameter.");
  }

  return url.toString();
};

export const buildRecoveryEmailHtml = ({
  confirmationUrl,
  siteName = "Kōban",
}: RecoveryEmailHtmlOptions) => {
  const href = assertRecoveryConfirmationUrl(confirmationUrl);
  const safeHref = escapeHtml(href);
  const safeSiteName = escapeHtml(siteName);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redefinir senha - ${safeSiteName}</title>
  </head>
  <body style="margin:0;background:#ffffff;font-family:Arial,sans-serif;color:#111827;">
    <main style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <h1 style="font-size:24px;line-height:32px;margin:0 0 16px;">Redefinir sua senha</h1>
      <p style="font-size:16px;line-height:24px;margin:0 0 24px;color:#4b5563;">Recebemos uma solicitação para redefinir a senha da sua conta ${safeSiteName}.</p>
      <a href="${safeHref}" target="_blank" rel="noopener noreferrer" data-testid="recovery-email-button" style="display:inline-block;background:#E84310;color:#FFFFFF;text-decoration:none;font-weight:700;border-radius:8px;padding:14px 20px;">Redefinir senha</a>
      <p style="font-size:13px;line-height:20px;margin:24px 0 0;color:#6b7280;">Se o botão não abrir, copie e cole este link no navegador:<br /><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeHref}</a></p>
    </main>
  </body>
</html>`;
};