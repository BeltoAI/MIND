"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

type TreeNode = { name: string; children?: TreeNode[] };

// ----- VISUAL TUNING -----
const RING_STEP = 170;                 // ring spacing
const ROOT_RADIUS = 68;
const LEVEL_BASE = [ROOT_RADIUS, 48, 38, 32, 28, 24];
const MIN_GAP = 22;                    // min px distance between bubble edges
const FONT_FAMILY = `Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans"`;
const TEXT_SIZE = 13;

const BRANCH_COLORS: [string,string][] = [
  ["#6366f1", "#14b8a6"], // indigo → teal
  ["#f59e0b", "#ef4444"], // amber → red
  ["#22d3ee", "#a78bfa"], // cyan → violet
  ["#34d399", "#f472b6"], // green → pink
  ["#60a5fa", "#10b981"], // blue → emerald
  ["#eab308", "#f97316"], // yellow → orange
];
// -------------------------

function measureCtx(font = `${TEXT_SIZE}px ${FONT_FAMILY}`) {
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d")!;
  ctx.font = font;
  return ctx;
}
function wrapByWidth(label: string, maxWidth: number, fontSize = TEXT_SIZE) {
  const ctx = measureCtx(`${fontSize}px ${FONT_FAMILY}`);
  const words = label.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (ctx.measureText(next).width > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}
function firstAncestorIndex(path: number[]): number { return path.length >= 2 ? path[1] : 0; }
function walk(root: TreeNode, cb: (n: TreeNode, depth: number, path: number[], parentId?: string) => void) {
  function rec(n: TreeNode, depth: number, path: number[], parentId?: string) {
    cb(n, depth, path, parentId);
    n.children?.forEach((c, i) => rec(c, depth + 1, [...path, i], path.join("-") || "root"));
  }
  rec(root, 0, [0], undefined);
}

type Bubble = { id: string; label: string; depth: number; branch: number; x: number; y: number; r: number; lines: string[]; };
type Link = { id: string; from: string; to: string; stroke: string; width: number; d: string };

function buildInitialLayout(tree: TreeNode) {
  type Tmp = { id: string; label: string; depth: number; branch: number; parentId?: string };
  const nodes: Tmp[] = [];
  const edges: { from: string; to: string }[] = [];

  walk(tree, (n, depth, path, parentId) => {
    const id = path.join("-");
    const branch = Math.max(0, firstAncestorIndex(path)) % BRANCH_COLORS.length;
    nodes.push({ id, label: n.name, depth, branch, parentId });
    if (parentId) edges.push({ from: parentId, to: id });
  });

  const children = new Map<string, string[]>();
  edges.forEach(e => {
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from)!.push(e.to);
  });

  const incoming = new Set(edges.map(e => e.to));
  const rootId = nodes.find(n => !incoming.has(n.id))?.id ?? nodes[0].id;

  const top = children.get(rootId) || [];
  const sectorCount = Math.max(1, top.length);
  const TWO_PI = Math.PI * 2;
  const sectorSize = TWO_PI / sectorCount;
  const center = { x: 0, y: 0 };

  const placed = new Map<string, { x: number; y: number }>();
  placed.set(rootId, center);

  // place top-level
  for (let i = 0; i < top.length; i++) {
    const id = top[i];
    const angle = i * sectorSize - Math.PI / 2;
    placed.set(id, { x: center.x + RING_STEP * Math.cos(angle), y: center.y + RING_STEP * Math.sin(angle) });
  }
  // place deeper
  function placeSubtree(parentId: string, sectorIndex: number, depth: number) {
    const kids = children.get(parentId) || [];
    if (!kids.length) return;
    const baseAngle = sectorIndex * sectorSize - Math.PI / 2;
    const spread = Math.min(sectorSize * 0.78, Math.PI / 1.7);
    const start = baseAngle - spread / 2;
    const r = depth * RING_STEP;
    kids.forEach((id, i) => {
      const a = start + (spread * (i + 1)) / (kids.length + 1);
      placed.set(id, { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
      placeSubtree(id, sectorIndex, depth + 1);
    });
  }
  top.forEach((id, i) => placeSubtree(id, i, 2));

  // bubble sizing (pixel-fit)
  const ctx = measureCtx(`${TEXT_SIZE}px ${FONT_FAMILY}`);
  const bubbles: Bubble[] = nodes.map(n => {
    const p = placed.get(n.id) || center;
    const targetW = n.depth === 0 ? 170 : n.depth === 1 ? 145 : n.depth === 2 ? 125 : 115;
    const lines = wrapByWidth(n.label, targetW, TEXT_SIZE);
    const maxLine = lines.reduce((m, s) => Math.max(m, ctx.measureText(s).width), 0);
    const lineCount = lines.length;
    const padX = 18, padY = 16;
    const boxW = Math.max(targetW, maxLine) + padX * 2;
    const boxH = lineCount * (TEXT_SIZE + 4) + padY * 2;
    const fitted = Math.ceil(Math.sqrt(boxW * boxW + boxH * boxH) / 2);
    const base = LEVEL_BASE[Math.min(n.depth, LEVEL_BASE.length - 1)];
    const r = Math.max(base, fitted);
    return { id: n.id, label: n.label, depth: n.depth, branch: n.branch, x: p.x, y: p.y, r, lines };
  });

  // links
  const links: Link[] = edges.map(e => {
    const a = bubbles.find(b => b.id === e.from)!;
    const b = bubbles.find(b => b.id === e.to)!;
    const [stroke] = BRANCH_COLORS[a.branch];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const cx = mid.x * 0.7, cy = mid.y * 0.7;
    const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
    const width = Math.max(1.6, 3.8 - b.depth * 0.45);
    return { id: `${e.from}-${e.to}`, from: e.from, to: e.to, stroke, width, d };
  });

  return { bubbles, links };
}

// simple non-overlap relaxation (push apart)
function relax(bubbles: Bubble[], iterations = 80) {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const minDist = a.r + b.r + MIN_GAP;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

function serializeSVG(svgEl: SVGSVGElement, fontFamily = FONT_FAMILY): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    text { font-family: ${fontFamily}; }
  `;
  clone.insertBefore(style, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}
async function svgToPngDataUrl(svgText: string, width: number, height: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale; canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function Mindmap({ data }: { data: TreeNode }) {
  const { bubbles: initialB, links: initialL } = useMemo(() => buildInitialLayout(data), [data]);

  // copy then relax to avoid overlaps
  const { bubbles, links } = useMemo(() => {
    const bs = initialB.map(b => ({ ...b }));
    relax(bs, 80);
    // rebuild links using relaxed positions
    const ls = initialL.map(l => {
      const a = bs.find(b => b.id === l.from)!;
      const b = bs.find(b => b.id === l.to)!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const cx = mid.x * 0.7, cy = mid.y * 0.7;
      return { ...l, d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}` };
    });
    return { bubbles: bs, links: ls };
  }, [initialB, initialL]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState({ w: 1500, h: 950 });
  const padding = 160;

  useEffect(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    bubbles.forEach(b => {
      minX = Math.min(minX, b.x - b.r);
      minY = Math.min(minY, b.y - b.r);
      maxX = Math.max(maxX, b.x + b.r);
      maxY = Math.max(maxY, b.y + b.r);
    });
    const w = Math.ceil(maxX - minX + padding * 2);
    const h = Math.ceil(maxY - minY + padding * 2);
    setView({ w: Math.max(1100, w), h: Math.max(760, h) });
  }, [bubbles]);

  const exportSVG = () => {
    if (!svgRef.current) return;
    const svgText = serializeSVG(svgRef.current);
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mindmap.svg"; a.click();
    URL.revokeObjectURL(url);
  };
  const exportPNG = async () => {
    if (!svgRef.current) return;
    const svgText = serializeSVG(svgRef.current);
    const dataUrl = await svgToPngDataUrl(svgText, view.w, view.h, 2);
    const a = document.createElement("a"); a.href = dataUrl; a.download = "mindmap.png"; a.click();
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mindmap.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative rounded-3xl ring-1 ring-black/10 dark:ring-white/10 bg-white/60 dark:bg-black/40 backdrop-blur" style={{ height: "72vh" }}>
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button className="px-3 py-2 rounded-xl bg-indigo-600 text-white shadow hover:opacity-90" onClick={exportPNG}>Export PNG</button>
        <button className="px-3 py-2 rounded-xl bg-white/10 text-white ring-1 ring-white/20 hover:opacity-90" onClick={exportSVG}>Export SVG</button>
        <button className="px-3 py-2 rounded-xl bg-white/10 text-white ring-1 ring-white/20 hover:opacity-90" onClick={exportJSON}>Export JSON</button>
      </div>

      <div className="h-full rounded-3xl overflow-auto">
        <svg
          ref={svgRef}
          width={view.w}
          height={view.h}
          viewBox={`${-view.w / 2} ${-view.h / 2} ${view.w} ${view.h}`}
          role="img"
        >
          <defs>
            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.22" />
            </filter>
            {BRANCH_COLORS.map(([g1, g2], i) => (
              <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={g1} stopOpacity="0.96" />
                <stop offset="100%" stopColor={g2} stopOpacity="0.96" />
              </linearGradient>
            ))}
          </defs>

          {/* edges under bubbles */}
          {links.map(l => (
            <path key={l.id} d={l.d} fill="none" stroke={l.stroke} strokeWidth={l.width} opacity="0.9" />
          ))}

          {/* bubbles */}
          {bubbles.map(b => (
            <g key={b.id} transform={`translate(${b.x}, ${b.y})`} filter="url(#softShadow)">
              {/* halo ring for crisp separation */}
              <circle r={b.r + 3} fill="white" opacity="0.35" />
              {/* main bubble */}
              <circle r={b.r} fill={`url(#grad-${b.branch})`} />
              {/* glossy overlay */}
              <circle r={b.r} fill="#fff" opacity="0.06" />
              {/* fine outline */}
              <circle r={b.r} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
              {/* label */}
              <text textAnchor="middle" dominantBaseline="middle" fill="#fff" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={TEXT_SIZE}>
                {b.lines.map((t, i) => (
                  <tspan key={i} x={0} dy={i === 0 ? 0 : TEXT_SIZE + 4}>{t}</tspan>
                ))}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
