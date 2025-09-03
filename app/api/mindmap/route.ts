import { NextRequest, NextResponse } from "next/server";
import { fallbackTreeFromText, tryParseJSON } from "@/lib/mindmap";

const LLM_BASE = process.env.LLM_BASE_URL || "http://bel2ai.duckdns.org:8001/v1/chat/completions";
const LLM_MODEL = process.env.LLM_MODEL || "local";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const system =
      'You generate mind-map JSON. Return ONLY JSON, no prose. Schema: {"name": string, "children": Node[]}; Node = same schema. 1 short root name, 4-8 main children, each 2-5 concise sub-children. No explanations or backticks.';

    const body = {
      model: LLM_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text }
      ],
      max_tokens: 1024,
      temperature: 0.4
    };

    let tree = null as any;
    try {
      const res = await fetch(LLM_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store"
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      tree = tryParseJSON(content);
    } catch {
      // fall through to fallback
    }

    if (!tree) tree = fallbackTreeFromText(text);
    return NextResponse.json({ tree }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "unknown error" }, { status: 500 });
  }
}
