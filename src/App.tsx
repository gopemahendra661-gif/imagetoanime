/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Compass, LayoutDashboard, Wand2, Wrench, Settings, Layers, 
  HelpCircle, Sparkles, RefreshCw, Terminal, Globe, ChevronRight, Menu, X, Eye,
  Sun, Moon, Github, Smartphone
} from "lucide-react";

import { SEOPage, AutomationLog, KeywordResult } from "./types";
import DashboardTab from "./components/DashboardTab";
import PreviewTab from "./components/PreviewTab";
import KeywordTab from "./components/KeywordTab";
import ContentTab from "./components/ContentTab";
import SandboxTab from "./components/SandboxTab";
import ExporterTab from "./components/ExporterTab";
import ConfigTab from "./components/ConfigTab";
import SitemapTab from "./components/SitemapTab";
import GitHubTab from "./components/GitHubTab";
import GapAnalyzerTab from "./components/GapAnalyzerTab";
import AndroidSuiteTab from "./components/AndroidSuiteTab";

export default function App() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "preview" | "keyword" | "content" | "sandbox" | "exporter" | "config" | "sitemap" | "github" | "gap-analyzer" | "android">("dashboard");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("texly_theme") as "light" | "dark") || "dark";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("texly_theme", nextTheme);
  };
  const [previewSlug, setPreviewSlug] = useState<string>("");
  const [pages, setPages] = useState<SEOPage[]>([]);
  const [slugToUrlMap, setSlugToUrlMap] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [supabaseUrlMasked, setSupabaseUrlMasked] = useState<string>("");
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
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);

  // Decode utility to find active user dynamically
  const getActiveUser = (): string => {
    if (!loginToken) return "admin";
    try {
      const decoded = atob(loginToken);
      return decoded.split(":")[0] || "admin";
    } catch {
      return "admin";
    }
  };
  const activeUser = getActiveUser();
  const isGuestMode = activeUser === "admin";

  // Premium Cloud Sync Registration & OTP states
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regGithubRepo, setRegGithubRepo] = useState("");
  const [regGithubToken, setRegGithubToken] = useState("");
  const [regSupabaseUrl, setRegSupabaseUrl] = useState("");
  const [regSupabaseKey, setRegSupabaseKey] = useState("");
  const [regOtp, setRegOtp] = useState("");
  const [regStep, setRegStep] = useState<1 | 2>(1); // 1 = Form, 2 = Enter OTP code
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [isSyncLoginMode, setIsSyncLoginMode] = useState(false); // Switch between login or signup forms inside Sync tab

  // Quick logout action
  const handleLogout = () => {
    localStorage.removeItem("texly_admin_token");
    localStorage.setItem("texly_logged_out", "true");
    
    // Wipe client backups from browser storage to ensure strict multi-user privacy
    localStorage.removeItem("texly_pages_backup");
    localStorage.removeItem("texly_config_full_backup");
    localStorage.removeItem("texly_config");
    localStorage.removeItem("texly_automation_state");

    setLoginToken(null);
    setIsLoggedIn(false);
    setUsernameInput("");
    setPasswordInput("");
    
    // Reset loaded workspace states to prevent transient interface data leakage when switching accounts
    setPages([]);
    setSlugToUrlMap({});
    setLogs([]);
    setConfig(null);
    setSupabaseConnected(false);
    setSupabaseUrlMasked("");
    setPreviewSlug("");

    // Reset registration forms as well
    setRegUsername("");
    setRegEmail("");
    setRegPassword("");
    setRegGithubRepo("");
    setRegGithubToken("");
    setRegSupabaseUrl("");
    setRegSupabaseKey("");
  };

  const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<Response> => {
    try {
      const res = await fetch(url, options);
      if (!res.ok && [502, 503, 504].includes(res.status) && retries > 0) {
        console.warn(`Fetch returned ${res.status} for ${url}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      return res;
    } catch (err: any) {
      if (retries > 0) {
        console.warn(`Fetch connection failed for ${url}. Retrying in ${delay}ms...`, err);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1, delay * 2);
      }
      throw err;
    }
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
      const res = await fetchWithRetry("/api/verify-auth", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setIsLoggedIn(true);
          setLoginToken(token);

          // Silent Auto-Rehydration if the container was cold-restarted & auto-restored the account
          if (data.restored) {
            console.log("[Auto-Restore] Active server was cold restarted. Restoring pages & configurations from secure device backup...");
            try {
              const pagesBackup = localStorage.getItem("texly_pages_backup");
              const configBackup = localStorage.getItem("texly_config_full_backup");

              const pagesParsed = pagesBackup ? JSON.parse(pagesBackup) : null;
              const configParsed = configBackup ? JSON.parse(configBackup) : null;

              if ((pagesParsed && pagesParsed.length > 0) || configParsed) {
                const recoverRes = await fetchWithRetry("/api/user/restore-backup", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    pages: pagesParsed,
                    config: configParsed
                  })
                });
                if (recoverRes.ok) {
                  const recoverVal = await recoverRes.json();
                  if (recoverVal.success) {
                    console.log("[Auto-Restore] Recovery successful! Server space is back in sync.");
                  }
                }
              }
            } catch (restoreErr) {
              console.error("[Auto-Restore] Failed to restore local backups:", restoreErr);
            }
          }
          return true;
        }
      } else if (res.status === 401) {
        // Only strip token on explicit login reject credentials
        localStorage.removeItem("texly_admin_token");
        setIsLoggedIn(false);
        setLoginToken(null);
      }
    } catch (err) {
      console.error("Auth token verification error:", err);
      // Retain token on random network failures so user isn't logged out dynamically
    }
    return false;
  };

  // Submit new independent sync signup and dispatch OTP code
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regEmail || !regPassword) {
      setRegError("कृपया यूज़रनेम, ईमेल और पासवर्ड दर्ज करें।");
      return;
    }
    setRegError(null);
    setRegSuccess(null);
    setRegLoading(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: regUsername, 
          email: regEmail, 
          password: regPassword, 
          githubRepo: regGithubRepo,
          githubToken: regGithubToken,
          supabaseUrl: regSupabaseUrl,
          supabaseKey: regSupabaseKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegSuccess("वेरिफिकेशन ओटीपी सफलतापूर्वक आपकी ईमेल आईडी पर भेजा गया है।");
        setRegStep(2); // Advance to entering 6-digit OTP
      } else {
        setRegError(data.message || "OTP भेजने में त्रुटि हुई। क्रेडेंशियल जांचें।");
      }
    } catch (err: any) {
      setRegError("सर्वर से संपर्क करने में असमर्थ। कृपया इंटरनेट और एपीआई जांचें।");
    } finally {
      setRegLoading(false);
    }
  };

  // Verify OTP and complete independent cloud signup
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regOtp) {
      setRegError("कृपया 6-अंकों का वेरिफिकेशन ओटीपी दर्ज करें।");
      return;
    }
    setRegError(null);
    setRegSuccess(null);
    setRegLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, otp: regOtp })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem("texly_admin_token", data.token);
        setLoginToken(data.token);
        setIsLoggedIn(true);
        // Reset states
        setRegStep(1);
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
        setRegGithubRepo("");
        setRegGithubToken("");
        setRegSupabaseUrl("");
        setRegSupabaseKey("");
        setRegOtp("");
      } else {
        setRegError(data.message || "वेरिफिकेशन कोड गलत है या उसकी मियाद समाप्त हो गई है।");
      }
    } catch (err: any) {
      setRegError("कनेक्शन एरर। सर्वर से ओटीपी सत्यापित करने में त्रुटि।");
    } finally {
      setRegLoading(false);
    }
  };

  // Handle direct login from inside sync settings
  const handleSyncLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword) {
      setRegError("कृपया अपना यूजरनेम और पासवर्ड दर्ज करें।");
      return;
    }
    setRegError(null);
    setRegSuccess(null);
    setRegLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername, password: regPassword })
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem("texly_admin_token", data.token);
        setLoginToken(data.token);
        setIsLoggedIn(true);
        setRegUsername("");
        setRegPassword("");
      } else {
        setRegError(data.message || "क्रेडेंशियल्स गलत हैं! पुनः प्रयास करें।");
      }
    } catch (err: any) {
      setRegError("सर्वर से संपर्क करने में असमर्थ। कृपया इंटरनेट चेक करें।");
    } finally {
      setRegLoading(false);
    }
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
        localStorage.removeItem("texly_logged_out");
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

  // Register POST action for new users
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput || !passwordInput) {
      setLoginError("कृपया नया यूजरनेम और पासवर्ड दर्ज करें।");
      return;
    }

    setIsLoggingIn(true);
    setLoginError(null);
    setRegisterSuccessMsg(null);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRegisterSuccessMsg(data.message || "पंजीकरण सफल! अब आप लॉगिन कर सकते हैं।");
        setIsRegisterMode(false);
        setPasswordInput(""); // Clear password for login
      } else {
        setLoginError(data.message || "अकाउंट पंजीकरण में विफल। क्रेडेंशियल जांचें।");
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
      const res = await fetchWithRetry("/api/pages", {
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        setPages(data.pages);
        if (data.slugToUrlMap) {
          setSlugToUrlMap(data.slugToUrlMap);
        }
        // Save current pages to browser local storage for resilient automated backup recovery
        if (data.pages && data.pages.length > 0) {
          localStorage.setItem("texly_pages_backup", JSON.stringify(data.pages));
        }
      }
    } catch (err) {
      console.error("Failed to fetch page indices:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetchWithRetry("/api/logs", {
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
      const res = await fetchWithRetry("/api/config", {
        headers: getAuthHeaders()
      });
      if (!handleResponseStatus(res)) return;
      const data = await res.json();
      if (data.success) {
        const serverConfig = data.config || {};
        setConfig(serverConfig);
        setSupabaseConnected(!!data.supabaseConnected);
        setSupabaseUrlMasked(data.supabaseUrlMasked || "");

        // Resilient browser localStorage backup restore (Non-sensitive variables only)
        const LOCAL_STORAGE_KEY = "texly_config_backup";
        const storedStr = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (storedStr) {
          try {
            const clientConfig = JSON.parse(storedStr);
            let needsSync = false;
            const mergedConfig = { ...serverConfig };

            const keysToRestore = [
              "githubRepo", "vercelWebhookUrl",
              "groqModel", "openrouterModel", "adminUsername"
            ];

            // If a custom key is present in client localStorage but not configured on the server, auto-sync it
            for (const key of keysToRestore) {
              if (clientConfig[key] && !serverConfig[key]) {
                mergedConfig[key] = clientConfig[key];
                needsSync = true;
              }
            }

            // Sync other non-sensitive keys forward from server to local storage too to ensure perfectly consistent data
            for (const key of keysToRestore) {
              if (serverConfig[key] && clientConfig[key] !== serverConfig[key]) {
                clientConfig[key] = serverConfig[key];
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clientConfig));
              }
            }

            if (needsSync) {
              console.log("[Auto-Sync] Restoring configurations from local device cache...");
              const saveRes = await fetchWithRetry("/api/config/save", {
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
          // Guard backup initially, excluding any sensitive attributes
          const filteredConfig = { ...serverConfig };
          const sensitiveKeys = ["githubToken", "supabaseKey", "groqApiKey", "openrouterApiKey", "geminiApiKey", "adminPassword", "vercelWebhookUrl"];
          sensitiveKeys.forEach(k => delete filteredConfig[k]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredConfig));
        }
      }
    } catch (err) {
      console.error("Failed to fetch setups config:", err);
    }
  };

  // Initialize auth credentials check from client memory
  useEffect(() => {
    const savedToken = localStorage.getItem("texly_admin_token");
    const loggedOut = localStorage.getItem("texly_logged_out");
    if (savedToken && loggedOut !== "true") {
      verifyAuthToken(savedToken).finally(() => {
        setVerifyingAuth(false);
      });
    } else if (loggedOut === "true") {
      setIsLoggedIn(false);
      setVerifyingAuth(false);
    } else {
      // Auto-login as default public administrator silently to open the app fully by default
      const defaultToken = btoa("admin:admin123");
      localStorage.setItem("texly_admin_token", defaultToken);
      setLoginToken(defaultToken);
      setIsLoggedIn(true);
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
      // Keep browser cache synchronized (excluding sensitive variables)
      const LOCAL_STORAGE_KEY = "texly_config_backup";
      const filteredConfig = { ...newConfig };
      const sensitiveKeys = ["githubToken", "supabaseKey", "groqApiKey", "openrouterApiKey", "geminiApiKey", "adminPassword", "vercelWebhookUrl"];
      sensitiveKeys.forEach(k => delete filteredConfig[k]);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filteredConfig));

      // Save complete, unmasked config securely in user's browser device memory for auto-restore of API keys on container wakeups
      localStorage.setItem("texly_config_full_backup", JSON.stringify(newConfig));

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
        setSupabaseConnected(!!data.supabaseConnected);
        setSupabaseUrlMasked(data.supabaseUrlMasked || "");
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
  const handleGenerateContent = async (keyword: string, slug: string, category: string, pushToLive: boolean = false): Promise<SEOPage | null> => {
    setIsCompilingContent(true);
    try {
      const res = await fetch("/api/generate-content", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ keyword, slug, category, pushToLive })
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

  const handlePushAllToGitHub = async (): Promise<{ success: boolean; message: string; error?: string }> => {
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        }
      });
      const data = await res.json();
      if (data.success) {
        await fetchPages();
        await fetchLogs();
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.message || "Manual push failed." };
      }
    } catch (err: any) {
      console.error("Manual push to GitHub failed:", err);
      return { success: false, message: "Network error occurred.", error: err.message };
    }
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
    { id: "gap-analyzer", label: "AI Gap Analyzer", icon: Sparkles },
    { id: "android", label: "Android Suite", icon: Smartphone },
    { id: "keyword", label: "Keyword Gaps", icon: Compass },
    { id: "content", label: "Page Architect", icon: Wand2 },
    { id: "sitemap", label: "Sitemap Linker", icon: Globe },
    { id: "sandbox", label: "Cleaner Sandbox", icon: Wrench },
    { id: "exporter", label: "Code Exporter", icon: Layers },
    { id: "github", label: "GitHub Pusher", icon: Github },
    { id: "config", label: "Sync Setup", icon: Settings }
  ] as const;

  if (verifyingAuth) {
    return (
      <div className={`min-h-screen bg-[#07070a] flex items-center justify-center text-zinc-400 font-mono text-xs select-none ${theme}`}>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="animate-spin text-cyan-400" size={24} />
          <span>सुरक्षित प्राधिकरण लोड हो रहा है...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen bg-[#07070a] flex items-center justify-center text-zinc-350 font-sans p-4 relative overflow-hidden select-none ${theme}`}>
        {/* Theme toggle in top-right corner during login */}
        <button 
          onClick={toggleTheme}
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
          className="absolute top-6 right-6 p-2.5 rounded-xl border border-zinc-850 hover:bg-zinc-900/60 bg-zinc-950 text-zinc-400 hover:text-white transition cursor-pointer flex items-center gap-2 text-xs font-mono font-medium"
        >
          {theme === "dark" ? <Sun size={15} className="text-amber-450 animate-pulse" /> : <Moon size={15} className="text-indigo-400" />}
          <span>{theme === "dark" ? "Light" : "Dark"} Mode</span>
        </button>

        {/* Glow ambient design elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-cyan-500/5 rounded-full filter blur-[100px] pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/3 w-[350px] h-[350px] bg-indigo-500/5 rounded-full filter blur-[80px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#0c0c12]/95 border border-zinc-900 rounded-2xl p-8 backdrop-blur-xl shadow-2xl relative z-10 font-sans">
          <div className="text-center space-y-2 mb-8">
            <div className="inline-flex w-12 h-12 rounded-xl bg-cyan-500 items-center justify-center text-zinc-950 font-black text-xl font-mono shadow-lg shadow-cyan-500/15">
              TX
            </div>
            <h2 className="text-xl font-black text-white tracking-tight leading-none uppercase">
              {isRegisterMode ? "Texly Register" : "Texly Control Panel"}
            </h2>
            <p className="text-[11px] text-zinc-500">
              {isRegisterMode 
                ? "अपना खुद का सुरक्षित होस्टिंग अकाउंट शुरू करने के लिए नया अकाउंट क्रेडेंशियल्स दर्ज करें"
                : "आगे बढ़ने के लिए कृपया अपने क्रेडेंशियल्स दर्ज करें"
              }
            </p>
          </div>

          <form onSubmit={isRegisterMode ? handleRegisterSubmit : handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-medium leading-relaxed">
                {loginError}
              </div>
            )}

            {registerSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center font-medium leading-relaxed">
                {registerSuccessMsg}
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
                placeholder="यूजरनेम दर्ज करें"
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
              {isLoggingIn 
                ? "सत्यापन जारी..." 
                : isRegisterMode ? "नया अकाउंट बनाएं" : "सुरक्षित प्रवेश करें"
              }
            </button>
          </form>

          <div className="relative flex py-2 items-center my-3">
            <div className="flex-grow border-t border-zinc-900/60"></div>
            <span className="flex-shrink mx-3 text-zinc-650 text-[9px] uppercase tracking-widest font-mono">Or / या</span>
            <div className="flex-grow border-t border-zinc-900/60"></div>
          </div>

          <button 
            type="button"
            onClick={() => {
              localStorage.removeItem("texly_logged_out");
              const defaultToken = btoa("admin:admin123");
              localStorage.setItem("texly_admin_token", defaultToken);
              setLoginToken(defaultToken);
              setIsLoggedIn(true);
              setLoginError(null);
            }}
            className="w-full py-3 bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 hover:border-cyan-500/25 text-zinc-300 hover:text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-cyan-500/5 transition duration-200 uppercase tracking-widest cursor-pointer flex justify-center items-center gap-2 font-sans"
          >
            🚀 कंटिन्यू एज़ गेस्ट (Guest Mode में चलाएं)
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setLoginError(null);
                setRegisterSuccessMsg(null);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-4 cursor-pointer font-medium"
            >
              {isRegisterMode 
                ? "पहले से अकाउंट है? लॉगिन करें (Go to Login)" 
                : "नया यूजर अकाउंट बनाना चाहते हैं? पंजीकरण करें (Sign Up / Register)"
              }
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-zinc-900 text-[10px] text-zinc-600 text-center leading-relaxed font-mono">
            यह एक सुरक्षित और एनक्रिप्टेड पोर्टल है। 
            <br />
            डिफ़ॉल्ट एडमिन क्रेडेंशियल्स: <strong className="text-zinc-500">admin</strong> / <strong className="text-zinc-500">admin123</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col md:flex-row min-h-screen bg-[#07070a] text-zinc-300 font-sans transition-all duration-300 ${theme}`} id="app_view">
      
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
          
          {/* Theme Mode Toggler Button */}
          <button
            onClick={toggleTheme}
            className="w-full py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            {theme === "dark" ? <Sun size={12} className="text-amber-450 animate-pulse" /> : <Moon size={12} className="text-indigo-400" />}
            <span>{theme === "dark" ? "Light Mode (लाइट)" : "Dark Mode (डार्क)"}</span>
          </button>

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
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="text-zinc-405 hover:text-white p-1 rounded hover:bg-zinc-900 transition shrink-0"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun size={17} className="text-amber-450" /> : <Moon size={17} className="text-indigo-450" />}
          </button>
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-zinc-400 hover:text-white p-1"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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
      <main className="flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden px-4 md:px-8 py-8 md:py-10 selection:bg-cyan-500/10">
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
                {activeTab === "sitemap" && "Active Sitemap Linker & Mapper"}
                {activeTab === "sandbox" && "Client-Side Engine Sandbox"}
                {activeTab === "exporter" && "Dynamic Exporter & Integrator"}
                {activeTab === "github" && "GitHub Project Deployer & Pusher"}
                {activeTab === "config" && "Vercel & Pipeline settings"}
                {activeTab === "gap-analyzer" && "AI Tool & Gap Analyzer"}
                {activeTab === "android" && "Android APP Builder & Suite"}
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
              getAuthHeaders={getAuthHeaders}
            />
          )}

          {activeTab === "preview" && (
            <PreviewTab 
              pages={pages}
              initialSlug={previewSlug}
              onNavigateToTab={setActiveTab}
              slugToUrlMap={slugToUrlMap}
              onUpdateSlugToUrlMap={setSlugToUrlMap}
              getAuthHeaders={getAuthHeaders}
            />
          )}

          {activeTab === "gap-analyzer" && (
            <GapAnalyzerTab 
              pages={pages}
              onRefreshPages={fetchPages}
              getAuthHeaders={getAuthHeaders}
            />
          )}

          {activeTab === "android" && (
            <AndroidSuiteTab 
              getAuthHeaders={getAuthHeaders}
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
              onPushAll={handlePushAllToGitHub}
            />
          )}

          {activeTab === "sandbox" && (
            <SandboxTab />
          )}

          {activeTab === "sitemap" && (
            <SitemapTab 
              pages={pages}
              onRefreshPages={fetchPages}
              getAuthHeaders={getAuthHeaders}
            />
          )}

          {activeTab === "exporter" && (
            <ExporterTab />
          )}

          {activeTab === "github" && (
            <GitHubTab />
          )}

          {activeTab === "config" && (
            isGuestMode ? (
              <div id="independent-sync-setup-container" className="max-w-2xl mx-auto bg-[#0a0a0f] border border-zinc-850 rounded-2xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-zinc-350">
                {/* Visual decoration line */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500"></div>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-cyan-500/5 rounded-full filter blur-[70px] pointer-events-none"></div>

                <div className="flex items-center gap-3.5 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Settings size={22} className={regLoading ? "animate-spin" : ""} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span>स्वतंत्र क्लाउड सिंक सेटअप</span>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md">Guest View</span>
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">Independent Secure Cloud Sync & Data Isolation Setup</p>
                  </div>
                </div>

                {/* Info Box */}
                <div className="p-4 bg-cyan-950/15 border border-cyan-900/30 text-zinc-300 rounded-xl text-xs leading-relaxed mb-6 space-y-1">
                  <p className="font-semibold text-cyan-400">🛡️ क्यों स्वतंत्र सुरक्षित अकाउंट आवश्यक है?</p>
                  <p>यह सेटअप करने से आपका सारा डेटा (SEO Pages, configs और Logs) आपके अपने निजी GitHub रिपॉजिटरी और Supabase डेटाबेस में सीधे सिंक्रोनाइज़ होगा। इससे आपका प्राइवेसी/अकाउंट पूरी तरह सुरक्षित रहता है और आपका सिंक डेटा पब्लिक नहीं होगा।</p>
                </div>

                {regStep === 1 ? (
                  <div className="space-y-6">
                    {/* Form type switcher tab */}
                    <div className="flex border-b border-zinc-900 p-0.5 bg-zinc-950/60 rounded-lg max-w-sm">
                      <button 
                        onClick={() => { setIsSyncLoginMode(false); setRegError(null); setRegSuccess(null); }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer ${!isSyncLoginMode ? "bg-cyan-500 text-zinc-950" : "text-zinc-450 hover:text-white"}`}
                      >
                        नया अकाउंट (Signup)
                      </button>
                      <button 
                        onClick={() => { setIsSyncLoginMode(true); setRegError(null); setRegSuccess(null); }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer ${isSyncLoginMode ? "bg-cyan-500 text-zinc-950" : "text-zinc-450 hover:text-white"}`}
                      >
                        लॉगिन (Log In)
                      </button>
                    </div>

                    {regError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold leading-relaxed">
                        ⚠️ {regError}
                      </div>
                    )}

                    {regSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold leading-relaxed">
                        🎉 {regSuccess}
                      </div>
                    )}

                    {!isSyncLoginMode ? (
                      /* Signup Form */
                      <form onSubmit={handleSendOTP} className="space-y-4 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider block">Username (यूज़र का नाम)</label>
                            <input 
                              type="text"
                              required
                              value={regUsername}
                              onChange={(e) => setRegUsername(e.target.value)}
                              placeholder="यूज़रनेम दर्ज करें"
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition"
                            />
                          </div>

                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider block">Email ID (ईमेल आईडी - OTP के लिए)</label>
                            <input 
                              type="email"
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="अपना ईमेल दर्ज करें"
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 font-sans">
                          <label className="font-bold text-zinc-400 uppercase tracking-wider block">Password (अकाउंट पासवर्ड)</label>
                          <input 
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="नया सुरक्षित पासवर्ड सेट करें"
                            className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-900">
                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                              <span>GitHub Repository</span>
                              <span className="text-[9px] text-zinc-500 font-normal lowercase">(optional)</span>
                            </label>
                            <input 
                              type="text"
                              value={regGithubRepo}
                              onChange={(e) => setRegGithubRepo(e.target.value)}
                              placeholder="Past Your Repostry Link"
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition font-mono"
                            />
                          </div>

                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                              <span>GitHub PAT Token</span>
                              <span className="text-[9px] text-zinc-500 font-normal lowercase">(optional)</span>
                            </label>
                            <input 
                              type="password"
                              value={regGithubToken}
                              onChange={(e) => setRegGithubToken(e.target.value)}
                              placeholder="ghp_..."
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                              <span>Supabase Project URL</span>
                              <span className="text-[9px] text-zinc-500 font-normal lowercase">(optional)</span>
                            </label>
                            <input 
                              type="text"
                              value={regSupabaseUrl}
                              onChange={(e) => setRegSupabaseUrl(e.target.value)}
                              placeholder="https://xyz.supabase.co"
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition font-mono"
                            />
                          </div>

                          <div className="space-y-1.5 font-sans">
                            <label className="font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                              <span>Supabase Service Role Key</span>
                              <span className="text-[9px] text-zinc-500 font-normal lowercase">(optional)</span>
                            </label>
                            <input 
                              type="password"
                              value={regSupabaseKey}
                              onChange={(e) => setRegSupabaseKey(e.target.value)}
                              placeholder="eyJhbGci..."
                              className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition animate-pulse"
                            />
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={regLoading}
                          className="w-full mt-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transition flex items-center justify-center gap-2"
                        >
                          {regLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                          अकाउंट बनाएं और ईमेल पर OTP भेजें
                        </button>
                      </form>
                    ) : (
                      /* Login Form */
                      <form onSubmit={handleSyncLogin} className="space-y-4 text-xs">
                        <div className="space-y-1.5 font-sans">
                          <label className="font-bold text-zinc-400 uppercase tracking-wider block">Username (यूजरनेम दर्ज करें)</label>
                          <input 
                            type="text"
                            required
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            placeholder="यूज़रनेम दर्ज करें"
                            className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition font-mono"
                          />
                        </div>

                        <div className="space-y-1.5 font-sans">
                          <label className="font-bold text-zinc-400 uppercase tracking-wider block">Password (पासवर्ड दर्ज करें)</label>
                          <input 
                            type="password"
                            required
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="पासवर्ड दर्ज करें"
                            className="w-full bg-[#050508] border border-zinc-850 px-3.5 py-2.5 text-zinc-200 rounded-xl outline-none focus:border-cyan-500/50 text-xs transition"
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={regLoading}
                          className="w-full mt-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transition flex items-center justify-center gap-2"
                        >
                          {regLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                          सत्यापित क्रेडेंशियल से लॉगिन करें
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  /* OTP Validation Screen (Step 2) */
                  <form onSubmit={handleVerifyOTP} className="space-y-5 text-xs">
                    <div className="text-center space-y-2 mb-4 font-sans">
                      <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-2 border border-cyan-500/20">
                        <RefreshCw size={26} className="animate-spin text-cyan-400" />
                      </div>
                      <h3 className="text-md font-bold text-white">ईमेल सत्यापन कोड दर्ज करें</h3>
                      <p className="text-zinc-400 tracking-normal leading-relaxed text-xs">हमने आपके ईमेल <b>{regEmail}</b> पर 6-अंकों का वेरिफिकेशन ओटीपी भेजा है।</p>
                    </div>

                    {regError && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs text-center font-semibold">
                        ⚠️ {regError}
                      </div>
                    )}

                    {regSuccess && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center font-semibold">
                        📩 {regSuccess}
                      </div>
                    )}

                    <div className="space-y-2 font-sans">
                      <label className="font-bold text-zinc-400 uppercase tracking-widest text-center block text-[10px]">6-Digit Verify Code</label>
                      <input 
                        type="text"
                        required
                        maxLength={6}
                        value={regOtp}
                        onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                        className="w-full bg-[#050508] border border-zinc-800 text-center tracking-[12px] text-lg font-bold px-4 py-3.5 rounded-xl outline-none text-cyan-400 focus:border-cyan-500/60 transition font-mono"
                      />
                    </div>

                    <div className="p-4 bg-amber-500/5 border border-amber-500/15 text-amber-450 rounded-xl leading-relaxed text-[11px] flex gap-2.5 font-sans">
                      <div>
                        <p className="font-bold">💡 महत्वपूर्ण सुचना (Sandbox / Cloud Mode)</p>
                        <p className="mt-0.5">यदि आप हमारे क्लाउड प्रिव्यू वातावरण में रियल ईमेल डेलिवरी सेटअप नहीं किए हैं, तो प्रिव्यू के शीर्ष पर स्थित <b>"Automation Log"</b> या कंसोल लॉग्स खोलें। वहां आगत ओटीपी सबसे रीसेंट लॉग में दर्शाया गया है जिससे आप तुरंत सत्यापित कर सकते हैं!</p>
                      </div>
                    </div>

                    <div className="flex gap-3 font-sans">
                      <button 
                        type="button"
                        onClick={() => { setRegStep(1); setRegError(null); setRegSuccess(null); }}
                        className="flex-1 py-3 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded-xl cursor-pointer hover:bg-zinc-850 hover:text-white transition"
                      >
                        पीछे जाएं (Back)
                      </button>

                      <button 
                        type="submit"
                        disabled={regLoading}
                        className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black uppercase tracking-widest rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transition flex items-center justify-center gap-2"
                      >
                        {regLoading ? <RefreshCw size={13} className="animate-spin" /> : null}
                        ओटीपी सत्यापित करें (Verify)
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              /* Verified/custom accounts show normal ConfigTab */
              <div className="space-y-6">
                {/* Visual badge and custom indicator */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-xl flex items-center justify-between font-sans shadow-lg shadow-emerald-500/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm">
                      {activeUser.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-2.5">
                        <span>स्वतंत्र सिंक एक्टिवेटेड</span>
                        <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded-md">Verified User</span>
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">लॉग इन यूज़रनेम: <span className="text-emerald-400 font-bold">{activeUser}</span></p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleLogout}
                    className="px-3 py-1.5 bg-rose-500/10 text-rose-450 border border-rose-500/20 text-xs font-bold rounded-lg hover:bg-rose-500 hover:text-zinc-950 transition cursor-pointer"
                  >
                    अकाउंट लॉगआउट (Logout)
                  </button>
                </div>

                <ConfigTab 
                  initialConfig={config}
                  onSaveConfig={handleSaveConfig}
                  supabaseConnected={supabaseConnected}
                  supabaseUrlMasked={supabaseUrlMasked}
                />
              </div>
            )
          )}

        </div>
      </main>
    </div>
  );
}
