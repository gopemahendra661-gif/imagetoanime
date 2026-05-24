/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  FileCode, Copy, Check, Terminal, FolderOpen, GitPullRequest, 
  HelpCircle, ChevronRight, BookOpen, Layers, Settings, Globe 
} from "lucide-react";

export default function ExporterTab() {
  const [activeFile, setActiveFile] = useState<"next_page" | "sitemap" | "cron_worker" | "pages_json">("next_page");
  const [copied, setCopied] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Next.js dynamic routing component code
  const nextPageRouteCode = `/**
 * Next.js Dynamic Route File: /app/[slug]/page.jsx
 * Instantly parses pages.json dynamically with Vercel Static Prop Generation
 */

import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import Script from "next/script";

// Load local database node safely
function getPageBySlug(slug) {
  try {
    const dataPath = path.join(process.cwd(), "data", "pages.json");
    if (!fs.existsSync(dataPath)) return null;
    const pages = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return pages.find((p) => p.slug === slug) || null;
  } catch (err) {
    return null;
  }
}

// Helper to resolve correct route paths dynamically based on standard vs. SEO tools
function getRoutePath(slug) {
  if (!slug) return "/";
  // If it's a blog link
  if (slug.includes("how-to") || slug.includes("best-") || slug.includes("guide") || slug.includes("explain") || slug.includes("text-cleaner")) {
    return "/blog/" + slug;
  }
  // List of known core /tool/ prefix tools
  const knownTools = [
    "ai-text-suite", "face-swap", "bg-remover", "enhancer", "compressor", 
    "image-upscale", "image-generator", "snapchat-tag-generator",
    "remove-all-whitespace-online", "remove-extra-spaces-online", "remove-line-breaks-tool",
    "remove-duplicate-lines-tool", "remove-empty-lines-online", "remove-numbers-from-text",
    "remove-special-characters-online", "whitespace-remover-online", "clean-text-online-free"
  ];
  if (knownTools.includes(slug)) {
    return "/tool/" + slug;
  }
  
  // Default to programmatic SEO landing path
  return "/seo/" + slug;
}

// 1. Generate Static HTML Routes during Vercel Build (generateStaticParams)
export async function generateStaticParams() {
  try {
    const dataPath = path.join(process.cwd(), "data", "pages.json");
    if (!fs.existsSync(dataPath)) return [];
    const pages = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    return pages.map((p) => ({ slug: p.slug }));
  } catch (err) {
    return [];
  }
}

// 2. Dynamic Metadata Injection matching Google standards
export async function generateMetadata({ params }) {
  const { slug } = params;
  const page = getPageBySlug(slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: {
      canonical: \`https://www.texlyonline.in/\${slug}\`,
    },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: \`https://www.texlyonline.in/\${slug}\`,
      type: "website",
    },
  };
}

// 3. Render HTML Dynamic Landing Page with Real Working Text Utility Sandbox
export default function DynamicSEOPage({ params }) {
  const { slug } = params;
  const page = getPageBySlug(slug);

  if (!page) {
    notFound();
  }

  return (
    <article className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-indigo-500/10">
      {/* 1. Rich LD Schema Injection */}
      <Script
        id="schema-markup-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(page.schemaMarkup || page.schema || {}) }}
      />

      {/* Real working navigation header mimicking Texly style */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-indigo-200 shadow-md">
              T
            </span>
            <span className="font-bold text-neutral-900 tracking-tight text-base font-sans">
              TEXLY
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm font-semibold text-neutral-600">
            <a href="/" className="hover:text-indigo-600 transition">AI Tools</a>
            <a href="/blog" className="hover:text-indigo-600 transition">Blog</a>
            <a href="https://www.texlyonline.in" className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 rounded-lg transition">DevStudio</a>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-12">
        {/* Banner Headers */}
        <section className="space-y-4 text-center">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3.5 py-1.5 rounded-full border border-indigo-100/50">
            {page.category || "SEO Utility"}
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-neutral-950 max-w-2xl mx-auto leading-tight">
            {page.title.split(" - ")[0]}
          </h1>
          <p className="text-neutral-600 text-[15px] md:text-[17px] leading-relaxed max-w-3xl mx-auto font-normal">
            {page.intro}
          </p>
        </section>

        {/* Real Dynamic Responsive Live Tool Panel */}
        <section className="bg-white border border-neutral-200 p-5 md:p-8 rounded-2xl shadow-xl space-y-5">
          <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-950 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block animate-pulse"></span>
              Browser-Native {page.category || "Text Sanitizer"}
            </h2>
            <span className="text-[10px] font-mono font-bold text-neutral-400 bg-neutral-100 px-2 py-1 rounded">100% SECURE CLIENT-SIDE CODE</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono text-neutral-400 font-bold">
              <span>INPUT STRING</span>
              <span id="char-count">0 Chars</span>
            </div>
            <textarea
              id="raw-text-input"
              className="w-full bg-neutral-50/60 border border-neutral-200 p-4 rounded-xl text-sm font-mono focus:border-indigo-500/80 focus:ring-2 focus:ring-indigo-100 outline-none text-neutral-800 transition placeholder-neutral-400"
              rows={6}
              placeholder="Paste your raw character segments here to clean..."
            />
          </div>

          <div className="flex justify-between items-center bg-neutral-50 p-3.5 rounded-xl border border-neutral-150/70 flex-wrap gap-3">
            <span className="text-xs text-neutral-500 flex items-center gap-1.5 font-medium font-sans">
              ⚡ Zero data leaks: Runs safely inside your browser memory context.
            </span>
            <button 
              id="raw-cleanse-btn"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-100 hover:shadow-indigo-200/50 transition uppercase tracking-wider cursor-pointer font-sans"
            >
              Perform Cleanse
            </button>
          </div>

          <div id="result-wrapper" style={{ display: "none" }} className="space-y-2 pt-5 border-t border-neutral-100">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">Sanitized Output Result</span>
              <button 
                id="copy-text-btn"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-550 transition flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded font-sans"
              >
                Copy Content
              </button>
            </div>
            <textarea
              id="raw-text-output"
              readOnly
              className="w-full bg-neutral-50 border border-neutral-100 p-4 rounded-xl text-sm font-mono text-neutral-800 outline-none focus:ring-1 focus:ring-indigo-200 transition"
              rows={6}
            />
          </div>
        </section>

        {/* Beautiful CTA section which can optionally link to all tools directory */}
        <section className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl shadow-indigo-100">
          <div className="space-y-1.5 text-center md:text-left font-sans">
            <h3 className="text-lg font-extrabold tracking-tight">Texly पर Try करें — 100% Free</h3>
            <p className="text-xs text-indigo-100 font-medium font-sans">No login, no signup — browser में directly tools use करें।</p>
          </div>
          <a 
            href="https://www.texlyonline.in" 
            className="px-5 py-2.5 bg-white hover:bg-neutral-100 text-indigo-600 font-extrabold text-xs rounded-xl transition shadow-md shrink-0 text-center font-sans"
          >
            🚀 Texly Directory खोलें
          </a>
        </section>

        {/* SEO Rich Key Use Cases Grid */}
        {page.useCases && page.useCases.length > 0 && (
          <section className="space-y-5 bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 font-sans">
            <h3 className="text-lg font-bold text-neutral-900 border-l-4 border-indigo-600 pl-3">Key Use Cases & Workflows</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {page.useCases.map((u, i) => (
                <div key={i} className="bg-neutral-50 border border-neutral-100 p-5 rounded-xl space-y-2">
                  <span className="text-xs font-black text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-full">
                    0{i+1}
                  </span>
                  <h4 className="font-bold text-[15px] text-neutral-900 pt-1">{u.title}</h4>
                  <p className="text-xs md:text-sm text-neutral-600 leading-relaxed font-normal">{u.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Algorithmic Before and After Visual Examples */}
        {page.examples && page.examples.length > 0 && (
          <section className="space-y-4 bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 font-sans">
            <h3 className="text-lg font-bold text-neutral-900 border-l-4 border-indigo-600 pl-3">Algorithmic Conversion Examples</h3>
            <div className="space-y-4">
              {page.examples.map((ex, i) => (
                <div key={i} className="p-4 bg-neutral-50 rounded-xl space-y-3 font-mono text-xs text-neutral-700">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-neutral-400 font-extrabold uppercase select-none block font-mono">Sample Input:</span>
                      <pre className="p-3 bg-white rounded border border-neutral-200 select-all whitespace-pre-wrap font-mono">{ex.input}</pre>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-emerald-600 font-extrabold uppercase select-none block font-mono">Expected Output:</span>
                      <pre className="p-3 bg-emerald-50 text-emerald-850 rounded border border-emerald-200 select-all whitespace-pre-wrap font-mono">{ex.output}</pre>
                    </div>
                  </div>
                  {ex.explanation && (
                    <p className="text-neutral-500 text-[11px] font-sans italic leading-relaxed pt-1.5 border-t border-neutral-200/60">
                      <strong>Process:</strong> {ex.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detailed High-Value Guide Article (800-1000 words to prevent thin content) */}
        {page.detailedContent && page.detailedContent.length > 0 && (
          <section className="space-y-6 bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 font-sans">
            <h3 className="text-lg font-bold text-neutral-900 border-l-4 border-indigo-600 pl-3">In-Depth Guide & Technical Reference</h3>
            <div className="space-y-6">
              {page.detailedContent.map((section, idx) => (
                <div key={idx} className="space-y-3">
                  <h4 className="text-base md:text-lg font-extrabold text-neutral-900">{section.heading}</h4>
                  <div className="text-[14px] md:text-[15px] text-neutral-700 leading-relaxed space-y-3.5 font-normal font-sans">
                    {section.paragraphs.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Interactive FAQ Accordion */}
        {page.faqList && page.faqList.length > 0 && (
          <section className="space-y-5 bg-white p-6 md:p-8 rounded-2xl border border-neutral-200 font-sans">
            <h3 className="text-lg font-bold text-neutral-900 border-l-4 border-indigo-600 pl-3">Frequently Asked Questions</h3>
            <div className="space-y-3">
              {page.faqList.map((faq, i) => (
                <details key={i} className="bg-neutral-50 hover:bg-neutral-100/30 border border-neutral-200 p-4 rounded-xl group cursor-pointer transition">
                  <summary className="font-bold text-sm md:text-[15px] text-neutral-800 list-none flex justify-between items-center select-none font-sans">
                    <span>{faq.question}</span>
                    <span className="text-xs text-neutral-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <p className="text-xs md:text-sm text-neutral-600 leading-relaxed mt-3 pl-3 border-l-2 border-indigo-500 font-sans font-normal">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Internal Linking matrix widget */}
        <footer className="pt-8 border-t border-neutral-200 text-xs text-neutral-500 text-center space-y-4 font-sans">
          <p className="font-medium text-neutral-400 font-sans">Looking for similar high-performance text cleansers? Check out these companion utilities:</p>
          <div className="flex gap-2.5 justify-center flex-wrap">
            {page.relatedTools?.map((rel) => {
              const route = getRoutePath(rel);
              return (
                <a 
                  key={rel} 
                  href={route} 
                  className="bg-white hover:bg-neutral-100 text-neutral-700 hover:text-indigo-600 px-3.5 py-2 rounded-xl border border-neutral-200 hover:border-indigo-200 font-mono transition text-xs shadow-sm hover:shadow-md"
                >
                  {route}
                </a>
              );
            })}
          </div>
        </footer>
      </main>

      {/* Comprehensive dynamic browser cleaner code script block */}
      <Script id="browser-cleaner-script" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: \`
        document.addEventListener("DOMContentLoaded", () => {
          const input = document.getElementById("raw-text-input");
          const charCounter = document.getElementById("char-count");
          const output = document.getElementById("raw-text-output");
          const btn = document.getElementById("raw-cleanse-btn");
          const wrapper = document.getElementById("result-wrapper");
          const copyBtn = document.getElementById("copy-text-btn");
          const slug = "\${slug}".toLowerCase();

          // Listen to text changes for dynamic char counters
          if (input && charCounter) {
            input.addEventListener("input", () => {
              charCounter.textContent = input.value.length + " Chars";
            });
          }

          if (btn && input) {
            btn.addEventListener("click", () => {
              let text = input.value;
              if (!text) return;

              // 1. Dynamic AI SEO Parser algorithm
              if (slug.includes("whitespace") || slug.includes("spaces") || slug.includes("blank")) {
                text = text.replace(/\\\\s+/g, " ").trim();
              } else if (slug.includes("emoji") || slug.includes("emotions")) {
                const emojiRegex = /[\\\\u{1F600}-\\\\u{1F64F}\\\\u{1F300}-\\\\u{1F5FF}\\\\u{1F680}-\\\\u{1F6FF}\\\\u{1F1E0}-\\\\u{1F1FF}\\\\u{2700}-\\\\u{27BF}\\\\u{1F900}-\\\\u{1F9FF}\\\\u{2600}-\\\\u{26FF}\\\\u{1F1E6}-\\\\u{1F1FF}]/gu;
                text = text.replace(emojiRegex, "").replace(/ {2,}/g, " ").trim();
              } else if (slug.includes("symbol") || slug.includes("character") || slug.includes("special")) {
                text = text.replace(/[^a-zA-Z0-9\\\\s.,!?''""]/g, "").replace(/ {2,}/g, " ").trim();
              } else if (slug.includes("lower") || slug.includes("case-converter")) {
                text = text.toLowerCase();
              } else if (slug.includes("upper")) {
                text = text.toUpperCase();
              } else if (slug.includes("html") || slug.includes("tag") || slug.includes("strip-html")) {
                text = text.replace(/<[^>]*>/g, "").trim();
              } else if (slug.includes("base64") && slug.includes("encode")) {
                try { text = btoa(text); } catch(ex) {}
              } else if (slug.includes("base64") && slug.includes("decode")) {
                try { text = atob(text); } catch(ex) {}
              } else if (slug.includes("url") && slug.includes("encode")) {
                text = encodeURIComponent(text);
              } else if (slug.includes("url") && slug.includes("decode")) {
                try { text = decodeURIComponent(text); } catch(ex) {}
              } else if (slug.includes("reverse")) {
                text = text.split("").reverse().join("");
              } else if (slug.includes("count") || slug.includes("word")) {
                const words = text.trim() ? text.trim().split(/\\\\s+/).length : 0;
                const chars = text.length;
                const lines = text.split("\\\\n").length;
                text = "Words: " + words + "\\\\nCharacters: " + chars + "\\\\nLines: " + lines;
              } else {
                // Generically convert it to clean standard space formatting as fallback
                text = text.replace(/\\\\s+/g, " ").trim();
              }

              if (output && wrapper) {
                output.value = text;
                wrapper.style.display = "block";
              }
            });
          }

          if (copyBtn && output) {
            copyBtn.addEventListener("click", () => {
              navigator.clipboard.writeText(output.value);
              const oldText = copyBtn.textContent;
              copyBtn.textContent = "Copied!";
              setTimeout(() => { copyBtn.textContent = oldText; }, 1200);
            });
          }
        });
      \` }} />
    </article>
  );
}`;

  // Next.js dynamic sitemap generator file content
  const sitemapCode = `/**
 * Next.js Dynamic Sitemap: /app/sitemap.js
 * Automatically aggregates JSON files into sitemap.xml routes for spiders
 */

import fs from "fs";
import path from "path";

export default async function sitemap() {
  const domainUrl = "https://www.texlyonline.in";
  
  // Base core indexes
  const routes = [
    {
      url: domainUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];

  try {
    const dataPath = path.join(process.cwd(), "data", "pages.json");
    if (fs.existsSync(dataPath)) {
      const pages = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      pages.forEach((page) => {
        routes.push({
          url: \`\${domainUrl}/\${page.slug}\`,
          lastModified: new Date(page.updatedAt || new Date()),
          changeFrequency: "daily",
          priority: 0.8,
        });
      });
    }
  } catch (err) {
    console.error("Failed to parse dynamic sitemap routes:", err);
  }

  return routes;
}`;

  // Node standalone cron automated scheduler file content
  const cronWorkerCode = `/**
 * Autonomous Cron Scheduler: cron-worker.js
 * Runs on Render.com or VPS to research, compile, and push updates securely
 */

const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();

// AI Target SEO Panel trigger route configured in env
const BACKEND_API = process.env.SEO_PANEL_URL || "https://ais-pre-x75p5cqrhsb5peyubkwuhx-407213539158.asia-southeast1.run.app";

console.log("--------------------------------------------------");
console.log("Autonomous Programmatic SEO Cron Worker active.");
console.log(\`Target backend: \${BACKEND_API}\`);
console.log("Scheduled: Every 8 Hours (0 */8 * * *)");
console.log("--------------------------------------------------");

async function runSeoAutopilot() {
  console.log(\`[\${new Date().toISOString()}] Initiating Staggered 8-Hour Autonomous Loop...\`);
  try {
    const response = await axios.post(\`\${BACKEND_API}/api/automation/run\`);
    if (response.data.success) {
      console.log(\`Success. Staggered exactly \${response.data.processedCount} brand new SEO landing node!\`);
      response.data.logs.forEach(l => {
        console.log(\`  - [\${l.step}] \${l.message}\`);
      });
    } else {
      console.warn("Automation process returned dormant status.");
    }
  } catch (err) {
    console.error("Failed to run Autopilot Cron Job loop:", err.message);
  }
}

// 1. Run Autonomous crawl every 8 hours
cron.schedule("0 */8 * * *", () => {
  runSeoAutopilot();
});

// Run immediate check on initialization
setTimeout(() => {
  console.log("Ensuring connectivity. Running initial diagnostic trigger...");
  runSeoAutopilot();
}, 2000);`;

  // Sample pages.json data structure template
  const pagesJsonTemplate = `[
  {
    "slug": "remove-symbols-online",
    "keyword": "remove symbols online",
    "title": "Remove Symbols and Special Characters Online - Text Cleaner | Texly",
    "metaDescription": "Easily clean your text by removing stars, brackets, currency signs, and symbols online.",
    "intro": "Welcome to the ultimate online text cleaner.",
    "faqList": [
      {
        "question": "Is my text safe?",
        "answer": "Yes, all parsing runs purely client-side inside your browser."
      }
    ],
    "useCases": [],
    "examples": [],
    "relatedTools": ["remove-emojis-from-text"],
    "schemaMarkup": {},
    "category": "Text Cleaners",
    "canonicalUrl": "https://www.texlyonline.in/remove-symbols-online",
    "createdAt": "2026-05-18T12:00:00Z",
    "updatedAt": "2026-05-18T12:00:00Z"
  }
]`;

  const getCode = () => {
    switch (activeFile) {
      case "next_page": return nextPageRouteCode;
      case "sitemap": return sitemapCode;
      case "cron_worker": return cronWorkerCode;
      case "pages_json": return pagesJsonTemplate;
    }
  };

  const currentCode = getCode();

  return (
    <div className="space-y-6" id="exporter_tab">
      {/* Introduction Banner code */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-805 rounded-xl p-5 flex items-center gap-4">
        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 shrink-0">
          <Layers size={22} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight">Vercel & Next.js Dynamic Integration Codebase</h2>
          <p className="text-zinc-550 text-xs">
            Copy these functional static generation structures directly into your Next.js directory to build immediate, blazingly fast pages mapped directly from Pages.json.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hand File Navigation list */}
        <div className="lg:col-span-3 bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 space-y-4" id="exporter_file_list">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest px-1">Integrative Files Directory</h3>

          <div className="space-y-1">
            <button
              onClick={() => setActiveFile("next_page")}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                activeFile === "next_page" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <FileCode size={13} />
                app/[slug]/page.jsx
              </span>
              <ChevronRight size={12} className="opacity-40" />
            </button>

            <button
              onClick={() => setActiveFile("sitemap")}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                activeFile === "sitemap" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <FileCode size={13} />
                app/sitemap.js
              </span>
              <ChevronRight size={12} className="opacity-40" />
            </button>

            <button
              onClick={() => setActiveFile("cron_worker")}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                activeFile === "cron_worker" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Terminal size={13} />
                cron-worker.js
              </span>
              <ChevronRight size={12} className="opacity-40" />
            </button>

            <button
              onClick={() => setActiveFile("pages_json")}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-mono transition text-left cursor-pointer ${
                activeFile === "pages_json" 
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold" 
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate">
                <Layers size={13} />
                data/pages.json
              </span>
              <ChevronRight size={12} className="opacity-40" />
            </button>
          </div>

          {/* Quick instructions panel */}
          <div className="bg-zinc-950/40 border border-zinc-800 p-4 rounded-lg space-y-3 pt-4">
            <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Globe size={13} className="text-cyan-400" />
              Dynamic Scaling Plan
            </h4>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              When the AI SEO Panel generates new files, it pushes changes to GitHub. Vercel automatically watches your repository on the <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300 font-mono">main</code> branch, triggers a static rebuild, and serves new static SEO tools safely in seconds!
            </p>
          </div>
        </div>

        {/* Code Output panel on Right Hand side */}
        <div className="lg:col-span-9 bg-zinc-950 border border-zinc-805/85 rounded-xl overflow-hidden flex flex-col h-[525px]" id="exporter_code_panel">
          {/* Header Code toolbar */}
          <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
              <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
              <span className="text-xs font-mono text-zinc-550 ml-2 select-none">
                {activeFile === "next_page" ? "app/[slug]/page.jsx" : activeFile === "sitemap" ? "app/sitemap.js" : activeFile === "cron_worker" ? "cron-worker.js" : "data/pages.json"}
              </span>
            </div>
            
            <button 
              onClick={() => copyCode(currentCode)}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-mono text-xs rounded border border-zinc-700 transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  Copied Output!
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy File Content
                </>
              )}
            </button>
          </div>

          {/* Substantial Code display boxes */}
          <div className="flex-1 overflow-auto p-4 select-text selection:bg-cyan-500/30 font-mono text-xs text-zinc-300 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-800 bg-zinc-950">
            <pre className="whitespace-pre">{currentCode}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
