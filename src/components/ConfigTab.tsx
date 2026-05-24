/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Settings, Save, Check, RefreshCw, AlertTriangle, ShieldCheck, 
  Github, Cloud, Cpu, Sparkles, Database, Search, Shield, Zap, Copy
} from "lucide-react";

interface ConfigState {
  githubRepo: string;
  githubToken: string;
  vercelWebhookUrl: string;
  automatedFrequency: string;
  targetPagesPerDay: number;
  useGroq: boolean;
  groqApiKey: string;
  groqModel: string;
  supabaseUrl?: string; // Optional legacy
  supabaseKey?: string;  // Optional legacy
  openrouterApiKey?: string;
  openrouterModel?: string;
  geminiApiKey?: string;
  adminUsername?: string;
  adminPassword?: string;
}

interface ConfigTabProps {
  initialConfig: ConfigState | null;
  onSaveConfig: (cfg: Partial<ConfigState>) => Promise<boolean>;
  supabaseConnected?: boolean;
  supabaseUrlMasked?: string;
}

export default function ConfigTab({
  initialConfig,
  onSaveConfig,
  supabaseConnected = false,
  supabaseUrlMasked = ""
}: ConfigTabProps) {
  const [githubRepo, setGithubRepo] = useState("");
  const [copiedSql, setCopiedSql] = useState(false);
  const [githubToken, setGithubToken] = useState("");
  const [vercelWebhookUrl, setVercelWebhookUrl] = useState("");
  const [automatedFrequency, setAutomatedFrequency] = useState("24-hours");
  const [targetPagesPerDay, setTargetPagesPerDay] = useState(3);
  const [useGroq, setUseGroq] = useState(false);
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama3-70b-8192");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [adminUsername, setAdminUsername] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("admin123");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");

  // OpenRouter & Dynamic Models State
  const [openrouterApiKey, setOpenrouterApiKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("google/gemini-2.5-flash:free");
  const [openrouterSearch, setOpenrouterSearch] = useState("");
  const [openrouterModels, setOpenrouterModels] = useState<any[]>([]);
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);

  const [groqSearch, setGroqSearch] = useState("");
  const [groqModels, setGroqModels] = useState<any[]>([]);
  const [loadingGroqModels, setLoadingGroqModels] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Database manual cleansing states
  const [sanitizing, setSanitizing] = useState(false);
  const [sanitizeSuccess, setSanitizeSuccess] = useState<boolean | null>(null);
  const [sanitizeMessage, setSanitizeMessage] = useState("");

  const handleSanitize = async () => {
    setSanitizing(true);
    setSanitizeSuccess(null);
    setSanitizeMessage("");
    try {
      const token = localStorage.getItem("texly_admin_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const res = await fetch("/api/database/sanitize", { 
        method: "POST",
        headers
      });
      const data = await res.json();
      if (data.success) {
        setSanitizeSuccess(true);
        setSanitizeMessage(data.message || "सफलतापूर्वक डेटाबेस क्लीन कर दिया गया!");
      } else {
        setSanitizeSuccess(false);
        setSanitizeMessage(data.error || data.message || "सैनिटाइजेशन फेल हो गया।");
      }
    } catch (err: any) {
      setSanitizeSuccess(false);
      setSanitizeMessage("कनेक्शन एरर। सर्वर पर कनेक्टिविटी चेक करें।");
    } finally {
      setSanitizing(false);
    }
  };

  const fetchOpenRouterModels = async () => {
    setLoadingOpenRouterModels(true);
    try {
      const token = localStorage.getItem("texly_admin_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/models/openrouter", { headers });
      const data = await res.json();
      if (data.success && data.models) {
        setOpenrouterModels(data.models);
      }
    } catch (e) {
      console.error("Failed to fetch OpenRouter models:", e);
    } finally {
      setLoadingOpenRouterModels(false);
    }
  };

  const fetchGroqModels = async (keyToUse?: string) => {
    setLoadingGroqModels(true);
    try {
      const token = localStorage.getItem("texly_admin_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const apiKeyVal = keyToUse !== undefined ? keyToUse : groqApiKey;
      const res = await fetch(`/api/models/groq?apiKey=${encodeURIComponent(apiKeyVal)}`, { headers });
      
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }
      
      const data = await res.json();
      if (data.success && data.models) {
        setGroqModels(data.models);
      }
    } catch (e: any) {
      console.warn("Failed to fetch Groq models from local API proxy, using default local presets:", e?.message || e);
      // Clean and safe client-side preset models fallback, avoiding red blocker errors
      setGroqModels([
        { id: "llama3-70b-8192", name: "llama3-70b-8192 (Free Preset)", isFree: true },
        { id: "deepseek-r1-distill-llama-70b", name: "deepseek-r1-distill-llama-70b (Free Distill)", isFree: true },
        { id: "gemma2-9b-it", name: "gemma2-9b-it (Fast Heuristics)", isFree: true },
        { id: "mixtral-8x7b-32768", name: "mixtral-8x7b-32768 (Mixture of Experts)", isFree: true }
      ]);
    } finally {
      setLoadingGroqModels(false);
    }
  };

  useEffect(() => {
    if (initialConfig) {
      setGithubRepo(initialConfig.githubRepo || "");
      setGithubToken(initialConfig.githubToken || "");
      setVercelWebhookUrl(initialConfig.vercelWebhookUrl || "");
      setAutomatedFrequency(initialConfig.automatedFrequency || "24-hours");
      setTargetPagesPerDay(initialConfig.targetPagesPerDay || 3);
      setUseGroq(initialConfig.useGroq || false);
      setGroqApiKey(initialConfig.groqApiKey || "");
      setGroqModel(initialConfig.groqModel || "llama3-70b-8192");
      setOpenrouterApiKey(initialConfig.openrouterApiKey || "");
      setOpenrouterModel(initialConfig.openrouterModel || "google/gemini-2.5-flash:free");
      setGeminiApiKey(initialConfig.geminiApiKey || "");
      setAdminUsername(initialConfig.adminUsername || "admin");
      setAdminPassword(initialConfig.adminPassword || "admin123");
      setSupabaseUrl(initialConfig.supabaseUrl || "");
      setSupabaseKey(initialConfig.supabaseKey || "");

      // Auto load models once on initial config retrieval
      fetchOpenRouterModels();
      fetchGroqModels(initialConfig.groqApiKey || "");
    }
  }, [initialConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const success = await onSaveConfig({
      githubRepo,
      githubToken,
      vercelWebhookUrl,
      automatedFrequency,
      targetPagesPerDay,
      useGroq,
      groqApiKey,
      groqModel,
      openrouterApiKey,
      openrouterModel,
      geminiApiKey,
      adminUsername,
      adminPassword,
      supabaseUrl,
      supabaseKey
    });
    setSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(null as any), 2000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" id="config_tab">
      {/* Visual Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left hand panel inputs */}
        <div className="lg:col-span-8 bg-zinc-900/50 border border-zinc-805 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
              <Settings size={16} className="text-cyan-400" />
              Automated Pipeline Configurator
            </h2>
            <p className="text-zinc-500 text-xs">Establish API parameters, GitHub repositories, and automated growth rates safely.</p>
          </div>

          <div className="space-y-4 pt-2">
            
            {/* Git repositories settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Github size={12} /> Target GitHub Repository
                </label>
                <input 
                  type="text" 
                  value={githubRepo}
                  onChange={(e) => setGithubRepo(e.target.value)}
                  placeholder="Past Your Repostry Link"
                  className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  GitHub Personal Access Token
                </label>
                <input 
                  type="password" 
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40"
                />
              </div>
            </div>

            {/* Vercel deploy hook */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                <Cloud size={12} /> Vercel Deploy Webhook URL
              </label>
              <input 
                type="password" 
                value={vercelWebhookUrl}
                onChange={(e) => setVercelWebhookUrl(e.target.value)}
                placeholder="https://api.vercel.com/v1/integrations/deploy/..."
                className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40 font-mono"
              />
            </div>

            {/* Target pages and rate limits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-zinc-850">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Automated Cycle Frequency</label>
                <select 
                  value={automatedFrequency}
                  onChange={(e) => setAutomatedFrequency(e.target.value)}
                  className="w-full bg-zinc-955 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg text-zinc-400 outline-none hover:text-white cursor-pointer"
                >
                  <option value="24-hours">Every 24 Hours</option>
                  <option value="12-hours">Every 12 Hours</option>
                  <option value="8-hours">Every 8 Hours (1 page at a time)</option>
                  <option value="manual">Manual / Trigger On-Demand</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex justify-between">
                  <span>Target Pages Daily Max</span>
                  <span className="text-amber-400 font-bold font-mono text-[10px]">Safe-Zone Guard</span>
                </label>
                <input 
                  type="number" 
                  min={1} 
                  max={10}
                  value={targetPagesPerDay}
                  onChange={(e) => setTargetPagesPerDay(parseInt(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40 font-mono"
                />
              </div>
            </div>

            {/* Panel Admin Security Credentials */}
            <div className="pt-4 border-t border-zinc-850 space-y-3">
              <div className="flex items-center gap-1.5">
                <Shield size={14} className="text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Control Panel Login Credentials (एडमिन क्रेडेंशियल्स)
                </h4>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed max-w-2xl">
                Configure your control panel access credentials. The panel will block all modifications and read requests until you authenticate.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">
                    Control Username (यूजरनेम)
                  </label>
                  <input 
                    type="text" 
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="e.g. admin"
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">
                    Control Password (पासवर्ड)
                  </label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="e.g. admin123"
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40"
                  />
                </div>
              </div>
            </div>

            {/* Automated AI Failover Pipeline visualizer & Configuration */}
            <div className="pt-5 border-t border-zinc-850 space-y-6">
              
              {/* High-Availability Pipeline Header */}
              <div className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                      <Sparkles size={15} className="text-cyan-400" />
                      सटीक AI Fallback / Reliability Pipeline
                    </h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed max-w-2xl">
                      हमारी प्रणाली 100% उपलब्धता सुनिश्चित करने के लिए ट्रिपल-रिडंडेंसी फेलओवर का उपयोग करती है। यदि प्राथमिक मॉडल विफलता या कोटा थ्रॉटलिंग का सामना करता है, तो अनुरोध स्वचालित रूप से क्रमशः अगले स्तर पर डाइवर्ट हो जाता है।
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 self-start">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 tracking-wider">Pipeline Live</span>
                  </div>
                </div>

                {/* Flow Visualizer Nodes */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className={`p-3 rounded-lg flex items-center gap-3 transition border ${geminiApiKey ? "bg-zinc-900 border-cyan-900/40 text-white hover:border-cyan-500/30" : "bg-zinc-950/40 border-zinc-900/60 text-zinc-500"}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs select-none ${geminiApiKey ? "bg-cyan-950 text-cyan-400" : "bg-zinc-900 text-zinc-650"}`}>1</div>
                    <div>
                      <div className="text-xs font-bold text-white">Gemini (Primary)</div>
                      <div className="text-[10px] text-zinc-400">{geminiApiKey ? "Database Key Active" : "System Env Fallback"}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg flex items-center gap-3 transition border ${groqApiKey ? "bg-zinc-900 border-amber-900/40 text-white hover:border-amber-500/30" : "bg-zinc-950/40 border-zinc-900/60 text-zinc-500"}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs select-none ${groqApiKey ? "bg-amber-950 text-amber-400" : "bg-zinc-900 text-zinc-650"}`}>2</div>
                    <div>
                      <div className="text-xs font-bold">Groq AI (Secondary)</div>
                      <div className="text-[10px] font-mono">{groqApiKey ? `Active: ${groqModel}` : "Config Key Missing"}</div>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg flex items-center gap-3 transition border ${openrouterApiKey ? "bg-zinc-900 border-purple-900/40 text-white hover:border-purple-500/30" : "bg-zinc-950/40 border-zinc-900/60 text-zinc-500"}`}>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs select-none ${openrouterApiKey ? "bg-purple-950 text-purple-400" : "bg-zinc-900 text-zinc-650"}`}>3</div>
                    <div>
                      <div className="text-xs font-bold">OpenRouter (Tertiary)</div>
                      <div className="text-[10px] font-mono">{openrouterApiKey ? `Active: ${openrouterModel}` : "Config Key Missing"}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/40 p-3 rounded-lg border border-zinc-850/50 flex items-center gap-2">
                  <ShieldCheck size={13} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-[10.5px] text-zinc-400">
                    <strong>Supabase Sync Guard:</strong> सभी API keys और मॉडल पसंद स्थानीय रूप से ब्राउज़र में संग्रहीत होने के बजाय आपके सुरक्षित Supabase Cloud Database में सिंक होते हैं। एक बार सेट करने के बाद यह कभी भी दोबारा नहीं मांगेगा!
                  </span>
                </div>
              </div>

               {/* Provider 0: Gemini API Setup */}
              <div className="bg-zinc-900/40 border border-zinc-805 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-cyan-950/60 flex items-center justify-center text-cyan-400">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">Gemini Cloud API Settings (Primary Provider)</h4>
                      <p className="text-[10px] text-zinc-500">Provide a custom Gemini API Key to run high speed content analysis and generation.</p>
                    </div>
                  </div>
                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${geminiApiKey ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-zinc-900 text-zinc-500 border border-zinc-850"}`}>
                      {geminiApiKey ? "Configured" : "Env Fallback"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Gemini API Key</span>
                    <span className="text-[9px] text-zinc-500 lowercase font-normal">(securely synced to your Supabase cloud DB - overrides default system variables)</span>
                  </label>
                  <input 
                    type="password" 
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSyxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/50 font-mono"
                  />
                </div>
              </div>

              {/* Provider 1: Groq AI Setup */}
              <div className="bg-zinc-900/40 border border-zinc-805 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-amber-950/60 flex items-center justify-center text-amber-400">
                      <Cpu size={14} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">Groq Cloud AI Settings</h4>
                      <p className="text-[10px] text-zinc-500">Supercharge secondary failsafe generation via Groq LLaMA models.</p>
                    </div>
                  </div>
                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${groqApiKey ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-zinc-900 text-zinc-500 border border-zinc-850"}`}>
                      {groqApiKey ? "Configured" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Groq API Key</span>
                      <span className="text-[9px] text-zinc-500 lowercase font-normal">(stores securely in Supabase)</span>
                    </label>
                    <input 
                      type="password" 
                      value={groqApiKey}
                      onChange={(e) => {
                        setGroqApiKey(e.target.value);
                        fetchGroqModels(e.target.value);
                      }}
                      onBlur={() => fetchGroqModels(groqApiKey)}
                      placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2 rounded-lg outline-none text-zinc-300 focus:border-amber-500/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Selected Groq Model</span>
                      {loadingGroqModels && <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse"><RefreshCw size={10} className="animate-spin" /> Fetching...</span>}
                    </label>
                    <select
                      value={groqModel}
                      onChange={(e) => setGroqModel(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2.5 rounded-lg text-zinc-300 outline-none hover:border-amber-500/50 cursor-pointer font-mono"
                    >
                      <option value="llama3-70b-8192">llama3-70b-8192 (Free Preset)</option>
                      <option value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b (Free Distill)</option>
                      <option value="gemma2-9b-it">gemma2-9b-it (Fast Heuristics)</option>
                      <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (Mixture of Experts)</option>
                      {groqModels.filter(m => !["llama3-70b-8192", "deepseek-r1-distill-llama-70b", "gemma2-9b-it", "mixtral-8x7b-32768"].includes(m.id)).map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Groq Model Browser & Hot-Select Grid */}
                {groqApiKey && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                        <Search size={10} /> Quick Select Dynamic Groq Models
                      </span>
                      <button 
                        type="button" 
                        onClick={() => fetchGroqModels()}
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw size={10} /> Reload Models
                      </button>
                    </div>
                    
                    <div className="bg-zinc-950 border border-zinc-850 p-2.5 rounded-lg">
                      <input 
                        type="text"
                        placeholder="Search Groq model names or architectures..."
                        value={groqSearch}
                        onChange={(e) => setGroqSearch(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-300 outline-none focus:border-amber-500/40 mb-2 font-sans"
                      />
                      <div className="max-h-[140px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1 py-1 custom-scrollbar">
                        {groqModels.length === 0 ? (
                          <div className="col-span-2 text-center py-4 text-xs text-zinc-550">
                            No dynamic models loaded yet. Ensure your Groq key is authentic!
                          </div>
                        ) : (
                          groqModels
                            .filter(m => m.id.toLowerCase().includes(groqSearch.toLowerCase()))
                            .map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setGroqModel(m.id)}
                                className={`flex items-center justify-between text-left px-2 py-1.5 rounded transition font-mono border text-[10.5px] cursor-pointer ${groqModel === m.id ? "bg-amber-500/10 border-amber-500/50 text-amber-300" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850"}`}
                              >
                                <span className="truncate max-w-[170px] font-medium" title={m.id}>{m.id}</span>
                                {groqModel === m.id && <Check size={11} className="text-amber-400 flex-shrink-0" />}
                              </button>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Provider 2: OpenRouter Setup (Featuring Free vs Paid distinct views) */}
              <div className="bg-zinc-900/40 border border-zinc-805 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-850">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-purple-950/60 flex items-center justify-center text-purple-400">
                      <Zap size={14} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">OpenRouter API Settings</h4>
                      <p className="text-[10px] text-zinc-550">Access hundreds of open-weights models and commercial endpoint alternatives instantly.</p>
                    </div>
                  </div>
                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase ${openrouterApiKey ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-zinc-900 text-zinc-500 border border-zinc-850"}`}>
                      {openrouterApiKey ? "Configured" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                      <span>OpenRouter API Key</span>
                      <span className="text-[9px] text-zinc-550 lowercase font-normal">(automatic Supabase sync)</span>
                    </label>
                    <input 
                      type="password" 
                      value={openrouterApiKey}
                      onChange={(e) => setOpenrouterApiKey(e.target.value)}
                      placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx"
                      className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2 rounded-lg outline-none text-zinc-300 focus:border-purple-500/50 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                      <span>Selected OpenRouter Model</span>
                      {loadingOpenRouterModels && <span className="text-[10px] text-purple-400 flex items-center gap-1 animate-pulse"><RefreshCw size={10} className="animate-spin" /> Refreshing...</span>}
                    </label>
                    <input 
                      type="text" 
                      value={openrouterModel}
                      onChange={(e) => setOpenrouterModel(e.target.value)}
                      placeholder="e.g. google/gemini-2.5-flash:free"
                      className="w-full bg-zinc-950 border border-zinc-800 text-sm px-3.5 py-2 rounded-lg outline-none text-zinc-300 focus:border-purple-500/50 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Highly Distinct Free vs Paid Model browser and toggle panels */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Settings size={11} className="text-purple-400" />
                      Dynamic Model Browser (Free vs Paid Categories)
                    </span>
                    <button 
                      type="button" 
                      onClick={() => fetchOpenRouterModels()}
                      className="text-[10.5px] font-semibold text-purple-400 hover:text-purple-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} className={loadingOpenRouterModels ? "animate-spin" : ""} />
                      Live Fetch OpenRouter Catalog
                    </button>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-xl space-y-3">
                    <input 
                      type="text"
                      placeholder="Filter model name, provider, or tier (e.g. 'deepseek', 'free', 'claude')..."
                      value={openrouterSearch}
                      onChange={(e) => setOpenrouterSearch(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 outline-none focus:border-purple-500/40 font-sans"
                    />

                    {/* Divided section grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* FREE tier category panel */}
                      <div className="border border-emerald-950/45 rounded-lg bg-zinc-955/40 p-2.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-emerald-950/60 pb-1.5 px-1">
                          <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Free Web Models
                          </span>
                          <span className="text-[9px] text-zinc-500">Zero Token Cost</span>
                        </div>
                        <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {openrouterModels.filter(m => m.isFree).length === 0 ? (
                            <div className="text-center py-6 text-xs text-zinc-650">
                              Initializing free weights... Click "Live Fetch"
                            </div>
                          ) : (
                            openrouterModels
                              .filter(m => m.isFree && (m.id.toLowerCase().includes(openrouterSearch.toLowerCase()) || m.name.toLowerCase().includes(openrouterSearch.toLowerCase())))
                              .map(m => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => setOpenrouterModel(m.id)}
                                  className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md transition font-mono border text-[10.5px] cursor-pointer ${openrouterModel === m.id ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300" : "bg-zinc-900/60 border-zinc-850/60 text-zinc-400 hover:bg-zinc-850"}`}
                                >
                                  <div className="truncate max-w-[160px]">
                                    <div className="font-bold tracking-tight truncate">{m.name}</div>
                                    <div className="text-[8.5px] text-zinc-550 truncate">{m.id}</div>
                                  </div>
                                  {openrouterModel === m.id ? (
                                    <Check size={11} className="text-emerald-400 flex-shrink-0" />
                                  ) : (
                                    <span className="text-[8px] bg-emerald-950/80 text-emerald-400 uppercase font-bold px-1.5 py-0.5 rounded ml-1 tracking-wider border border-emerald-900/40">Free</span>
                                  )}
                                </button>
                              ))
                          )}
                        </div>
                      </div>

                      {/* PAID tier category panel */}
                      <div className="border border-purple-950/45 rounded-lg bg-zinc-955/40 p-2.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-purple-950/60 pb-1.5 px-1">
                          <span className="text-[10px] uppercase font-mono font-bold text-purple-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            Paid Premium Models
                          </span>
                          <span className="text-[9px] text-zinc-500">Pay Per Millions</span>
                        </div>
                        <div className="max-h-[160px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                          {openrouterModels.filter(m => !m.isFree).length === 0 ? (
                            <div className="text-center py-6 text-xs text-zinc-650">
                              Initializing premium weights... Click "Live Fetch"
                            </div>
                          ) : (
                            openrouterModels
                              .filter(m => !m.isFree && (m.id.toLowerCase().includes(openrouterSearch.toLowerCase()) || m.name.toLowerCase().includes(openrouterSearch.toLowerCase())))
                              .map(m => {
                                const priceStr = m.promptPrice ? `$${(m.promptPrice * 1000000).toFixed(2)}/M` : "Premium";
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setOpenrouterModel(m.id)}
                                    className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md transition font-mono border text-[10.5px] cursor-pointer ${openrouterModel === m.id ? "bg-purple-500/10 border-purple-500/50 text-purple-300" : "bg-zinc-900/60 border-zinc-850/60 text-zinc-400 hover:bg-zinc-850"}`}
                                  >
                                    <div className="truncate max-w-[140px]">
                                      <div className="font-bold tracking-tight truncate">{m.name}</div>
                                      <div className="text-[8.5px] text-zinc-550 truncate">{m.id}</div>
                                    </div>
                                    {openrouterModel === m.id ? (
                                      <Check size={11} className="text-purple-400 flex-shrink-0" />
                                    ) : (
                                      <span className="text-[8px] bg-purple-950/80 text-purple-400 px-1 py-0.5 rounded tracking-wide font-medium ml-1 flex-shrink-0 border border-purple-900/40">{priceStr}</span>
                                    )}
                                  </button>
                                );
                              })
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Supabase Database Settings */}
            <div className="pt-5 border-t border-zinc-850 space-y-4">
              <div className="bg-zinc-950 p-4 rounded-lg border border-cyan-950/50 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                    <Database size={15} className="text-cyan-400 animate-pulse" />
                    Supabase Secure Cloud Sync & Backups
                  </h4>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-sans font-bold flex items-center gap-1 uppercase ${supabaseConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-900 text-zinc-500 border border-zinc-800"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${supabaseConnected ? "bg-emerald-400 animate-ping" : "bg-zinc-550"}`}></span>
                    {supabaseConnected ? "Active & Connected" : "Inactive (Local Store)"}
                  </span>
                </div>
                
                <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                  Prevent data loss during container resets or redeployments! Connecting a secure Cloud database automatically persists your SEO pages, system logs, and general configurations dynamically.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-3 pt-2 border-t border-zinc-900 font-sans">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">
                      Supabase DB URL (कस्टम सुपबेस URL)
                    </label>
                    <input 
                      type="text" 
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400">
                      Supabase DB Key (कस्टम सुपबेस Key)
                    </label>
                    <input 
                      type="password" 
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="e.g. eyJhbGciOiJIUzI1NiIsIn..."
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3.5 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/40 font-mono"
                    />
                  </div>
                </div>

                <div className="bg-cyan-500/5 border border-cyan-500/15 p-3 rounded-lg text-[11px] text-zinc-300 leading-relaxed font-sans space-y-1">
                  <p className="font-semibold text-cyan-400 flex items-center gap-1">
                    🌐 मल्टी-यूजर क्लाउड डेटाबेस (Multi-User Cloud Integration Active)
                  </p>
                  <p className="text-[10px.5] text-zinc-400">
                    आप अपना स्वयं का Supabase URL और Key यहाँ सेव कर सकते हैं। यह जानकारी आपके सुरक्षित यूज़र फ़ोल्डर में सुरक्षित रूप से संरक्षित रहेगी और किसी अन्य यूज़र के साथ साँझा नहीं होगी। यदि आप इनका उपयोग नहीं करते हैं, तो सर्वर के डिफ़ॉल्ट एन्वायरमेंट क्रेडेंशियल्स का उपयोग किया जाएगा।
                  </p>
                </div>
              </div>

              {/* Supabase SQL Instructions */}
              <div className="p-4 bg-zinc-955/65 rounded-lg space-y-3 border border-zinc-805">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <h5 className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">Required SQL Table Setup for Custom DB / पृथक डेटा प्राइवेसी सुरक्षा</h5>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed font-sans">
                  यदि आप अपना खुद का पर्सनल Supabase डेटाबेस कनेक्ट कर रहे हैं, तो नीचे दिए गए SQL को अपने <strong>Supabase SQL Editor</strong> में रन करें। यह आपके सभी लैंडिंग पेजेज (SEO Pages), कॉन्फ़िगरेशन (Configs), सिस्टम मैप्स (Sitemaps) और लॉग्स (Logs) को पूरी तरह से व्यक्तिगत सुरक्षित एन्वायरमेंट में सिंक करेगा।
                </p>
                <div className="bg-[#0b0b11] border border-zinc-850 rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-zinc-900/40 border-b border-zinc-850/60 px-3.5 py-2 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-bold text-zinc-400 font-mono">multi_user_secure_schema.sql</span>
                    <button 
                      type="button"
                      onClick={() => {
                        const code = `-- 1. Safe Isolated Client Storage Table for SEO Pages, configurations, maps and logs
-- हमारे रिज़िलिएंट सिस्टम इंजन द्वारा प्रत्येक यूजर का डेटा पूरी तरह अलग और प्राइवेट रखा जाता है।
CREATE TABLE IF NOT EXISTS texly_storage (
  key TEXT PRIMARY KEY, -- Automativally partitioned (e.g. u:username:pages) for absolute privacy
  data JSONB NOT NULL
);

-- 2. Dedicated secure credentials routing table
CREATE TABLE IF NOT EXISTS texly_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;
                        navigator.clipboard.writeText(code);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2000);
                      }}
                      className="text-zinc-500 hover:text-white transition duration-150 cursor-pointer text-xs flex items-center gap-1 font-mono hover:scale-105"
                    >
                      {copiedSql ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400 text-[9.5px]">Copied! / कॉपी हुआ!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span className="text-[9.5px]">Copy SQL / कोड कॉपी करें</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-3 text-[10px] text-cyan-300 font-mono select-all select-text break-all whitespace-pre overflow-x-auto">
{`-- 1. Safe Isolated Client Storage Table for SEO Pages, configs, maps and logs
-- यह टेबल आपके वैयक्तिकृत पेज, क्रेडेंशियल्स, लॉग्स और मैप्स डेटा को क्लाउड में सहेजती है।
CREATE TABLE IF NOT EXISTS texly_storage (
  key TEXT PRIMARY KEY, -- Encoded as 'u:username:pages' or 'u:username:config' for total multi-user isolation
  data JSONB NOT NULL
);

-- 2. Dedicated secure credentials routing table
CREATE TABLE IF NOT EXISTS texly_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10.5px] text-emerald-400/95 leading-relaxed font-sans">
                  🛡️ <strong>डेटा प्राइवेसी सुरक्षा गारंटी:</strong> इस एप्लिकेशन में "डबल-लेयर पैार्टिशनिंग" (Double-Layer Partitioning) लागू की गई है। यदि दो या दो से अधिक अलग यूजर्स एक ही साझा (shared Master) Supabase का उपयोग करते हैं, तो भी वे एक दूसरे का डेटा किसी भी परिस्थिति में नहीं देख सकते। प्रत्येक रिकॉर्ड के लिए यूनीक कीज़ (जैसे <code>u:username:pages</code>) जनरेट होती हैं।
                </div>
                <p className="text-[10.5px] text-amber-500/90 leading-relaxed font-sans font-medium">
                  ⚠️ <strong>महत्वपूर्ण नोट:</strong> यदि आपके ब्राउज़र में ऑटो-ट्रांसलेट (हिन्दी अनुवाद) चालू है, तो कॉपी करने से पहले उसे बंद (Disable Translation) कर दें। अन्यथा अनुवादक 'IF NOT EXISTS' को बदलकर 'if open not exists' कर देता है जिससे Supabase SQL Editor में सिंटैक्स एरर आ सकता है। केवल शुद्ध इंग्लिश (English) कोड ही रन करें।
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Right hand instruction side information panels */}
        <div className="lg:col-span-4 bg-zinc-900/10 space-y-4" id="config_sidebar">
          
          {/* Safeguard block */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={14} className="text-emerald-400" />
              SEO spam Protection
            </h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Why do we restrict creation speeds to <strong>3 landing pages every 24 hours</strong> by default?
            </p>
            <p className="text-[11px] text-zinc-550 leading-relaxed">
              Google algorithms evaluate indexed densities. Mass generating hundreds of shallow web pages in a day signals artificial generation ("doorway pages"), which can trigger a manual penalty. Slow, controlled index growth of premium, descriptive tools guarantees safe, organic ranking.
            </p>
          </div>

          {/* Core Submit action button */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <button 
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs uppercase tracking-widest font-mono rounded-lg transition disabled:opacity-40 cursor-pointer"
            >
              {saving ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Saving Parameters...
                </>
              ) : saveSuccess ? (
                <>
                  <Check size={13} />
                  Parameters Saved!
                </>
              ) : (
                <>
                  <Save size={13} />
                  Save Configurations
                </>
              )}
            </button>
          </div>

          {/* Direct Dynamic Sanitization Action */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={13} className="text-cyan-400" />
                डेटाबेस सैनिटाइजेशन (Auto-Sanitize)
              </h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                गलत या पुराने related tool links, canonical URLs और schema configuration को Supabase और स्थानीय स्टोर पर ठीक करके सिंक करें।
              </p>
            </div>

            <button
              type="button"
              onClick={handleSanitize}
              disabled={sanitizing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-850 hover:bg-zinc-800 text-cyan-400 hover:text-cyan-300 border border-cyan-500/15 hover:border-cyan-500/40 font-bold text-xs uppercase tracking-widest font-mono rounded-lg transition disabled:opacity-40 cursor-pointer"
            >
              {sanitizing ? (
                <>
                  <RefreshCw size={13} className="animate-spin text-cyan-400" />
                  Cleansing Matrix...
                </>
              ) : (
                <>
                  <RefreshCw size={13} />
                  Run Self-Healing Sync
                </>
              )}
            </button>

            {sanitizeSuccess !== null && (
              <div className={`p-3 rounded-lg text-[11px] leading-relaxed transition ${sanitizeSuccess ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                {sanitizeMessage}
              </div>
            )}
          </div>

        </div>

      </div>
    </form>
  );
}
