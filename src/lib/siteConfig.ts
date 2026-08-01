/** Configurações públicas do site institucional da Mizu. */

/**
 * Número comercial de WhatsApp no formato internacional só com dígitos (ex.: "5511999999999").
 * TODO: preencher com o número oficial da Mizu. Enquanto vazio, o link abre o WhatsApp
 * com a mensagem pronta para o visitante escolher o contato.
 */
export const WHATSAPP_NUMBER = "";

export const WHATSAPP_MESSAGE =
  "Olá! Conheci a Mizu pelo site e gostaria de entender como funciona.";

export function whatsappUrl(message: string = WHATSAPP_MESSAGE) {
  const text = encodeURIComponent(message);
  return WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`
    : `https://wa.me/?text=${text}`;
}

export const SITE_URL = "https://mizuapp.lovable.app";
