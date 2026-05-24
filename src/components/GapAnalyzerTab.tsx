/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Sparkles, RefreshCw, AlertTriangle, CheckCircle, BarChart2, Zap, 
  TrendingUp, Globe, CornerDownRight, Check, Play, Terminal, HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import { ToolGap, SEOPage } from "../types";

interface GapAnalyzerTabProps {
  pages: SEOPage[];
  onRefreshPages: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

export default function GapAnalyzerTab({
  pages,
  onRefreshPages,
  getAuthHeaders
}: GapAnalyzerTabProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanSource, setScanSource] = useState("");
  const [gapResults, setGapResults] = useState<ToolGap[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [autoPushToLive, setAutoPushToLive] = useState(true);
  
  // Manual deployment state
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [pushMessage, setPushMessage] = useState("");
  
  // Track generation states individually for each slug
  const [generatingMap, setGeneratingMap] = useState<Record<string, "idle" | "generating" | "deployed" | "failed">>({});
  const [statusMessageMap, setStatusMessageMap] = useState<Record<string, string>>({});

  const scanSteps = [
    "Crawl कर रहे हैं: आपके डेटाबेस में मौजूद सभी टूल्स की लिस्ट को लोड किया जा रहा है...",
    "डेटाबेस विश्लेषण: श्रेणियों (Text Cleaners, Converters, Formatting) का मिलान किया जा रहा है...",
    "सिमेंटिक ऑडिट: मार्केट ट्रेंड्स और हाई-ट्रैफिक की-वर्ड्स के गैप्स को खोजा जा रहा है...",
    "एआई इंजन: जेमिनी मॉडल द्वारा आपके वेबसाइट के लिए 10+ हाई-कनवर्शन टूल्स की सूची तैयार की जा रही है..."
  ];

  const handleManualPush = async () => {
    setIsPushing(true);
    setPushStatus("running");
    setPushMessage("डेटाबेस फाइल्स को पैकेज करके आपके GitHub रिपोजिटरी में अपडेट किया जा रहा है...");

    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        }
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setPushStatus("success");
        setPushMessage(data.message || "सफलतापूर्वक GitHub पर push हो गया और Vercel डिप्लॉयमेंट शुरू हो गया!");
      } else {
        setPushStatus("failed");
        setPushMessage(data.message || "GitHub push फ़ेल हो गया। कृपया सेटिंग्स में क्रेडेंशियल्स की जांच करें।");
      }
    } catch (err: any) {
      setPushStatus("failed");
      setPushMessage(err.message || "सर्वर से कनेक्ट करने में असमर्थ। Network error.");
    } finally {
      setIsPushing(false);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanStep(0);
    setGapResults([]);
    
    // Simulate interactive scan steps to make it highly engaging and visual
    for (let i = 0; i < scanSteps.length; i++) {
      setScanStep(i);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    try {
      const res = await fetch("/api/gap-analyzer/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.gaps) {
          setGapResults(data.gaps);
          setScanSource(data.source || "AI Scanner Engine");
        }
      }
    } catch (err: any) {
      console.error("Gap search operation failed:", err);
    } finally {
      setIsScanning(false);
      setHasScanned(true);
    }
  };

  const handleGenerateAndDeploy = async (gap: ToolGap) => {
    const slug = gap.slug;
    setGeneratingMap(prev => ({ ...prev, [slug]: "generating" }));
    setStatusMessageMap(prev => ({ ...prev, [slug]: "ब्लूप्रिंट जेनरेट हो रहा है..." }));

    try {
      // 1. Trigger generate content API which creates and optionally deploys
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          keyword: gap.keyword,
          slug: gap.slug,
          category: gap.category,
          pushToLive: autoPushToLive
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setGeneratingMap(prev => ({ ...prev, [slug]: "deployed" }));
          setStatusMessageMap(prev => ({ 
            ...prev, 
            [slug]: autoPushToLive 
              ? "सफलतापूर्वक लाइव डिप्लॉय हो गया!" 
              : "सफलतापूर्वक डेटाबेस में सहेजा गया!" 
          }));
          
          // Instantly refresh global state pages
          await onRefreshPages();
        } else {
          setGeneratingMap(prev => ({ ...prev, [slug]: "failed" }));
          setStatusMessageMap(prev => ({ ...prev, [slug]: data.message || "त्रुटि उत्पन्न हुई।" }));
        }
      } else {
        setGeneratingMap(prev => ({ ...prev, [slug]: "failed" }));
        setStatusMessageMap(prev => ({ ...prev, [slug]: "सर्वर कनेक्शन एरर।" }));
      }
    } catch (err: any) {
      setGeneratingMap(prev => ({ ...prev, [slug]: "failed" }));
      setStatusMessageMap(prev => ({ ...prev, [slug]: err.message || "एरर उत्पन्न हुआ।" }));
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "High":
        return "bg-rose-500/10 text-rose-450 border-rose-500/20";
      case "Medium":
        return "bg-amber-500/10 text-amber-450 border-amber-500/20";
      default:
        return "bg-cyan-500/10 text-cyan-450 border-cyan-500/20";
    }
  };

  return (
    <div className="space-y-6" id="gap_analyzer_workspace">
      
      {/* Upper Info Banner with Hinglish Context */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-[#0e0e16] border border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Sparkles size={220} className="text-cyan-400" />
        </div>
        <div className="max-w-3xl space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={13} className="animate-pulse" />
            AI Autonomous Gap Analyzer
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            आपके 100+ टूल्स का एनालिसिस करें एवं नए हाई-ट्रैफिक टूल्स बनाएं
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            यह उन्नत एआई विश्लेषण मॉड्यूल आपकी लाइव वेबसाइट के वर्तमान के सभी उपलब्ध टूल्स की तुलना दुनिया भर के शीर्ष सर्वर-लेस यूटिलिटीज (जैसे स्ट्रिंग मैनिपुलेटर्स, डवलपर्स यूटिलिटीज और एन्कोडर फॉर्मेटर्स) से करता है। यह सिस्टम खोजे गए गैप्स के लिए एकदम नए, हाई-सीटीआर कीवर्ड्स और टूल्स के नाम सुझाता है और आप उन्हें सीधे यहीं से <strong>एक क्लिक में लाइव डिप्लॉय</strong> भी कर सकते हैं!
          </p>
        </div>
      </div>

      {/* Control Actions & Status Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Left/Middle Column: Scan & Prefs Settings */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4 md:col-span-2 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-200">सिस्टम ऑटो-डिप्लॉयमेंट प्रेफरेंस</h3>
                <p className="text-zinc-500 text-xs">क्या आप कीवर्ड ब्लूप्रिंट बनाने के बाद टूल्स को सीधे लाइव डोमेन पर डिप्लॉय करना चाहते?</p>
              </div>
              <div className="flex items-center gap-2 bg-zinc-900 px-4 py-2.5 rounded-lg border border-zinc-850">
                <input 
                  type="checkbox" 
                  id="autoDeployOption"
                  checked={autoPushToLive}
                  onChange={(e) => setAutoPushToLive(e.target.checked)}
                  className="w-4 h-4 text-cyan-500 bg-zinc-950 border-zinc-800 rounded focus:ring-cyan-500/40 focus:ring-2 cursor-pointer"
                />
                <label htmlFor="autoDeployOption" className="text-zinc-300 text-xs font-medium cursor-pointer select-none">
                  ऑटो-डिप्लॉय लाइव करें
                </label>
              </div>
            </div>

            {!autoPushToLive && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-xs text-amber-450 leading-relaxed">
                ℹ️ <strong>लोकल मोड सक्रिय है:</strong> चूंकि ऑटो-डिप्लॉय बंद है, हर नया टूल केवल आपके स्थानीय डेटाबेस में सहेजा जाएगा। बदलावों को लाइव वेबसाइट (www.texlyonline.in) पर ट्रांसफर करने के लिए दाएँ हाथ के पैनल से <strong>"मैनुअल डिप्लॉय (Push to GitHub)"</strong> का उपयोग करें। यह आपकी सर्वर क्षमता और गिटहब लिमिट्स को सुरक्षित रखेगा!
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-zinc-550 flex items-center gap-1.5 font-mono">
              <Globe size={13} className="text-zinc-500" />
              Active Host Codebase
            </div>
            
            <button 
              disabled={isScanning}
              onClick={handleScan}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 disabled:opacity-40 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/20 transition-all uppercase tracking-widest cursor-pointer flex justify-center items-center gap-2 shrink-0 border border-cyan-400/20"
            >
              {isScanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  एनालिसिस चल रहा है...
                </>
              ) : (
                <>
                  <Zap size={14} className="fill-current" />
                  टूल्स के गैप्स को स्कैन करें
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Instant Deploy & Push panel */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 md:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
              <Globe size={15} className="text-indigo-400" />
              मैनुअल पब्लिश & डिप्लॉय
            </h3>
            <p className="text-zinc-500 text-xs leading-relaxed">
              डेटाबेस में सहेजे गए सभी टूल्स को एक साथ लाइव प्रोडक्शन पर कंपाइल करने और Vercel रीबिल्ड ट्रिगर करने के लिए नीचे क्लिक करें:
            </p>
          </div>

          {/* Inline notification state message */}
          {pushStatus !== "idle" && (
            <div className={`p-3 rounded-lg text-xs leading-relaxed border ${
              pushStatus === "running" ? "bg-cyan-500/5 text-cyan-400 border-cyan-500/10" :
              pushStatus === "success" ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10" :
              "bg-rose-500/5 text-rose-400 border-rose-500/10"
            }`}>
              {pushStatus === "running" && <RefreshCw size={13} className="animate-spin inline mr-1.5" />}
              {pushStatus === "success" && <CheckCircle size={13} className="inline mr-1.5" />}
              {pushStatus === "failed" && <AlertTriangle size={13} className="inline mr-1.5" />}
              <span>{pushMessage}</span>
            </div>
          )}

          <button
            disabled={isPushing}
            onClick={handleManualPush}
            className="w-full py-3 bg-zinc-900 hover:bg-indigo-650 disabled:bg-zinc-900/60 hover:text-white text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/50 rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isPushing ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>लाइव पब्लिश हो रहा है...</span>
              </>
            ) : (
              <>
                <Globe size={13} />
                <span>सभी बदलावों को पब्लिश करें</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Simulator Interface */}
      {isScanning && (
        <div className="bg-[#0b0b11] border border-zinc-850 rounded-xl p-6 space-y-4 animate-pulse">
          <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
            <span className="text-xs font-bold text-zinc-400 font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              ROBOTIC SCANNING IN PROGRESS...
            </span>
            <span className="text-[10px] font-mono font-semibold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              Step {scanStep + 1} of 4
            </span>
          </div>

          <div className="space-y-2.5">
            {scanSteps.map((stepText, idx) => {
              const isActive = scanStep === idx;
              const isPast = scanStep > idx;
              return (
                <div 
                  key={idx} 
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition duration-200 ${
                    isActive ? "bg-zinc-900 border border-zinc-800 text-white font-medium" : 
                    isPast ? "text-emerald-500 font-mono" : "text-zinc-600"
                  }`}
                >
                  {isPast ? <Check size={14} /> : <Play size={14} className={isActive ? "animate-pulse text-cyan-400" : "text-zinc-700"} />}
                  <span>{stepText}</span>
                </div>
              );
            })}
          </div>
          
          <div className="pt-2 flex items-center gap-2 text-[10px] text-zinc-600 font-mono">
            <Terminal size={12} />
            <span>sys_analyzer_audit: completed index map chunking on {pages.length} records.</span>
          </div>
        </div>
      )}

      {/* Results Workspace */}
      {hasScanned && !isScanning && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-2">
            <div>
              <span className="text-zinc-400 text-xs font-semibold">
                विश्लेषण का परिणाम: आपके डोमेन के लिए <strong className="text-cyan-400">{gapResults.length}</strong> नए सामरिक गैप (SEO Gaps) मिले हैं:
              </span>
              <p className="text-[10px] text-zinc-550 italic mt-0.5">Scanned source: {scanSource}</p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              *इन सुझावों को सीधे जोड़ने के लिए दाएँ बटन पर क्लिक करें।
            </span>
          </div>

          {gapResults.length === 0 ? (
            <div className="text-center py-16 border border-zinc-850 border-dashed rounded-xl space-y-3">
              <CheckCircle size={32} className="text-emerald-500 mx-auto animate-pulse" />
              <div className="text-zinc-200 font-bold text-sm">Perfect Coverage! कोई नया बुनियादी गैप नहीं मिला।</div>
              <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                आपके पास पहले से ही भरपूर टूल्स मौजूद हैं। आप चाहें तो बाद में भी पुनः विश्लेषण कर नई श्रेणियों के लिए चेक कर सकते हैं।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" id="gap_results_container">
              {gapResults.map((gap, index) => {
                const slugStatus = generatingMap[gap.slug] || "idle";
                const statusMessage = statusMessageMap[gap.slug] || "";

                return (
                  <div 
                    key={index}
                    className="bg-zinc-950 hover:bg-[#0c0c14] border border-zinc-900 hover:border-zinc-800 rounded-xl p-5 transition duration-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 group"
                  >
                    {/* Information Meta details */}
                    <div className="space-y-3.5 flex-1 min-w-0">
                      
                      {/* Badge Row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider bg-zinc-900 border-zinc-800 text-zinc-400">
                          {gap.category}
                        </span>
                        
                        <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getPriorityStyle(gap.priority)}`}>
                          {gap.priority} Priority
                        </span>

                        <span className="px-2.5 py-0.5 rounded-md border text-[10px] font-mono bg-zinc-900 border-zinc-800/80 text-zinc-400 flex items-center gap-1">
                          Diff: <strong className="text-zinc-300">{gap.difficulty}</strong>
                        </span>
                        
                        <span className="px-2.5 py-0.5 rounded-md border text-[10px] font-mono bg-indigo-950/25 border-indigo-900/30 text-indigo-400 flex items-center gap-1">
                          Est Vol: <strong className="text-indigo-300 font-bold">{gap.searchVolumeEstimate.toLocaleString()}/mo</strong>
                        </span>
                      </div>

                      {/* Title & Suggested Details */}
                      <div>
                        <h4 className="text-white font-extrabold group-hover:text-cyan-400 transition tracking-tight text-base flex items-center gap-1.5 flex-wrap">
                          {gap.keyword}
                          <span className="text-zinc-500 font-mono text-xs font-normal">
                            (URL: <strong className="text-zinc-405 font-mono select-all">/{gap.slug}</strong>)
                          </span>
                        </h4>

                        {/* Rationale / Explanation */}
                        <div className="flex items-start gap-1.5 mt-2 bg-zinc-900/40 border border-zinc-900 px-3 py-2.5 rounded-lg">
                          <CornerDownRight size={13} className="text-cyan-400 mt-1 shrink-0" />
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">{gap.reason}</p>
                        </div>
                      </div>

                    </div>

                    {/* Operational Action Block */}
                    <div className="shrink-0 w-full lg:w-auto flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-3 pt-2 lg:pt-0 border-t border-zinc-900/40 lg:border-t-0">
                      
                      {slugStatus === "idle" && (
                        <button 
                          onClick={() => handleGenerateAndDeploy(gap)}
                          className="px-6 py-2.5 bg-zinc-900 hover:bg-cyan-500 hover:text-zinc-950 text-cyan-400 border border-cyan-500/20 hover:border-cyan-400 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Zap size={13} className="fill-current" />
                          <span>बनाएं और लाइव करें</span>
                        </button>
                      )}

                      {slugStatus === "generating" && (
                        <div className="flex flex-col items-end gap-1.5 py-1">
                          <div className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
                            <RefreshCw size={13} className="animate-spin text-cyan-400" />
                            <span>प्रक्रिया जारी है...</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono italic">{statusMessage}</span>
                        </div>
                      )}

                      {slugStatus === "deployed" && (
                        <div className="flex flex-col items-center lg:items-end gap-1 text-emerald-400">
                          <div className="text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-3.5 py-1 border border-emerald-500/20 rounded-lg">
                            <CheckCircle size={14} className="fill-current text-zinc-950" />
                            <span>सफलतापूर्वक डिप्लॉय हो गया ✓</span>
                          </div>
                          <span className="text-[9px] text-zinc-550 font-mono truncate max-w-xs">{statusMessage}</span>
                        </div>
                      )}

                      {slugStatus === "failed" && (
                        <div className="flex flex-col items-end gap-1.5 text-rose-450">
                          <div className="text-xs font-bold flex items-center gap-1.5 font-mono bg-rose-500/10 px-3 py-1.5 border border-rose-500/20 rounded-lg">
                            <AlertTriangle size={13} />
                            <span>FAILED</span>
                          </div>
                          <button 
                            onClick={() => handleGenerateAndDeploy(gap)}
                            className="text-[10px] font-mono text-cyan-400 underline cursor-pointer hover:text-cyan-300"
                          >
                            पुनः प्रयास करें (Retry)
                          </button>
                        </div>
                      )}

                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Static help informational banner */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 flex items-start gap-3.5 text-xs text-zinc-500 font-sans" id="help_notice">
        <HelpCircle size={18} className="text-zinc-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-zinc-400">यह सिस्टम लाइव कैसे काम करता है?</h4>
          <p className="leading-relaxed">
            जब आप <strong>"बनाएं और लाइव करें (Generate & Deploy)"</strong> पर क्लिक करते हैं, तो एआई पाइपलाइन पृष्ठ के संपूर्ण एसईओ संरचना (शीर्षक, विवरण, परिचय, प्रगत उपयोग के मामले, संबंधित टूल्स, मार्कडाउन स्कीमा, और सियो फ्रेंडली एफएक्यू सूची) को जेनिरेट करती है। यदि ऑटो-डिप्लॉय विकल्प सक्रिय है, तो पृष्ठ को सीधे आपके दिए गए GitHub रिपॉजिटरी में जोड़ा जाता है और वर्सेल रीबिल्ड वेबहुक ट्रिगर किया जाता है ताकि बिना किसी कोडिंग के टूल मिनटों में लाइव चालू हो जाए!
          </p>
        </div>
      </div>

    </div>
  );
}
