export type TreeNode = { name: string; children?: TreeNode[] };

export function tryParseJSON(raw: string): TreeNode | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned);
    if (obj && typeof obj === "object" && "name" in obj) return obj as TreeNode;
    return null;
  } catch {
    return null;
  }
}

export function fallbackTreeFromText(text: string): TreeNode {
  const topic = text.split(/[\.!\?\n]/)[0]?.slice(0, 60) || "Mindmap";
  const sentences = text
    .split(/[\.!\?\n]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  return {
    name: topic,
    children: sentences.map((s, i) => ({ name: s.slice(0, 50) || `Idea ${i + 1}` }))
  };
}
