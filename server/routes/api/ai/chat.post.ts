import { defineHandler } from "nitro";
import { readBody, createError } from "nitro/h3";
import { requireUserAuth } from "../../../lib/auth";
import { getAssetSummaryContext, getSetting } from "../../../db/mysql";

export default defineHandler(async (event) => {
  await requireUserAuth(event);

  const body = await readBody<{ message?: string }>(event);
  if (!body?.message) {
    throw createError({ statusCode: 400, statusMessage: "message required" });
  }

  const apiKey = await getSetting("ai_api_key");
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "AI API key not configured. Set it in Settings → AI Assistant." });
  }

  const baseUrl = (await getSetting("ai_base_url")) || "https://api.openai.com/v1";
  const model = (await getSetting("ai_model")) || "gpt-4o-mini";

  // Load asset context — don't fail if this breaks
  let systemContext = "Asset data temporarily unavailable.";
  try {
    systemContext = await getAssetSummaryContext();
  } catch (err) {
    console.error("[AI] Failed to load asset context:", err);
  }

  const systemPrompt = `You are a helpful IT infrastructure assistant for the PerimeterPulse monitoring platform. 
You have access to the following real-time data about the monitored assets:

${systemContext}

Answer the user's question based on this data. Be concise and technical.
If no data is available, say so.

Key rules:
- Use emojis sparingly
- Format numbers with proper units (%, GB, ms, etc.)
- Highlight critical/warning statuses
- Suggest actions if relevant`;

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = `${normalizedBase}/chat/completions`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: body.message },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[AI] Provider error (${endpoint}): ${response.status}`, errText);
      throw new Error(`AI provider returned ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = await response.json() as any;

    // Handle different response formats from different providers
    let reply = "";

    // Standard OpenAI-compatible format
    if (data?.choices?.[0]?.message?.content) {
      reply = data.choices[0].message.content;
    }
    // Some providers return reply directly
    else if (data?.reply) {
      reply = data.reply;
    }
    // Some return in content field
    else if (data?.content) {
      reply = data.content;
    }
    // Some return in message field
    else if (data?.message) {
      reply = data.message;
    }
    // Last resort: stringify the entire response
    else {
      console.warn("[AI] Unknown response format:", JSON.stringify(data).slice(0, 500));
      reply = JSON.stringify(data);
    }

    if (!reply || reply.trim() === "") {
      throw new Error("AI provider returned empty response");
    }

    return { reply };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI] Chat error:", msg);
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});