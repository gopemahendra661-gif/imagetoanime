/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sparkles, Copy, Check, Info, ArrowRight, HelpCircle, 
  ChevronDown, MessageSquare, Play, RefreshCw, FileText, Globe
} from "lucide-react";
import { SEOPage } from "../types";

interface PreviewTabProps {
  pages: SEOPage[];
  initialSlug?: string;
  onNavigateToTab?: (tab: "dashboard" | "keyword" | "content" | "sandbox" | "exporter" | "config") => void;
}

export default function PreviewTab({ pages, initialSlug, onNavigateToTab }: PreviewTabProps) {
  // Available pages to preview
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [outputText, setOutputText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Record<number, boolean>>({});

  // Dynamic state based on tool requirements
  const [caseMode, setCaseMode] = useState<"lower" | "upper" | "title" | "sentence">("lower");
  const [whitespaceMode, setWhitespaceMode] = useState<"collapse" | "strip-all" | "trim-lines">("collapse");
  const [keepPunctuation, setKeepPunctuation] = useState<boolean>(true);

  // Set initial selected slug
  useEffect(() => {
    if (initialSlug && pages.some(p => p.slug === initialSlug)) {
      setSelectedSlug(initialSlug);
    } else if (pages.length > 0) {
      setSelectedSlug(pages[0].slug);
    }
  }, [initialSlug, pages]);

  // Load sample input on page change
  const currentPage = pages.find((p) => p.slug === selectedSlug);

  useEffect(() => {
    if (currentPage) {
      if (currentPage.examples && currentPage.examples.length > 0) {
        setInputText(currentPage.examples[0].input || "");
        setOutputText("");
      } else {
        // Fallbacks
        if (selectedSlug === "remove-symbols-online") {
          setInputText("Hello @World!!! Remove #all [$special] characteristics.");
        } else if (selectedSlug === "remove-emojis-from-text") {
          setInputText("Good morning! ☀️ Let's get this bread 🍞. Have a wonderful day! 🎉😊");
        } else if (selectedSlug === "remove-whitespace-online") {
          setInputText("Too   many    redundant      spaces   here.");
        } else if (selectedSlug === "case-converter") {
          setInputText("CONVERT THIS UPPERCASE TEXT INTO A LOWERCASE ONE.");
        } else {
          setInputText("Just write some test text segments here.");
        }
        setOutputText("");
      }
      setExpandedFaqs({});
    }
  }, [selectedSlug, currentPage]);

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText || inputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Perform operational clean/transform
  const handlePerformCleanse = () => {
    if (!selectedSlug) return;
    let result = inputText;

    if (selectedSlug === "remove-symbols-online") {
      if (keepPunctuation) {
        // Keep English alphanumeric, whitespace, and basic sentence punctuation . , ! ? ' "
        result = result.replace(/[^a-zA-Z0-9\s.,!?''""]/g, "");
      } else {
        // Strip everything except basic alphanumeric characters and standard spaces
        result = result.replace(/[^a-zA-Z0-9\s]/g, "");
      }
      // Clean up extra double spaces that might be introduced
      result = result.replace(/ {2,}/g, " ");
    } 
    else if (selectedSlug === "remove-emojis-from-text") {
      // Robust Unicode regex matching emojis, emoticons, and pictographs
      const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;
      result = result.replace(emojiRegex, "");
      result = result.replace(/ {2,}/g, " ");
    } 
    else if (selectedSlug === "remove-whitespace-online") {
      if (whitespaceMode === "collapse") {
        // Collapse multiple consecutive spaces or tabs into a single space
        result = result.replace(/\s+/g, " ").trim();
      } else if (whitespaceMode === "strip-all") {
        // Delete ALL whitespaces, tabs, newlines completely
        result = result.replace(/\s+/g, "");
      } else if (whitespaceMode === "trim-lines") {
        // Trim whitespace from beginning and end of each line
        result = result.split("\n").map(line => line.trim()).filter(line => line !== "").join("\n");
      }
    } 
    else if (selectedSlug === "case-converter") {
      if (caseMode === "lower") {
        result = result.toLowerCase();
      } else if (caseMode === "upper") {
        result = result.toUpperCase();
      } else if (caseMode === "title") {
        result = result.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      } else if (caseMode === "sentence") {
        result = result.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, p1, p2) => p1 + p2.toUpperCase());
      }
    } 
    else {
      // Default offline placeholder: transform to uppercase
      result = result.toUpperCase();
    }

    setOutputText(result);
  };

  if (pages.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center space-y-4" id="preview_empty">
        <FileText size={40} className="mx-auto text-zinc-650" />
        <h3 className="text-white font-bold">No Active SEO Landing Nodes</h3>
        <p className="text-zinc-500 text-xs max-w-md mx-auto">
          Please build, import, or generate at least one dynamic landing page inside the Page Architect or Dashboard Tab before reviewing the system preview.
        </p>
        <button 
          onClick={() => onNavigateToTab?.("content")}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-bold rounded-lg transition"
        >
          Create Dynamic Page Now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="preview_tab">
      
      {/* Target Selector Toolbar */}
      <div className="bg-[#0c0c12] border border-zinc-850 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">Live Workspace Sandbox Engine</label>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded bg-emerald-500 animate-pulse"></span>
            <span className="text-sm font-semibold text-white">Select generated page to test live:</span>
          </div>
        </div>

        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-350 focus:text-white rounded-lg outline-none cursor-pointer"
        >
          {pages.map((p) => (
            <option key={p.slug} value={p.slug}>
              /{p.slug} — {p.category || "Text Tool"}
            </option>
          ))}
        </select>
      </div>

      {currentPage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Visual Render Frame Mimicking www.texlyonline.in */}
          <div className="lg:col-span-8 bg-[#09090e] border border-zinc-850/80 rounded-2xl overflow-hidden shadow-2xl" id="mock_renderer">
            
            {/* Header URL indicator */}
            <div className="bg-[#0f0f15] border-b border-zinc-900 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Globe size={13} className="text-cyan-400" />
                <span className="font-mono text-zinc-400 select-all">https://www.texlyonline.in/{currentPage.slug}</span>
              </div>
              <span className="px-2 py-0.5 bg-cyan-950/40 text-cyan-400/90 text-[10px] font-bold rounded-full tracking-wider uppercase font-mono">
                Live Preview
              </span>
            </div>

            {/* Rendering Area */}
            <div className="p-6 md:p-8 space-y-10 selection:bg-cyan-500/10">
              
              {/* Category & Headline */}
              <div className="space-y-3 text-center">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full">
                  {currentPage.category || "SEO Utility"}
                </span>
                <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white max-w-2xl mx-auto">
                  {currentPage.title.split(" - ")[0]}
                </h1>
                <p className="text-zinc-400 text-xs md:text-sm leading-relaxed max-w-xl mx-auto">
                  {currentPage.intro}
                </p>
              </div>

              {/* LIVE FULLY-INTERACTIVE TOOL CLEANER PANEL */}
              <div className="bg-[#0d0d14] border border-zinc-800 p-5 md:p-6 rounded-xl space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
                  <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles size={13} className="text-cyan-400 animate-pulse" />
                    Browser-Native {currentPage.category || "Text Sanitizer"}
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">100% Client-Side Code</span>
                </div>

                {/* Input Text Box */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                    <span>INPUT STRING</span>
                    <span>Length: {inputText.length} chars</span>
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 p-3.5 rounded-lg text-xs font-mono focus:border-cyan-500/50 outline-none text-zinc-250 placeholder-zinc-650"
                    rows={5}
                    placeholder="Provide messy unicode strings to clean..."
                  />
                </div>

                {/* Slug-Specific Reactive Configuration Options */}
                {selectedSlug === "remove-symbols-online" && (
                  <div className="flex items-center gap-4 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-900 text-xs">
                    <span className="text-zinc-400 font-mono">Options:</span>
                    <label className="flex items-center gap-2 text-zinc-350 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={keepPunctuation} 
                        onChange={(e) => setKeepPunctuation(e.target.checked)} 
                        className="rounded bg-zinc-900 border-zinc-800 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <span>Keep Sentence Punctuation (.,!?)</span>
                    </label>
                  </div>
                )}

                {selectedSlug === "remove-whitespace-online" && (
                  <div className="flex flex-wrap items-center gap-3 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-900 text-xs text-zinc-350">
                    <span className="text-zinc-400 font-mono">Cleaning Strategy:</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setWhitespaceMode("collapse")}
                        className={`px-2.5 py-1 rounded font-medium transition ${whitespaceMode === "collapse" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        Collapse Spaces
                      </button>
                      <button 
                        onClick={() => setWhitespaceMode("strip-all")}
                        className={`px-2.5 py-1 rounded font-medium transition ${whitespaceMode === "strip-all" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        Strip All Spaces
                      </button>
                      <button 
                        onClick={() => setWhitespaceMode("trim-lines")}
                        className={`px-2.5 py-1 rounded font-medium transition ${whitespaceMode === "trim-lines" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        Trim Lines
                      </button>
                    </div>
                  </div>
                )}

                {selectedSlug === "case-converter" && (
                  <div className="flex flex-wrap items-center gap-3 bg-zinc-950/50 p-2.5 rounded-lg border border-zinc-900 text-xs text-zinc-350">
                    <span className="text-zinc-400 font-mono">Convert Case:</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCaseMode("lower")}
                        className={`px-2.5 py-1 rounded font-medium transition ${caseMode === "lower" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        lowercase
                      </button>
                      <button 
                        onClick={() => setCaseMode("upper")}
                        className={`px-2.5 py-1 rounded font-medium transition ${caseMode === "upper" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        UPPERCASE
                      </button>
                      <button 
                        onClick={() => setCaseMode("title")}
                        className={`px-2.5 py-1 rounded font-medium transition ${caseMode === "title" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        Title Case
                      </button>
                      <button 
                        onClick={() => setCaseMode("sentence")}
                        className={`px-2.5 py-1 rounded font-medium transition ${caseMode === "sentence" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"}`}
                      >
                        Sentence case
                      </button>
                    </div>
                  </div>
                )}

                {/* Form submit/Execution trigger action bar */}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-zinc-500 italic">No network leaks: Runs safely in memory</span>
                  <button 
                    onClick={handlePerformCleanse}
                    className="flex items-center gap-1 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs rounded-lg transition uppercase tracking-wider"
                  >
                    Perform Cleanse
                    <Play size={10} fill="currentColor" className="ml-1" />
                  </button>
                </div>

                {/* Output Text Block */}
                {outputText !== "" && (
                  <div className="space-y-1.5 pt-4 border-t border-zinc-900 animate-pulse-once">
                    <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                      <span>SANIZED OUTPUT CODE</span>
                      <span>Length: {outputText.length} chars</span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={outputText}
                        readOnly
                        className="w-full bg-zinc-950 border border-zinc-850 p-3.5 rounded-lg text-xs font-mono outline-none text-emerald-400"
                        rows={5}
                      />
                      <button 
                        onClick={handleCopy}
                        className="absolute right-3 top-3 p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded transition"
                        title="Copy Cleaned Data"
                      >
                        {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Use cases card deck layout */}
              {currentPage.useCases && currentPage.useCases.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider pl-1.5 border-l-2 border-cyan-500">
                    Utility Applications & Workflows
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {currentPage.useCases.map((useCase, idx) => (
                      <div key={idx} className="bg-[#0c0c12]/50 border border-zinc-850/80 p-4 rounded-xl">
                        <h4 className="font-semibold text-xs text-white">{useCase.title}</h4>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{useCase.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Practical Input Output examples visual aid */}
              {currentPage.examples && currentPage.examples.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider pl-1.5 border-l-2 border-cyan-500">
                    Algorithmic Conversions & Examples
                  </h3>
                  <div className="space-y-2.5">
                    {currentPage.examples.map((ex, idx) => (
                      <div key={idx} className="bg-zinc-950/30 border border-zinc-900 p-3 rounded-lg flex flex-col md:flex-row gap-4 justify-between items-start">
                        <div className="space-y-1.5 flex-1 w-full font-mono text-[11px]">
                          <div className="flex items-center gap-1 text-[9px] text-zinc-550 uppercase">
                            <span className="w-1.5 h-1.5 bg-zinc-650 rounded-full"></span>
                            Sample input
                          </div>
                          <p className="bg-zinc-950 p-2 rounded text-zinc-400 select-all border border-zinc-900/60">{ex.input}</p>
                          
                          <div className="flex items-center gap-1 text-[9px] text-zinc-550 uppercase pt-1">
                            <span className="w-1.5 h-1.5 bg-cyan-650 rounded-full"></span>
                            Resulting Output
                          </div>
                          <p className="bg-zinc-950 p-2 rounded text-emerald-400 font-semibold border border-zinc-900/60 select-all">{ex.output}</p>
                        </div>
                        <div className="md:w-60 text-xs">
                          <p className="text-zinc-350 font-semibold mb-0.5">Explanation:</p>
                          <p className="text-zinc-550 text-[11px] leading-relaxed">{ex.explanation}</p>
                          <button
                            onClick={() => {
                              setInputText(ex.input);
                              setOutputText(ex.output);
                            }}
                            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 mt-2 font-mono"
                          >
                            Load Sample Into Sandbox <ArrowRight size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accordion FAQ panels */}
              {currentPage.faqList && currentPage.faqList.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider pl-1.5 border-l-2 border-cyan-500">
                    Frequently Asked Questions
                  </h3>
                  <div className="space-y-2">
                    {currentPage.faqList.map((faq, idx) => (
                      <div key={idx} className="bg-[#0c0c12]/40 border border-zinc-850 p-3.5 rounded-lg">
                        <button 
                          onClick={() => toggleFaq(idx)}
                          className="w-full flex justify-between items-center text-xs text-zinc-200 font-semibold hover:text-white transition text-left"
                        >
                          <span>{faq.question}</span>
                          <ChevronDown size={14} className={`text-zinc-500 transform transition-transform ${expandedFaqs[idx] ? "rotate-180" : ""}`} />
                        </button>
                        {expandedFaqs[idx] && (
                          <p className="text-[11px] text-zinc-500 mt-2.5 pl-3 border-l border-zinc-800 leading-relaxed">
                            {faq.answer}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Related internal links layout */}
              {currentPage.relatedTools && currentPage.relatedTools.length > 0 && (
                <div className="border-t border-zinc-900/60 pt-6 space-y-2.5 text-center">
                  <p className="text-[11px] text-zinc-550 italic">Looking for similar online utilities? Test companion utilities directly:</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {currentPage.relatedTools.map((rel) => (
                      <button 
                        key={rel} 
                        onClick={() => {
                          if (pages.some(p => p.slug === rel)) {
                            setSelectedSlug(rel);
                          }
                        }}
                        className={`text-[10px] font-mono px-2.5 py-1.5 rounded border transition ${
                          pages.some(p => p.slug === rel) 
                            ? "bg-zinc-900/60 hover:bg-zinc-800 border-zinc-850 text-cyan-400 hover:text-cyan-300" 
                            : "bg-zinc-950/20 border-zinc-950 text-zinc-650 line-through"
                        }`}
                        title={pages.some(p => p.slug === rel) ? "Jump to target preview" : "Not yet generated node"}
                      >
                        /{rel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right Hand Sidebar: Meta-data Inspector & Diagnostics */}
          <div className="lg:col-span-4 space-y-6" id="preview_metadata_inspector">
            
            {/* Meta Tags Checker Card */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
              <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono pb-2 border-b border-zinc-850 flex items-center gap-1.5">
                <Info size={14} className="text-cyan-400" />
                Meta Engine Diagnostics
              </h3>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-zinc-550">
                    <span>GOOGLE TITLE TAG</span>
                    <span className={currentPage.title.length > 60 ? "text-amber-400" : "text-emerald-400 font-semibold"}>
                      {currentPage.title.length} / 60
                    </span>
                  </div>
                  <p className="bg-zinc-950 p-2.5 rounded font-medium border border-zinc-900 select-all text-zinc-300 leading-relaxed">
                    {currentPage.title}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-mono text-[10px] text-zinc-550">
                    <span>GOOGLE META DESCRIPTION</span>
                    <span className={currentPage.metaDescription.length > 160 ? "text-amber-400" : "text-emerald-400 font-semibold"}>
                      {currentPage.metaDescription.length} / 160
                    </span>
                  </div>
                  <p className="bg-zinc-950 p-2.5 rounded text-zinc-400 leading-relaxed border border-zinc-900 select-all">
                    {currentPage.metaDescription}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
                    <span className="text-zinc-600 block text-[9px] uppercase">Slug Category</span>
                    <span className="text-white font-medium">{currentPage.category || "General"}</span>
                  </div>
                  <div className="bg-zinc-950 p-2 rounded border border-zinc-900">
                    <span className="text-zinc-600 block text-[9px] uppercase">Target Keyword</span>
                    <span className="text-emerald-400 font-medium truncate shrink-0 block">"{currentPage.keyword}"</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Social Media Assets Inspector */}
            {currentPage.socialMediaScripts && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono pb-2 border-b border-zinc-850 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-cyan-400" />
                  Social Captain Scripts
                </h3>

                <div className="space-y-3.5 text-xs">
                  {currentPage.socialMediaScripts.pinterestDescription && (
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-zinc-550 uppercase">Pinterest Rich Title</span>
                      <p className="bg-zinc-950 p-2.5 rounded text-zinc-400 border border-zinc-900/80 leading-relaxed">
                        {currentPage.socialMediaScripts.pinterestDescription}
                      </p>
                    </div>
                  )}

                  {currentPage.socialMediaScripts.reelCaption && (
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-zinc-550 uppercase">IG / Shorts Reel Audio Hook</span>
                      <p className="bg-zinc-950 p-2.5 rounded text-zinc-400 border border-zinc-900/80 leading-relaxed">
                        {currentPage.socialMediaScripts.reelCaption}
                      </p>
                    </div>
                  )}

                  {currentPage.socialMediaScripts.shortsScript && (
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] text-zinc-550 uppercase">Youtube Shorts Audio Script (15s)</span>
                      <p className="bg-zinc-950 p-2.5 rounded text-zinc-400 border border-zinc-900/80 leading-relaxed">
                        {currentPage.socialMediaScripts.shortsScript}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Schema Markup Checker Card */}
            {currentPage.schemaMarkup && (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
                <h3 className="text-white text-xs font-bold uppercase tracking-wider font-mono pb-2 border-b border-zinc-850 flex items-center gap-1.5">
                  <FileText size={14} className="text-emerald-400" />
                  Google Rich JSON-LD Markup
                </h3>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-900 font-mono text-[10px] text-zinc-400 overflow-x-auto max-h-40 select-all">
                  <pre>{JSON.stringify(currentPage.schemaMarkup, null, 2)}</pre>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
