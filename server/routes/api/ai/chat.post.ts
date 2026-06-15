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

  const apiKey = await getSetting("openai_api_key");
  if (!apiKey) {
    throw createError({ statusCode: 500, statusMessage: "OpenAI API key not configured" });
  }

  const systemContext = await getAssetSummaryContext();

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

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      throw new Error(`OpenAI error: ${errText}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    return { reply: data.choices[0].message.content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw createError({ statusCode: 500, statusMessage: msg });
  }
});