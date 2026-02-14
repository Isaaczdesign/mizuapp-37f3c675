import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are "MenuImportAI" for Japanese restaurant menus in Brazil.

Input: ONE menu file (PDF or image) already OCR-extracted into plain text + optional layout hints.

Output: STRICT JSON only. No commentary.

GOAL:
Convert messy OCR text into a structured draft menu:
- categories
- items
- prices
- ingredients (if detectable)
- variations (if detectable: 8/16/32 peças, combo sizes)
- add-ons (if detectable: extra shoyu, gengibre, wasabi)
- flags and confidence per item
- errors and unknown lines for human review

IMPORTANT:
- Preserve BRL prices: "R$ 29,90" -> 29.90
- Handle OCR mistakes (e.g., "R$ 2g,90" -> guess 29.90 with low confidence)
- Detect categories by keywords and headings.
- Output must be valid JSON.

========================
CATEGORY DETECTION RULES
========================
Primary categories (map synonyms):
- Entradas (gyoza, sunomono, edamame)
- Temaki
- Hot Roll
- Combinados / Combos
- Sashimi
- Sushi / Nigiri
- Uramaki / Hossomaki
- Yakisoba / Pratos Quentes
- Bebidas
- Sobremesas
- Rodízio (if present)

If heading lines like:
"COMBINADOS", "TEMAKI", "BEBIDAS" => category header.
If no headers exist:
infer by item keywords.

========================
ITEM PARSING RULES
========================
Item line typical patterns:
1) "Temaki Camarão — R$ 24,90"
2) "Hot Filadélfia 8 un 29,90"
3) "Combo 30 peças 89,90"
4) "Sashimi salmão (10 un) R$ 39,90"
5) "Rodízio: R$ 119,90"

Extract:
- name (string)
- base_price (number)
- description/ingredients (string or array)
- quantity/variation (if present: "8 un", "10 un", "30 peças")
- confidence (0-1)

Ingredients detection:
If text includes "arroz, salmão, cream cheese, nori" after item name, capture as ingredients array.
If unclear, put into description.

Variations:
If same item appears with multiple sizes:
- group under one item with variations:
  variations: [{name:"8 peças", price: X}, {name:"16 peças", price: Y}]
Use heuristic:
- same base name + different piece counts.

Add-ons:
Detect lines like:
"Adicional shoyu +2,00"
"Extra gengibre 1,50"
Return as add_ons list.

========================
OUTPUT JSON SCHEMA
========================
{
  "restaurant_name_guess": string|null,
  "currency": "BRL",
  "categories": [
    {
      "name": string,
      "items": [
        {
          "name": string,
          "base_price": number|null,
          "variations": [{"name": string, "price": number}] | [],
          "ingredients": [string] | [],
          "allergens": [string] | [],
          "description": string|null,
          "tags": ["combo"|"best_seller"|"high_margin"|"rodizio"] | [],
          "confidence": number,
          "source_lines": [string]
        }
      ]
    }
  ],
  "add_ons_global": [{"name": string, "price": number, "confidence": number}] | [],
  "unknown_lines": [string],
  "errors": [{"type": string, "line": string, "reason": string}]
}

========================
CONFIDENCE SCORING
========================
- 0.90+ if price and name clearly extracted
- 0.60–0.89 if minor OCR noise
- <0.60 if price guessed or category inferred

========================
ALLERGENS HEURISTICS (OPTIONAL)
========================
If ingredients include:
- "camarão" => crustaceans
- "salmão/peixe" => fish
- "cream cheese" => dairy
- "shoyu" => soy, gluten (maybe)
Populate allergens accordingly with medium confidence.

========================
FAIL-SAFE
========================
If cannot parse at least 5 items:
Return empty categories + unknown_lines + errors explaining why.

Return JSON only.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ocr_text, layout_hints } = await req.json();

    if (!ocr_text || typeof ocr_text !== "string" || ocr_text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "ocr_text is required and must contain meaningful content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Check if input is a base64 image
    const imageMatch = ocr_text.match(/^\[IMAGE_BASE64:(data:[^;]+;base64,.+)\]$/s);
    let messages: any[];

    if (imageMatch) {
      // Vision-based: send image to multimodal model
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Please extract and parse the menu from this image. Return STRICT JSON only." + (layout_hints ? `\n\nLayout hints: ${layout_hints}` : "") },
            { type: "image_url", image_url: { url: imageMatch[1] } },
          ],
        },
      ];
    } else {
      // Text-based OCR
      let userContent = `Here is the OCR-extracted menu text:\n\n${ocr_text}`;
      if (layout_hints) {
        userContent += `\n\nLayout hints:\n${layout_hints}`;
      }
      messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ];
    }

    const model = imageMatch ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent;
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return new Response(
        JSON.stringify({
          error: "AI returned invalid JSON",
          raw: rawContent.slice(0, 2000),
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-menu error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
