"use client";
import { useEffect, useMemo, useState } from "react";
import Mindmap from "@/components/Mindmap";
import type { TreeNode } from "@/lib/mindmap";

const SAMPLE = `Title: Strategic Planning Workshop

Goal: Craft a 1-page plan to scale Belto Doc across 3 campuses.

Focus: users, value props, pricing, integrations, risks, metrics.`;

export default function Page() {
  const [text, setText] = useState("");
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const savedDark = localStorage.getItem("mindmap.dark");
    if (savedDark) setDark(savedDark === "1");
    const savedText = localStorage.getItem("mindmap.text");
    if (savedText) setText(savedText);
    const savedTree = localStorage.getItem("mindmap.tree");
    if (savedTree) try { setTree(JSON.parse(savedTree)); } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("mindmap.dark", dark ? "1" : "0");
  }, [dark]);

  useEffect(() => { localStorage.setItem("mindmap.text", text); }, [text]);
  useEffect(() => { if (tree) localStorage.setItem("mindmap.tree", JSON.stringify(tree)); }, [tree]);

  const disabled = useMemo(() => !text.trim() || loading, [text, loading]);

  const generate = async () => {
    setLoading(true);
    setTree(null);
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data?.tree) setTree(data.tree);
      else alert("Failed to generate mindmap");
    } catch (e: any) {
      alert(e?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-5 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Mindmap Generator</h1>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 ring-1 ring-white/20 shadow-sm hover:opacity-90"
            onClick={() => setDark(d => !d)}
          >
            {dark ? "Light" : "Dark"} Mode
          </button>
          <a
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 ring-1 ring-white/20 shadow-sm hover:opacity-90"
            href="https://github.com/BeltoAI/MIND"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>

      <section className="rounded-3xl p-4 ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-white/5 backdrop-blur space-y-3">
        <label className="text-sm opacity-80">Paste topic text</label>
        <textarea
          spellCheck={false}
          placeholder={SAMPLE}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full rounded-2xl p-4 bg-white/70 dark:bg-white/5 ring-1 ring-black/10 dark:ring-white/10 min-h-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm ring-1 ring-white/10 bg-indigo-600 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={generate}
            disabled={disabled}
          >
            {loading ? "Generating…" : "Generate Mindmap"}
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm ring-1 ring-white/10 hover:opacity-90"
            onClick={() => setText(SAMPLE)}
          >
            Load Sample
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 shadow-sm ring-1 ring-white/10 hover:opacity-90"
            onClick={() => { setText(""); setTree(null); localStorage.removeItem("mindmap.tree"); }}
          >
            Clear
          </button>
        </div>
        <p className="text-xs opacity-70">Calls your LLM via /api/mindmap. If unreachable, we still render a clean fallback tree.</p>
      </section>

      {tree && <section><Mindmap data={tree} /></section>}

      <footer className="opacity-70 text-xs text-center pt-4">Next.js • radial D3 • depth-colored links • exports</footer>
    </main>
  );
}
