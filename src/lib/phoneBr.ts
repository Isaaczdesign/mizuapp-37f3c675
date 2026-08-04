/** Máscara e validação de celular brasileiro (DDD + 8 ou 9 dígitos). */

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** Formata progressivamente: (11) 99999-9999 */
export function formatPhoneBR(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Retorna null quando válido, ou a mensagem do que está errado. */
export function validatePhoneBR(value: string): string | null {
  const d = onlyDigits(value);
  if (d.length === 0) return "Informe seu WhatsApp com DDD.";
  if (d.length < 10) return `Faltam ${10 - d.length} dígito(s). Use DDD + número, ex.: (11) 99999-9999.`;
  if (d.length > 11) return "Número com dígitos demais. Use DDD + 8 ou 9 dígitos.";
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return "DDD inválido. Use um DDD entre 11 e 99.";
  if (d.length === 11 && d[2] !== "9") return "Celular com 9 dígitos deve começar com 9 após o DDD.";
  if (d.length === 10 && Number(d[2]) < 2) return "Número inválido. Confira o número após o DDD.";
  if (/^(\d)\1+$/.test(d.slice(2))) return "Número inválido. Confira os dígitos.";
  return null;
}

export function isValidPhoneBR(value: string): boolean {
  return validatePhoneBR(value) === null;
}

/** Retorna null quando válido, ou a mensagem do que está errado. */
export function validateFullName(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "Informe seu nome.";
  if (v.length < 2) return "Nome muito curto.";
  if (v.length > 80) return "Nome muito longo.";
  if (!/[A-Za-zÀ-ÿ]/.test(v)) return "Nome inválido — use letras.";
  return null;
}
