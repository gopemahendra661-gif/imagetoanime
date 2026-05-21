/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Compass, ChevronRight, BarChart2, TrendingUp, CheckCircle, 
  HelpCircle, Sparkles, Wand2, RefreshCw 
} from "lucide-react";
import { KeywordResult } from "../types";

interface KeywordTabProps {
  onSearch: (seed: string) => Promise<KeywordResult[]>;
  onGenerateFromKeyword: (keyword: string, slug: string, category: string) => Promise<void>;
  isGeneratingMap: Record<string, boolean>;
}

export default function KeywordTab({
  onSearch,
  onGenerateFromKeyword,
  isGeneratingMap
}: KeywordTabProps) {
  const [seed, setSeed] = useState("");
  const [results, setResults] = useState<KeywordResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [source, setSource] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seed.trim()) return;
    setIsSearching(true);
    try {
      const data = await onSearch(seed);
      setResults(data);
      // Determine source based on active mock logic
      setSource(results.length > 0 ? "AI System" : "Programmatic SEO Core");
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const getDifficultyColor = (score: number) => {
    if (score < 30) return { bg: "bg-emerald-500/15", text: "text-emerald-400 border-emerald-500/20", label: "Low Competition" };
    if (score < 60) return { bg: "bg-amber-500/15", text: "text-amber-400 border-amber-500/20", label: "Medium Competition" };
    return { bg: "bg-red-500/15", text: "text-red-400 border-red-500/20", label: "High Competition" };
  };

  return (
    <div className="space-y-6" id="keyword_tab">
      {/* Informative Header card */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none">
          <Compass size={180} />
        </div>
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={12} />
            Programmatic Research Engine
          </div>
          <h2 className="text-xl font-bold text-white">Identify High-Traffic Low-Competition Gaps</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Specify a root utility keyword (e.g. <span className="text-zinc-300 font-mono">strip symbols</span>). The AI crawls similar tools, checks semantic keyword difficulty indexes, classifies intent structures, and lists potential long-tail targets ready to deploy.
          </p>
        </div>
      </div>

      {/* Input Core Form */}
      <form onSubmit={handleSearch} className="flex gap-2.5 bg-zinc-900/40 border border-zinc-800 p-3 rounded-lg" id="keyword_search_form">
        <input 
          type="text" 
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter tool seed keyword (e.g. convert unicode characters, format json, clean strings)..."
          className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-cyan-500/40 text-sm px-4 py-2.5 rounded-lg text-zinc-300 outline-none placeholder-zinc-500"
        />
        <button 
          disabled={isSearching}
          className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-600/50 text-zinc-950 font-bold text-sm rounded-lg transition flex items-center gap-1.5 shrink-0 uppercase tracking-widest font-mono cursor-pointer"
        >
          {isSearching ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Crawling...
            </>
          ) : (
            <>
              <Compass size={14} />
              Research Gaps
            </>
          )}
        </button>
      </form>

      {/* Keyword Output Grid */}
      <div className="space-y-4">
        {results.length > 0 && (
          <div className="flex justify-between items-center px-1">
            <span className="text-zinc-500 text-xs font-medium">
              Analytic Output: found <strong className="text-zinc-300">{results.length}</strong> strategic tool gaps
            </span>
            <span className="text-[10px] uppercase tracking-wider font-mono text-cyan-400 font-semibold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              Live Semantic Analysis
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isSearching ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-zinc-900/30 border border-zinc-800/60 rounded-xl p-5 animate-pulse space-y-3">
                <div className="h-4 bg-zinc-800 rounded w-1/2"></div>
                <div className="h-3 bg-zinc-800 rounded w-3/4"></div>
                <div className="h-10 bg-zinc-800 rounded"></div>
              </div>
            ))
          ) : results.length === 0 ? (
            <div className="md:col-span-2 text-center py-16 border border-zinc-800 border-dashed rounded-xl space-y-3">
              <Compass size={36} className="text-zinc-600 mx-auto animate-pulse" />
              <div className="text-zinc-400 font-medium">Search Gaps Is Empty</div>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                Type a tool idea above to generate high-intent low competition long-tail clusters! Try: <span className="font-mono text-zinc-400 select-all">strip characters</span>
              </p>
            </div>
          ) : (
            results.map((item, index) => {
              const diffProps = getDifficultyColor(item.difficulty);
              const generating = isGeneratingMap[item.slug] || false;

              return (
                <div 
                  key={index} 
                  className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 space-y-4 flex flex-col justify-between hover:border-zinc-700/60 transition group"
                >
                  <div className="space-y-3">
                    {/* Header: Keyword and Difficulty */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="text-base font-bold text-white select-all group-hover:text-cyan-400 transition">
                          {item.keyword}
                        </h3>
                        <p className="text-zinc-500 text-xs font-mono">slug: /{item.slug}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded border text-[10px] font-bold ${diffProps.bg} ${diffProps.text} shrink-0`}>
                        {diffProps.label} ({item.difficulty})
                      </span>
                    </div>

                    {/* Meta stats bar */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-zinc-800/40 text-[11px] font-mono text-zinc-400 text-center">
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase">Est. Volume</div>
                        <div className="text-zinc-200 mt-0.5 font-bold flex items-center justify-center gap-1">
                          <BarChart2 size={11} className="text-zinc-500" />
                          {item.searchVolumeEstimate.toLocaleString()} / mo
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase">Intent</div>
                        <div className="text-cyan-400 mt-0.5 font-bold capitalize">
                          {item.intent}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase">Category</div>
                        <div className="text-zinc-300 mt-0.5 font-semibold truncate px-1">
                          {item.category}
                        </div>
                      </div>
                    </div>

                    {/* Related LSI Long tails */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] uppercase font-semibold text-zinc-500 flex items-center gap-0.5">
                        <TrendingUp size={10} /> Secondary Queries (LSI)
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {item.relatedLongTails.map((t, idx) => (
                          <span 
                            key={idx}
                            className="bg-zinc-800/30 text-zinc-400 text-[10px] px-2 py-0.5 rounded border border-zinc-800 font-mono hover:text-white transition"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Immediate Deploy Actions */}
                  <button 
                    disabled={generating}
                    onClick={() => onGenerateFromKeyword(item.keyword, item.slug, item.category)}
                    className="w-full mt-4 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-800 hover:bg-cyan-500 text-zinc-300 hover:text-zinc-950 font-bold font-mono text-xs rounded-lg border border-zinc-700 hover:border-cyan-500 transition group-hover:scale-[1.01] cursor-pointer"
                  >
                    {generating ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        Generating Node Content...
                      </>
                    ) : (
                      <>
                        <Wand2 size={12} />
                        Auto-Build Landing Page
                        <ChevronRight size={12} className="opacity-60" />
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
