/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Compass, LayoutDashboard, Wand2, Wrench, Settings, Layers, 
  HelpCircle, Sparkles, RefreshCw, Terminal, Globe, ChevronRight, Menu, X, Eye 
} from "lucide-react";

import { SEOPage, AutomationLog, KeywordResult } from "./types";
import DashboardTab from "./components/DashboardTab";
import PreviewTab from "./components/PreviewTab";
import KeywordTab from "./components/KeywordTab";
import ContentTab from "./components/ContentTab";
import SandboxTab from "./components/SandboxTab";
import ExporterTab from "./components/ExporterTab";
import ConfigTab from "./components/ConfigTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "preview" | "keyword" | "content" | "sandbox" | "exporter" | "config">("dashboard");
  const [previewSlug, setPreviewSlug] = useState<string>("");
  const [pages, setPages] = useState<SEOPage[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [isProcessingCron, setIsProcessingCron] = useState(false);
  const [isGeneratingMap, setIsGeneratingMap] = useState<Record<string, boolean>>({});
  const [isCompilingContent, setIsCompilingContent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Secure control panel credential states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginToken, setLoginToken] = useState<string | null>(null);
  const [verifyingAuth, setVerifyingAuth] = useState<boolean>(true);
  const [usernameInput, setUsernameInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Quick logout action
  const handleLogout = () => {
    setIsLoggedIn(false);
    setLoginToken(null);
    localStorage.removeItem("texly_admin_token");
  };

  const getAuthHeaders = (tokenOverride?: string | null) => {
    const token = tokenOverride !== undefined ? tokenOverride : loginToken;
    return token ? { "Authorization": `Bearer ${token}` } : {};
  };

  const handleResponseStatus = (res: Response) => {
    if (res.status === 401) {
      handleLogout();
      return false;
    }
    return true;
  };

  // Verify authentication state with Bearer Token in iframe-compatible format
  const verifyAuthToken = async (token: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/verify-auth", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsLoggedIn(true);
          setLoginToken(token);
          return true;
        }
      }
    } catch (err) {
      console.error("Auth token verification error:", err);
    }
    setIsLoggedIn(false);
    setLoginToken(null);
    localStorage.removeItem("texly_admin_token");
    return false;
  };

  // Login POST action for form submissions
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setLoginError("कृपया अपना यूजरनेम और पासवर्ड दर्ज करें।");
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem("texly_admin_token", data.token);
        setLoginToken(data.token);
        setIsLoggedIn(true);
        setUsernameInput("");
        setPasswordInput("");
      } else {
        setLoginError(data.message || "लॉगिन करने में त्रुटि हुई। क्रेडेंशियल जांचें।");
      }
    } catch (err) {
      setLoginError("सर्वर से संपर्क करने में असमर्थ। कृपया पुनः प्रयास करें।");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Fetch initial dataset on boot
  const fetchPages = async () => {
    try {
      const res = await fetch("/api/pages", {
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setPages(data.pages);
      }
    } catch (err) {
      console.error("Failed to fetch page indices:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs", {
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to fetch log streams:", err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/config", {
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        const serverConfig = data.config || {};
        setConfig(serverConfig);

        // Resilient browser localStorage backup restore
        const LOCAL_STORAGE_KEY = "texly_config_backup";
        const storedStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedStr) {
          try {
            const clientConfig = JSON.parse(storedStr);
            let needsSync = false;
            const mergedConfig = { ...serverConfig };

            const keysToRestore = [
              "githubRepo", "githubToken", "vercelWebhookUrl",
              "supabaseUrl", "supabaseKey", "groqApiKey",
              "groqModel", "openrouterApiKey", "openrouterModel",
              "geminiApiKey", "adminUsername", "adminPassword"
            ];

            // If a key is present in client localStorage but not configured on the server, auto-sync it
            for (const key of keysToRestore) {
              if (clientConfig[key] && !serverConfig[key]) {
                mergedConfig[key] = clientConfig[key];
                needsSync = true;
              }
            }

            // Sync other keys forward from server to local storage too to ensure perfectly consistent data
            for (const key of keysToRestore) {
              if (serverConfig[key] && clientConfig[key] !== serverConfig[key]) {
                clientConfig[key] = serverConfig[key];
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clientConfig));
              }
            }

            if (needsSync) {
              console.log("[Auto-Sync] Restoring configurations from local device cache...");
              const saveRes = await fetch("/api/config/save", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${loginToken}`
                },
                body: JSON.stringify(mergedConfig)
              });
              if (handleResponseStatus(saveRes)) {
                const saveData = await saveRes.json();
                if (saveData.success) {
                  setConfig(saveData.config);
                  console.log("[Auto-Sync] Active backend has successfully restored all secure variables.");
                }
              }
            }
          } catch (storageErr) {
            console.error("Local storage sync error:", storageErr);
          }
        } else if (Object.keys(serverConfig).length > 0) {
          // Guard backup initially
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serverConfig));
        }
      }
    } catch (err) {
      console.error("Failed to fetch setups config:", err);
    }
  };

  // Initialize auth credentials check from client memory
  useEffect(() => {
    const savedToken = localStorage.getItem("texly_admin_token");
    if (savedToken) {
      verifyAuthToken(savedToken).finally(() => {
        setVerifyingAuth(false);
      });
    } else {
      setVerifyingAuth(false);
    }
  }, []);

  // Sync data whenever user logged state is validated
  useEffect(() => {
    if (isLoggedIn && loginToken) {
      fetchPages();
      fetchLogs();
      fetchConfig();
    }
  }, [isLoggedIn, loginToken]);

  // Action: Trigger 24h cron automation loop manually
  const handleRunCron = async () => {
    setIsProcessingCron(true);
    try {
      const res = await fetch("/api/automation/run", { 
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        await fetchPages();
        await fetchLogs();
      }
    } catch (err) {
      console.error("Failed to run Autopilot Cron:", err);
    } finally {
      setIsProcessingCron(false);
    }
  };

  // Action: Delete dynamic node by slug
  const handleDeletePage = async (slug: string) => {
    if (!window.confirm(`Are you sure you want to delete programmatic node /${slug}?`)) return;
    try {
      const res = await fetch(`/api/pages/${slug}`, { 
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        await fetchPages();
        await fetchLogs();
      }
    } catch (err) {
      console.error("Failed to delete page:", err);
    }
  };

  // Action: Clear all logs
  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/logs/clear", { 
        method: "POST",
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      setLogs([]);
    } catch (err) {
      console.error("Failed to clear logs:", err);
    }
  };

  // Action: Save configuration
  const handleSaveConfig = async (newConfig: any) => {
    try {
      // Keep browser cache synchronized
      const LOCAL_STORAGE_KEY = "texly_config_backup";
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newConfig));

      const res = await fetch("/api/config/save", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify(newConfig)
      });
      if (!handleResponseStatus(res)) return false;
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        await fetchLogs();
        return true;
      }
    } catch (err) {
      console.error("Failed to save setups config:", err);
    }
    return false;
  };

  // Action: Run Keyword research analysis
  const handleKeywordResearch = async (seedKeyword: string): Promise<KeywordResult[]> => {
    try {
      const res = await fetch("/api/keywords/research", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ seedKeyword })
      });
      if (!handleResponseStatus(res)) return [];
      const data = await res.json();
      if (data.success) {
        await fetchLogs();
        return data.data;
      }
    } catch (err) {
      console.error("Keyword analysis failed:", err);
    }
    return [];
  };

  // Action: Compile single SEO dynamic page node on demand
  const handleGenerateContent = async (keyword: string, slug: string, category: string): Promise<SEOPage | null> => {
    setIsCompilingContent(true);
    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ keyword, slug, category })
      });
      if (!handleResponseStatus(res)) return null;
      const data = await res.json();
      if (data.success) {
        await fetchPages();
        await fetchLogs();
        return data.page;
      }
    } catch (err) {
      console.error("Content generation failed:", err);
    } finally {
      setIsCompilingContent(false);
    }
    return null;
  };

  const handleSelectPreview = (slug: string) => {
    setPreviewSlug(slug);
    setActiveTab("preview");
  };

  // In-place keyword deploying action from the keyword card
  const handleInlineDeploy = async (keyword: string, slug: string, category: string) => {
    setIsGeneratingMap((prev) => ({ ...prev, [slug]: true }));
    try {
      const compiled = await handleGenerateContent(keyword, slug, category);
      if (compiled) {
        setActiveTab("dashboard");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingMap((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "preview", label: "Live Preview", icon: Eye },
    { id: "keyword", label: "Keyword Gaps", icon: Compass },
    { id: "content", label: "Page Architect", icon: Wand2 },
    { id: "sandbox", label: "Cleaner Sandbox", icon: Wrench },
    { id: "exporter", label: "Code Exporter", icon: Layers },
    { id: "config", label: "Sync Setup", icon: Settings }
  ] as const;

  if (verifyingAuth) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center text-zinc-400 font-mono text-xs select-none">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-cyan-400" size={24} />
          <span>सुरक्षित प्राधिकरण लोड हो रहा है...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center text-zinc-350 font-sans p-4 relative overflow-hidden select-none">
        {/* Glow ambient design elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/3 w-[350px] h-[350px] bg-indigo-500/5 rounded-full filter blur-[80px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0c0c12]/95 border border-zinc-900 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative z-10">
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex w-12 h-12 rounded-xl bg-cyan-500 items-center justify-center text-zinc-950 font-black text-xl font-mono shadow-lg shadow-cyan-500/15">
              TX
            </div>
            <h2 className="text-xl font-black text-white tracking-tight leading-none uppercase">Texly Control Panel</h2>
            <p className="text-[11px] text-zinc-500">आगे बढ़ने के लिए कृपया अपने एडमिन क्रेडेंशियल्स दर्ज करें</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-medium leading-relaxed">
                {loginError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                Username (यूजरनेम)
              </label>
              <input 
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="एडमिन यूजरनेम दर्ज करें"
                className="w-full bg-[#050508] border border-zinc-850 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 focus:border-cyan-500/50 transition font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                Password (पासवर्ड)
              </label>
              <input 
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="पासवर्ड दर्ज करें"
                className="w-full bg-[#050508] border border-zinc-850 text-sm px-4 py-3 rounded-xl outline-none text-zinc-200 focus:border-cyan-500/50 transition"
              />
            </div>

            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-black text-xs rounded-xl shadow-lg shadow-cyan-500/10 hover:shadow-cyan-400/20 transition uppercase tracking-widest cursor-pointer flex justify-center items-center gap-2"
            >
              {isLoggingIn && <RefreshCw size={14} className="animate-spin" />}
              {isLoggingIn ? "सत्यापन जारी..." : "सुरक्षित प्रवेश करें"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-900 text-[10px] text-zinc-600 text-center leading-relaxed font-mono">
            यह एक सुरक्षित और एनक्रिप्टेड पोर्टल है। 
            <br />
            डिफ़ॉल्ट क्रेडेंशियल्स: <strong className="text-zinc-400">admin</strong> / <strong className="text-zinc-400">admin123</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#07070a] text-zinc-300 font-sans" id="app_view">
      
      {/* Sidebar - Desktop Layout */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0c0c12] border-r border-zinc-900 shrink-0 select-none">
        {/* Core panel branding */}
        <div className="p-6 border-b border-zinc-900 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-cyan-500 flex items-center justify-center text-zinc-950 font-black text-xs font-mono">
              TX
            </div>
            <h1 className="text-white font-bold tracking-tight text-sm">Texly Autonomous</h1>
          </div>
          <p className="text-[10px] text-zinc-550 flex items-center gap-1 font-mono uppercase tracking-widest font-semibold pt-0.5">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse"></span>
            SEO Automation Panel
          </p>
        </div>

        {/* Navigation panel links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-medium tracking-wide transition cursor-pointer ${
                  isActive 
                    ? "bg-zinc-900 border border-zinc-800 text-white font-semibold" 
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                }`}
              >
                <Icon size={16} className={isActive ? "text-cyan-400" : "text-zinc-500"} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer info panels */}
        <div className="p-4 border-t border-zinc-900 text-[10px] text-zinc-650 space-y-3 filter brightness-90">
          <div>
            <p className="text-zinc-500">Autonomous Target Domain:</p>
            <a 
              href="https://www.texlyonline.in" 
              target="_blank" 
              rel="noreferrer" 
              className="text-cyan-400/90 hover:underline font-mono truncate block text-xs"
            >
              texlyonline.in
            </a>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-450 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            सुरक्षित लॉगआउट
          </button>
        </div>
      </aside>

      {/* Mobile Top Navigation layout */}
      <header className="md:hidden bg-[#0c0c12] border-b border-zinc-900 px-4 py-3.5 flex justify-between items-center select-none shrink-0" id="mobile_header">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-cyan-500 flex items-center justify-center text-zinc-950 font-bold text-xs">
            TX
          </div>
          <span className="text-white font-bold tracking-tight text-xs">Texly SEO Automation</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-zinc-400 hover:text-white p-1"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Dropdown Menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0c0c12] border-b border-zinc-900 px-4 py-4 space-y-2 select-none" id="mobile_drawer">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-xs font-medium transition ${
                  isActive 
                    ? "bg-zinc-900 text-white font-semibold border border-zinc-800" 
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              handleLogout();
              setMobileMenuOpen(false);
            }}
            className="w-full py-3 bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-850 rounded-lg text-xs font-black tracking-widest uppercase mt-4 cursor-pointer"
          >
            सुरक्षित लॉगआउट
          </button>
        </div>
      )}

      {/* Core Dynamic Content Panel Workspace */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 md:py-10 selection:bg-cyan-500/10 select-none">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Active section header mapping */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-zinc-900 pb-5 mb-2 shrink-0">
            <div>
              <nav className="text-zinc-600 text-[10px] uppercase font-mono tracking-wider mb-1">
                Root / SEO Autopilot / <span className="text-cyan-500">{activeTab}</span>
              </nav>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                {activeTab === "dashboard" && "Central Automation Console"}
                {activeTab === "preview" && "Autonomous Page Simulator"}
                {activeTab === "keyword" && "High-Intent Keyword Gaps"}
                {activeTab === "content" && "SEO Node Blueprint Builder"}
                {activeTab === "sandbox" && "Client-Side Engine Sandbox"}
                {activeTab === "exporter" && "Dynamic Exporter & Integrator"}
                {activeTab === "config" && "Vercel & Pipeline settings"}
              </h1>
            </div>

            {/* Micro Live Indicators */}
            <div className="flex items-center gap-3 text-xs bg-[#0c0c12] border border-zinc-855 px-3 py-1.5 rounded-lg shrink-0">
              <span className={`w-2 h-2 rounded animate-pulse ${config?.useGroq && config?.groqApiKey ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              <span className="text-zinc-400 font-mono font-semibold">
                {config?.useGroq && config?.groqApiKey 
                  ? `Groq API: Connected (${config.groqModel || "llama3"})`
                  : "Gemini API: Connected (gemini-3.5)"
                }
              </span>
            </div>
          </div>

          {/* Render Active Switch Tab components */}
          {activeTab === "dashboard" && (
            <DashboardTab 
              pages={pages}
              logs={logs}
              onRefreshPages={fetchPages}
              onRefreshLogs={fetchLogs}
              onRunCron={handleRunCron}
              onDeletePage={handleDeletePage}
              onClearLogs={handleClearLogs}
              onSelectPreview={handleSelectPreview}
              isProcessing={isProcessingCron}
            />
          )}

          {activeTab === "preview" && (
            <PreviewTab 
              pages={pages}
              initialSlug={previewSlug}
              onNavigateToTab={setActiveTab}
            />
          )}

          {activeTab === "keyword" && (
            <KeywordTab 
              onSearch={handleKeywordResearch}
              onGenerateFromKeyword={handleInlineDeploy}
              isGeneratingMap={isGeneratingMap}
            />
          )}

          {activeTab === "content" && (
            <ContentTab 
              onGenerate={handleGenerateContent}
              isGenerating={isCompilingContent}
            />
          )}

          {activeTab === "sandbox" && (
            <SandboxTab />
          )}

          {activeTab === "exporter" && (
            <ExporterTab />
          )}

          {activeTab === "config" && (
            <ConfigTab 
              initialConfig={config}
              onSaveConfig={handleSaveConfig}
            />
          )}

        </div>
      </main>
    </div>
  );
}
