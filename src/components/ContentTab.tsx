/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Wand2, Save, FileCheck, Copy, Check, Info, AlertCircle, 
  HelpCircle, Sparkles, BookOpen, Share2, Clipboard, Chrome 
} from "lucide-react";
import { SEOPage } from "../types";

interface ContentTabProps {
  onGenerate: (keyword: string, slug: string, category: string) => Promise<SEOPage | null>;
  isGenerating: boolean;
}

export default function ContentTab({
  onGenerate,
  isGenerating
}: ContentTabProps) {
  const [keyword, setKeyword] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("Text Cleaners");
  const [generatedPage, setGeneratedPage] = useState<SEOPage | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Auto-derived slug on keyword change
  const handleKeywordChange = (val: string) => {
    setKeyword(val);
    const derived = val
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // convert spaces/special characters to dashes
      .replace(/^-+|-+$/g, ""); // strip leading/trailing dashes
    setSlug(derived);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !slug.trim()) return;
    const page = await onGenerate(keyword, slug, category);
    if (page) {
      setGeneratedPage(page);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="space-y-6" id="content_tab">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Creation Input Configurator Panel */}
        <div className="lg:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 self-start space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
              <Wand2 size={16} className="text-cyan-400" />
              SEO Node Architect
            </h2>
            <p className="text-zinc-500 text-xs mt-0.5">Define target keywords and instruct AI to compile structural contents.</p>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Target Phrase</label>
              <input 
                type="text" 
                value={keyword}
                onChange={(e) => handleKeywordChange(e.target.value)}
                placeholder="e.g. remove spaces online"
                className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none focus:border-cyan-500/40 text-zinc-300"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between">
                <span>URL Slug (URL Route)</span>
                <span className="text-[10px] text-zinc-500 font-mono normal-case">Derived</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-zinc-600 text-sm">/</span>
                <input 
                  type="text" 
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="remove-spaces-online"
                  className="w-full bg-zinc-950 border border-zinc-800 text-sm pl-7 pr-3.5 py-2.5 rounded-lg outline-none focus:border-cyan-500/40 text-zinc-350 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-400 focus:text-white cursor-pointer"
              >
                <option value="Text Cleaners">Text Cleaners</option>
                <option value="Formatting Tools">Formatting Tools</option>
                <option value="Developer Utilities">Developer Utilities</option>
                <option value="Database Sanitizers">Database Sanitizers</option>
              </select>
            </div>

            <button 
              disabled={isGenerating || !keyword.trim() || !slug.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold rounded-lg transition disabled:opacity-40 select-none uppercase tracking-widest font-mono text-xs cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Wand2 size={13} className="animate-spin" />
                  Generating Content...
                </>
              ) : (
                <>
                  <Wand2 size={14} />
                  Compile Node Content
                </>
              )}
            </button>
          </form>

          {/* Guidelines info card */}
          <div className="bg-zinc-950/40 border border-zinc-800/60 p-4 rounded-lg space-y-3">
            <h4 className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
              <Info size={13} className="text-cyan-400" />
              Content Quality Safeguards
            </h4>
            <ul className="text-[11px] text-zinc-500 space-y-2 list-disc pl-3">
              <li>Human-sounding introductory descriptions avoiding boring AI structural cliches.</li>
              <li>Calculates automated WebApplication & FAQ Rich Schemas instantly.</li>
              <li>Appends structured internal links to maximize spiders crawlability map.</li>
              <li>Includes curated Pinterest, Reel, and Shorts promotional copy sets.</li>
            </ul>
          </div>
        </div>

        {/* Generated Structured Outputs View Area */}
        <div className="lg:col-span-8 space-y-6" id="generated_details_workspace">
          {isGenerating ? (
            <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-16 text-center space-y-4 animate-pulse">
              <Sparkles size={40} className="text-cyan-400/80 mx-auto animate-spin" />
              <div className="space-y-1">
                <h3 className="text-white font-bold">Assembling Dynamic SEO Blueprint</h3>
                <p className="text-zinc-500 text-xs">Querying AI model, structuring HTML-LD variables, generating FAQs</p>
              </div>
              <div className="w-48 bg-zinc-855 h-1.5 rounded-full mx-auto overflow-hidden">
                <div className="bg-cyan-400 h-full animate-bar-slide w-1/3"></div>
              </div>
            </div>
          ) : !generatedPage ? (
            <div className="bg-zinc-900/10 border border-zinc-800 border-dashed rounded-xl p-16 text-center space-y-3">
              <BookOpen size={40} className="text-zinc-700 mx-auto" />
              <h3 className="text-zinc-400 font-semibold text-base">SEO Content Canvas</h3>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                No active document targets selected. Set your keyword parameters on the left and select "Compile Node Content" to view full SEO components!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Meta header confirmation */}
              <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                <div className="flex items-center gap-2 text-emerald-400">
                  <FileCheck size={20} />
                  <span className="text-sm font-semibold">Ready to Index on texlyonline.in</span>
                </div>
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded uppercase font-semibold border border-emerald-500/20">
                  Node Persisted
                </span>
              </div>

              {/* Essential Metadata Blocks */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white tracking-tight border-b border-zinc-800 pb-2">Primary Page Meta</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500 font-semibold">
                      <span>SEO TITLE</span>
                      <span className="font-mono text-[10px] text-zinc-600">{generatedPage.title.length} chars</span>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded font-mono text-xs text-zinc-350 select-all flex justify-between items-center">
                      <span className="truncate pr-4">{generatedPage.title}</span>
                      <button onClick={() => copyToClipboard(generatedPage.title, "title")} className="text-zinc-500 hover:text-white shrink-0">
                        {copiedField === "title" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-500 font-semibold">
                      <span>CANONICAL LINK</span>
                      <span className="font-mono text-[10px] text-zinc-600">Route</span>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded font-mono text-xs text-zinc-350 select-all flex justify-between items-center">
                      <span className="truncate pr-4">{generatedPage.canonicalUrl}</span>
                      <button onClick={() => copyToClipboard(generatedPage.canonicalUrl, "canonical")} className="text-zinc-500 hover:text-white shrink-0">
                        {copiedField === "canonical" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-xs text-zinc-500 font-semibold">
                    <span>META DESCRIPTION</span>
                    <span className="font-mono text-[10px] text-zinc-600">{generatedPage.metaDescription.length} chars</span>
                  </div>
                  <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded text-xs text-zinc-350 select-all flex justify-between items-start gap-4">
                    <p className="leading-relaxed">{generatedPage.metaDescription}</p>
                    <button onClick={() => copyToClipboard(generatedPage.metaDescription, "metaDesc")} className="text-zinc-500 hover:text-white shrink-0 pt-0.5">
                      {copiedField === "metaDesc" ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1 mt-2">
                  <span className="text-xs text-zinc-500 font-semibold uppercase">Human Intro Copy Segment</span>
                  <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded text-xs text-zinc-300 leading-relaxed italic">
                    "{generatedPage.intro}"
                  </div>
                </div>
              </div>

              {/* Dynamic Schemas and accordion items */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Use Cases Grid */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white tracking-tight border-b border-zinc-805 pb-1.5 uppercase tracking-wider text-xs text-zinc-400">Practical Use Cases</h4>
                  <div className="space-y-3">
                    {generatedPage.useCases.map((u, i) => (
                      <div key={i} className="bg-zinc-950 border border-zinc-800/60 p-2.5 rounded">
                        <div className="font-semibold text-xs text-zinc-200">{u.title}</div>
                        <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{u.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example cases pattern */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <h4 className="text-sm font-bold text-white tracking-tight border-b border-zinc-805 pb-1.5 uppercase tracking-wider text-xs text-zinc-400">Algorithmic Input / Output patterns</h4>
                  <div className="space-y-3">
                    {generatedPage.examples.map((ex, i) => (
                      <div key={i} className="bg-zinc-950 border border-zinc-800/60 p-3 rounded font-mono text-[11px] space-y-1.5">
                        <div className="grid grid-cols-2 gap-2 border-b border-zinc-900 pb-1.5">
                          <div>
                            <span className="text-[10px] text-zinc-600 block uppercase">Input</span>
                            <span className="text-amber-500 select-all">{ex.input}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-zinc-600 block uppercase">Output</span>
                            <span className="text-emerald-400 select-all">{ex.output}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-500 leading-relaxed italic pr-2 font-sans">
                          {ex.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Web FAQs Panel */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                <h3 className="text-base font-bold text-white tracking-tight border-b border-zinc-800 pb-2">Curated Search/FAQ Schema Segment</h3>
                <div className="space-y-3">
                  {generatedPage.faqList.map((faq, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-lg space-y-1.5">
                      <div className="font-semibold text-xs text-white flex items-start gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] inline-flex items-center justify-center font-bold font-mono shrink-0 mt-0.5">Q</span>
                        <h3>{faq.question}</h3>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed pl-5">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pinterest & Video Reels Caption generator */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4" id="social_captions_box">
                <h3 className="text-base font-bold text-white tracking-tight border-b border-zinc-800 pb-2 flex items-center gap-1.5">
                  <Share2 size={16} className="text-amber-400" />
                  Social Media Promotion Scripts (AI-Generated Bonus)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Pinterest Description */}
                  <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg flex flex-col justify-between group">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest font-mono">Pinterest Card</span>
                      <p className="text-zinc-400 leading-relaxed italic select-all" id="pin_desc">
                        "{generatedPage.socialMediaScripts?.pinterestDescription || `Need to remove characters automatically? Clean symbols with Texly online! 🚀 #productivity #seo`}"
                      </p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(generatedPage.socialMediaScripts?.pinterestDescription || "", "social_p")}
                      className="mt-4 w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-center text-zinc-400 hover:text-white font-mono flex items-center justify-center gap-1 border border-zinc-800 transition cursor-pointer"
                    >
                      {copiedField === "social_p" ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
                      Copy Pin Description
                    </button>
                  </div>

                  {/* Reel Hook Captions */}
                  <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg flex flex-col justify-between group">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest font-mono">Reel Caption Hooks</span>
                      <p className="text-zinc-400 leading-relaxed italic select-all" id="reel_cap">
                        "{generatedPage.socialMediaScripts?.reelCaption || `Save hours cleaning text outputs! Avoid weird symbols. Try this client side too! 🔗💻`}"
                      </p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(generatedPage.socialMediaScripts?.reelCaption || "", "social_r")}
                      className="mt-4 w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-center text-zinc-400 hover:text-white font-mono flex items-center justify-center gap-1 border border-zinc-800 transition cursor-pointer"
                    >
                      {copiedField === "social_r" ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
                      Copy Reel Caption
                    </button>
                  </div>

                  {/* YouTube Shorts Script */}
                  <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-lg flex flex-col justify-between group">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">YouTube Short Script</span>
                      <p className="text-zinc-400 leading-relaxed italic select-all font-mono text-[11px]" id="shorts_transcript">
                        "{generatedPage.socialMediaScripts?.shortsScript || `Stop manual regex scripting! Drag text into Texly and clean everything.`}"
                      </p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(generatedPage.socialMediaScripts?.shortsScript || "", "social_s")}
                      className="mt-4 w-full py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-center text-zinc-400 hover:text-white font-mono flex items-center justify-center gap-1 border border-zinc-800 transition cursor-pointer"
                    >
                      {copiedField === "social_s" ? <Check size={12} className="text-emerald-400" /> : <Clipboard size={12} />}
                      Copy Video Script
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
