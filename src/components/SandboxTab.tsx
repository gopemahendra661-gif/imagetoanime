/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Wrench, Copy, Check, RefreshCw, Sparkles, Code, Layout, Play, Info 
} from "lucide-react";

export default function SandboxTab() {
  const [inputText, setInputText] = useState(
    "Hello World! 🚀🎉 This is messy copied text... with @@ special symbols ##,  lots  of  spaces,  \nand duplicate line here.\nand duplicate line here.\nLet's clean it up! ✨"
  );
  const [outputText, setOutputText] = useState("");
  const [copied, setCopied] = useState(false);

  // States for dynamic cleaner filters
  const [stripSymbols, setStripSymbols] = useState(true);
  const [stripEmojis, setStripEmojis] = useState(false);
  const [stripSpaces, setStripSpaces] = useState(true);
  const [stripDuplicates, setStripDuplicates] = useState(false);
  const [caseMode, setCaseMode] = useState<"none" | "upper" | "lower">("none");
  const [reverseText, setReverseText] = useState(false);

  // Core Processing Routine - Real execution, 100% functional
  const processText = () => {
    let result = inputText;

    // 1. Strip emojis and pictographs (Unicode matching)
    if (stripEmojis) {
      // Strips general emoticons, transport pictographs, and miscellaneous icons
      result = result.replace(/[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{27BF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]/gu, "");
    }

    // 2. Strip symbols and special characters (keeping basic punctuation and alphanumeric characters)
    if (stripSymbols) {
      // Keeps alphanumeric characters, normal letters, standard sentence marks (.,!?), and white spaces
      result = result.replace(/[^a-zA-Z0-9\s.,!?]/g, "");
    }

    // 3. Strip duplicate lines
    if (stripDuplicates) {
      const lines = result.split("\n");
      const uniqueLines = Array.from(new Set(lines));
      result = uniqueLines.join("\n");
    }

    // 4. Strip extra whitespaces and compact lines
    if (stripSpaces) {
      result = result
        .replace(/[ \t]+/g, " ") // simplify multiple whitespaces into a single space
        .replace(/^[ \t]+|[ \t]+$/gm, ""); // strip trailing/leading space per line
    }

    // 5. Apply casing adjustments
    if (caseMode === "upper") {
      result = result.toUpperCase();
    } else if (caseMode === "lower") {
      result = result.toLowerCase();
    }

    // 6. Reverse character blocks
    if (reverseText) {
      result = result.split("").reverse().join("");
    }

    setOutputText(result);
  };

  // Run formatting processing on any input parameter changes
  useEffect(() => {
    processText();
  }, [inputText, stripSymbols, stripEmojis, stripSpaces, stripDuplicates, caseMode, reverseText]);

  const triggerReset = () => {
    setInputText("");
    setOutputText("");
  };

  const loadScrambledDemo = () => {
    setInputText(
      "$$$ Texly Online! $$$ 🌟\n100% FREE Utility Tools 🛠️\nDouble   spaces   abound.\nDouble   spaces   abound.\nContact: support@texlyonline.in !!!"
    );
    setStripSymbols(true);
    setStripEmojis(true);
    setStripSpaces(true);
    setStripDuplicates(true);
    setCaseMode("none");
    setReverseText(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6" id="sandbox_tab">
      {/* Visual Workspace Hero */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-805 rounded-xl p-5 relative overflow-hidden" id="sandbox_header">
        <div className="max-w-2xl space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 roundedbg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
            <Wrench size={10} /> Live Reusable Tool Playground
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Text Cleaner Engine Sandbox</h2>
          <p className="text-zinc-400 text-xs">
            This module represents the exact operational JS engine serving all Texly's client-side cleaning pages. See how toggling configuration sets formats text streams on the fly with sub-millisecond speeds.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Playboard core controllers */}
        <div className="lg:col-span-4 bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 space-y-5 flex flex-col justify-between" id="sandbox_controls">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-805 pb-1.5">Engine Parameter Switches</h3>
            
            {/* Checkbox fields styled beautifully */}
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={stripSymbols}
                  onChange={(e) => setStripSymbols(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-400 focus:ring-emerald-400/20 accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-350 font-medium group-hover:text-white transition">Remove Special Symbols</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={stripEmojis}
                  onChange={(e) => setStripEmojis(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-400 focus:ring-emerald-400/20 accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-350 font-medium group-hover:text-white transition">Remove Expressive Emojis</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={stripSpaces}
                  onChange={(e) => setStripSpaces(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-400 focus:ring-emerald-400/20 accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-350 font-medium group-hover:text-white transition">Collapse Double Spaces</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={stripDuplicates}
                  onChange={(e) => setStripDuplicates(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-400 focus:ring-emerald-400/20 accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-350 group-hover:text-white transition">Strip Duplicate Lines</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={reverseText}
                  onChange={(e) => setReverseText(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-400 focus:ring-emerald-400/20 accent-emerald-400 cursor-pointer"
                />
                <span className="text-xs text-zinc-350 group-hover:text-white transition">Reverse Characters Strip</span>
              </label>
            </div>

            {/* Casing modes */}
            <div className="space-y-1.5 pt-3 border-t border-zinc-800/40">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Character Case Transformations</span>
              <div className="grid grid-cols-3 gap-1 bg-zinc-955 p-1 rounded-lg border border-zinc-805">
                {(["none", "upper", "lower"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCaseMode(mode)}
                    className={`py-1 text-[10px] font-bold font-mono uppercase rounded transition cursor-pointer ${
                      caseMode === mode 
                        ? "bg-emerald-500 text-zinc-950" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {mode === "none" ? "Normal" : mode === "upper" ? "Uppercase" : "Lowercase"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-800/40">
            <button 
              onClick={loadScrambledDemo}
              className="w-full text-xs font-bold font-mono py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Sparkles size={11} /> Load Messy Scrambled Demo
            </button>
            <button 
              onClick={triggerReset}
              className="w-full text-xs text-zinc-500 hover:text-white font-semibold transition"
            >
              Clear Input Text Box
            </button>
          </div>
        </div>

        {/* Text Area Dual Screen */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4" id="sandbox_textarea_grid">
          {/* Input text block */}
          <div className="flex flex-col h-[380px] space-y-1.5">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Paste Messy Raw Text</span>
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste scrambled character snippets here..."
              className="flex-1 bg-zinc-950/80 border border-zinc-800 focus:border-zinc-700 p-3.5 rounded-xl font-mono text-zinc-300 text-xs leading-relaxed outline-none resize-none focus:text-white select-text"
            />
          </div>

          {/* Cleaned text output block */}
          <div className="flex flex-col h-[380px] space-y-1.5 relative">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pristine Refined Output</span>
            <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs leading-relaxed overflow-auto relative select-text" id="sandbox_output_box">
              <pre className="text-emerald-400 break-all whitespace-pre-wrap">{outputText || "No text generated..."}</pre>
            </div>
            
            {/* Copy overlay button */}
            <button 
              onClick={copyToClipboard}
              className="absolute bottom-3.5 right-3.5 p-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-lg transition shadow-xl font-bold flex items-center gap-1 text-xs cursor-pointer"
              title="Copy Cleaned Text Outputs"
            >
              {copied ? (
                <>
                  <Check size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy Output
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Code validation segment */}
      <div className="bg-zinc-900/10 border border-zinc-850 p-4 rounded-xl flex items-start gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
          <Code size={16} />
        </div>
        <div>
          <h4 className="text-xs font-bold text-zinc-300">Stateless Microsecond Core Engine</h4>
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">
            The JS routine above executes natively in milliseconds because it avoids bulky external runtime imports. This prevents Vercel serverless cold-start lags, rendering clean tools to end-users on dynamic static props with maximum speed thresholds.
          </p>
        </div>
      </div>
    </div>
  );
}
