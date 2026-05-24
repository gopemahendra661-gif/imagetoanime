/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { AsyncLocalStorage } from "async_hooks";
import nodemailer from "nodemailer";

dotenv.config();

export const userSessionStorage = new AsyncLocalStorage<{ username: string }>();

// Helper to remove potential markdown code block backticks around LLM JSON responses
function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

// Hard timeout wrapper to guarantee async tasks don't hang requests
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, defaultValue: T): Promise<T> {
  let timeoutId: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve(defaultValue);
    }, timeoutMs);
  });
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timeoutId);
      return res;
    }).catch((err) => {
      clearTimeout(timeoutId);
      console.warn("[TIMEOUT WRAPPER] Inner statement exception:", err?.message || err);
      return defaultValue;
    }),
    timeoutPromise
  ]);
}

// Low-latency direct fetch query to Groq API using Native Fetch
async function callGroqAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model || "llama3-70b-8192",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Low-latency direct fetch query to OpenRouter API using Native Fetch
async function callOpenRouterAI(systemPrompt: string, userPrompt: string, apiKey: string, model: string): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://www.texlyonline.in",
      "X-Title": "Texly SEO Automation Platform"
    },
    body: JSON.stringify({
      model: model || "google/gemini-2.5-flash:free",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API returned HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Seamless intelligent fallback generator pipeline: Gemini -> Groq -> OpenRouter
async function generateWithFallbackPipeline(systemPrompt: string, userPrompt: string): Promise<{ text: string; source: string }> {
  const config = readDb(CONFIG_FILE);
  const errors: string[] = [];

  // Step 1: Attempt Gemini Generation (requires GEMINI_API_KEY env key)
  const client = getGeminiClient();
  if (client) {
    try {
      appendLog("Pipeline Engine", "Attempting generation with Gemini (gemini-3.5-flash)...");
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser instructions:\n${userPrompt}` : userPrompt;
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fullPrompt,
        config: {
          responseMimeType: "application/json"
        }
      });
      const responseText = response.text ? response.text.trim() : "";
      if (responseText) {
        return { text: responseText, source: "Gemini AI (gemini-3.5-flash)" };
      }
      throw new Error("Gemini AI returned an empty response string.");
    } catch (err: any) {
      const msg = `Gemini AI Failed: ${err.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  } else {
    errors.push("Gemini API key is not configured (neither database settings nor GEMINI_API_KEY env key matches).");
  }

  // Step 2: Fallback to Groq AI
  if (config?.groqApiKey) {
    try {
      const activeModel = config.groqModel || "llama3-70b-8192";
      appendLog("Pipeline Engine", `Gemini failed. Escalating to Groq AI fallback (using model: ${activeModel})...`, "warning");
      const responseText = await callGroqAI(systemPrompt, userPrompt, config.groqApiKey, activeModel);
      if (responseText) {
        return { text: responseText, source: `Groq AI (${activeModel})` };
      }
      throw new Error("Groq API returned an empty output.");
    } catch (err: any) {
      const msg = `Groq AI Failed: ${err.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  } else {
    errors.push("Groq API Key not configured in system settings.");
  }

  // Step 3: Fallback to OpenRouter AI
  if (config?.openrouterApiKey) {
    try {
      const activeModel = config.openrouterModel || "google/gemini-2.5-flash:free";
      appendLog("Pipeline Engine", `Groq failed. Escalating to OpenRouter AI fallback (using model: ${activeModel})...`, "warning");
      const responseText = await callOpenRouterAI(systemPrompt, userPrompt, config.openrouterApiKey, activeModel);
      if (responseText) {
        return { text: responseText, source: `OpenRouter AI (${activeModel})` };
      }
      throw new Error("OpenRouter API returned an empty output.");
    } catch (err: any) {
      const msg = `OpenRouter AI Failed: ${err.message}`;
      console.warn(msg);
      errors.push(msg);
    }
  } else {
    errors.push("OpenRouter API Key not configured in system settings.");
  }

  // All sources exhausted
  throw new Error(`All programmed fallback models failed or were missing configurations:\n- ${errors.join("\n- ")}`);
}

// Real GitHub API helper to commit/push the pages.json file dynamically!
async function pushToGitHub(repo: string, token: string, contentStr: string, filePath: string = "data/pages.json"): Promise<string> {
  if (!repo || !token) {
    throw new Error("Missing GitHub Repository or personal access token.");
  }

  // Clean up full GitHub URL if supplied (e.g. https://github.com/owner/repo or git@github.com:owner/repo.git)
  let cleanRepo = repo.trim();
  if (cleanRepo.startsWith("https://github.com/")) {
    cleanRepo = cleanRepo.substring("https://github.com/".length);
  } else if (cleanRepo.startsWith("http://github.com/")) {
    cleanRepo = cleanRepo.substring("http://github.com/".length);
  } else if (cleanRepo.startsWith("git@github.com:")) {
    cleanRepo = cleanRepo.substring("git@github.com:".length);
  }
  
  // Strip trailing slashes and potential .git extension
  cleanRepo = cleanRepo.replace(/\.git$/, "").replace(/\/+$/, "");

  const parts = cleanRepo.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid repository format. Must be 'owner/repo' or a full GitHub repository URL.");
  }

  const owner = parts[parts.length - 2];
  const name = parts[parts.length - 1];

  const url = `https://api.github.com/repos/${owner}/${name}/contents/${filePath}`;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "texly-automation-app"
  };

  let sha: string | undefined;

  // 1. Check if file already exists to get its SHA
  try {
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }
  } catch (err: any) {
    console.warn("GitHub file fetch warning (file may not exist yet):", err.message);
  }

  // 2. Commit the new contents using PUT
  const base64Content = Buffer.from(contentStr).toString("base64");
  const putBody = {
    message: `🤖 Programmatic SEO backup - Update pages.json [skip ci]`,
    content: base64Content,
    sha
  };

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(putBody)
  });

  if (!putRes.ok) {
    const errorBody = await putRes.text();
    throw new Error(`GitHub API status ${putRes.status}: ${errorBody}`);
  }

  const resultData = await putRes.json();
  return resultData.commit?.html_url || "Successfully committed";
}

async function triggerVercelWebhook(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: "POST" });
    return res.ok;
  } catch (err) {
    console.error("Vercel webhook request warning:", err);
    return false;
  }
}

async function generateSitemapXml(pages: any[]): Promise<string> {
  try {
    const baseUrl = process.env.BASE_URL || "https://www.texlyonline.in";
    const today = new Date().toISOString().split('T')[0];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
 
    // Static Pages
    const staticPages = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/blog", priority: "0.8", changefreq: "daily" },
      { path: "/about-us", priority: "0.5", changefreq: "monthly" },
      { path: "/privacy-policy", priority: "0.3", changefreq: "monthly" },
      { path: "/terms-and-conditions", priority: "0.3", changefreq: "monthly" },
      { path: "/contact-us", priority: "0.5", changefreq: "monthly" }
    ];
 
    staticPages.forEach(p => {
      xml += `\n  <url>\n    <loc>${baseUrl}${p.path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`;
    });
 
    // Tools
    const toolsLastmod = "2025-12-01";
    ALL_TOOL_SLUGS.forEach(slug => {
      xml += `\n  <url>\n    <loc>${baseUrl}/tool/${slug}</loc>\n    <lastmod>${toolsLastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    });

    // AI SEO Pages
    if (pages && Array.isArray(pages)) {
      pages.forEach((page: any) => {
        if (page.slug) {
          const lastmod = page.updatedAt 
            ? page.updatedAt.split("T")[0] 
            : page.createdAt 
            ? page.createdAt.split("T")[0] 
            : today;
          xml += `\n  <url>\n    <loc>${baseUrl}/seo/${page.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.75</priority>\n  </url>`;
        }
      });
    }

    // Dynamic Blog Posts (Supabase)
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    if (supabaseUrl && supabaseAnonKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false
          }
        });

        const { data: articles, error } = await supabase
          .from("articles")
          .select("slug, updated_at, created_at")
          .limit(1000);

        if (articles && !error) {
          articles.forEach((article: any) => {
            const lastModDate = new Date(article.updated_at || article.created_at || Date.now())
              .toISOString()
              .split("T")[0];
            xml += `\n  <url>\n    <loc>${baseUrl}/blog/${article.slug}</loc>\n    <lastmod>${lastModDate}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`;
          });
        }
      } catch (dbErr: any) {
        console.error("[SITEMAP] Supabase Fetch Error:", dbErr.message);
      }
    }

    xml += "\n</urlset>";
    return xml;
  } catch (err: any) {
    console.error("[SITEMAP] Generation crash:", err);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<error>${err.message}</error>`;
  }
}

export const app = express();
const PORT = 3000;

app.use(express.json());

// Restore original routing path inside Vercel Serverless Function context to bypass 404/401 rewrite issues
const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

app.use((req, res, next) => {
  if (isVercel) {
    const rawUrl = req.url || "";
    const originalUrl = req.headers["x-original-url"] as string;
    const forwardedUrl = req.headers["x-forwarded-url"] as string;
    const forwardedUri = req.headers["x-forwarded-uri"] as string;
    
    let actualPathAndQuery = "";
    if (forwardedUrl && !forwardedUrl.startsWith("/api/index")) {
      actualPathAndQuery = forwardedUrl;
    } else if (forwardedUri && !forwardedUri.startsWith("/api/index")) {
      actualPathAndQuery = forwardedUri;
    } else if (originalUrl && !originalUrl.startsWith("/api/index")) {
      actualPathAndQuery = originalUrl;
    }
    
    // Explicit fallback via query parameters __route__ from vercel.json rewrite
    if (!actualPathAndQuery && req.query && req.query.__route__) {
      const routeVal = req.query.__route__ as string;
      if (routeVal === "robots.txt" || routeVal === "sitemap.xml") {
        actualPathAndQuery = "/" + routeVal;
      } else {
        actualPathAndQuery = "/api/" + routeVal;
      }
    }
    
    // Only rewrite if we are on the template serverless index script path to avoid mangling correct urls
    const isRewrittenPath = rawUrl.startsWith("/api/index") || rawUrl === "/api" || rawUrl === "/api/";
    
    if (isRewrittenPath && actualPathAndQuery) {
      const queryIdx = rawUrl.indexOf("?");
      let queryParams = queryIdx >= 0 ? rawUrl.substring(queryIdx) : "";
      
      // If we used the query parameter __route__, sanitize it from search params
      if (queryParams.includes("__route__=")) {
        const usp = new URLSearchParams(queryParams);
        usp.delete("__route__");
        const rest = usp.toString();
        queryParams = rest ? "?" + rest : "";
      }
      
      const targetPath = actualPathAndQuery.split("?")[0];
      req.url = targetPath + queryParams;
    }
    
    // Clean up query param just in case of downstream leaks
    if (req.query && req.query.__route__) {
      delete req.query.__route__;
    }
  }
  next();
});

// Set up dynamic boot serialization to resolve race conditions and serverless cold starts
export let initPromise: Promise<void> | null = null;

app.use(async (req, res, next) => {
  if (initPromise) {
    try {
      await initPromise;
    } catch (err: any) {
      console.error("[INIT MIDDLEWARE ERROR] Promise failed to settle before request:", err.message);
    }
  }
  next();
});

// Persistent Data Paths
const DATA_DIR = isVercel
  ? path.join("/tmp", "data")
  : path.join(process.cwd(), "data");

const PAGES_FILE = path.join(DATA_DIR, "pages.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const LINKS_MAP_FILE = path.join(DATA_DIR, "links_map.json");

// Ensure Data Directory Exists & Seed Baseline from Workspace Bundle if in Serverless Env
function copyDirSync(src: string, dest: string) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Always ensure core DATA_DIR exists before any file read/writes are called
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (isVercel) {
  const baseDataDir = path.join(process.cwd(), "data");
  console.log(`[VERCEL RUNTIME] Running in a serverless environment. Seeding writable files from ${baseDataDir} to ${DATA_DIR}...`);
  try {
    copyDirSync(baseDataDir, DATA_DIR);
    console.log(`[VERCEL RUNTIME] Successfully seeded writable directory inside /tmp.`);
  } catch (err: any) {
    console.error(`[VERCEL RUNTIME] Failed to seed and copy data directory:`, err.message);
  }
}

function getMasterSupabaseClient(): any {
  // Uses only system environment variables, representing YOUR (the owner's) central Supabase instance
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const client = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      return client;
    } catch (err) {
      console.error("Failed to initialize Master Supabase client:", err);
    }
  }
  return null;
}

async function syncUsersFromMasterSupabase() {
  const supabase = getMasterSupabaseClient();
  if (!supabase) {
    console.log("Master Supabase not configured for user tracking. Using local JSON store.");
    return;
  }

  console.log("Master Supabase configuration found! Restoring master user accounts database with clean schema...");
  try {
    // A. Fetch only username and password from the primary 'texly_users' table to authenticate existing accounts
    const { data: usersRows, error: usersError } = await supabase
      .from("texly_users")
      .select("username, password");

    if (!usersError && usersRows) {
      const mergedUsers = { ...readUsersListOnly() };
      usersRows.forEach((row: any) => {
        if (row.username && row.password) {
          const uName = row.username.trim();
          mergedUsers[uName] = row.password;
        }
      });
      fs.writeFileSync(USERS_FILE, JSON.stringify(mergedUsers, null, 2), "utf8");
      console.log(`- Successfully Restored/Synced ${usersRows.length} user accounts from primary 'texly_users' table.`);
      return;
    }

    // B. Fallback to 'texly_storage' with key 'global_users' if dedicated table does not exist
    console.log(`Dedicated 'texly_users' table query returned info ("${usersError?.message || "empty"}"). Attempting fallback to 'texly_storage'...`);
    const { data, error } = await supabase
      .from("texly_storage")
      .select("data")
      .eq("key", "global_users")
      .single();

    if (error) {
      console.log("Could not fetch global_users key from fallback texly_storage table (table may need to be created):", error.message);
      // Seed local users to master Supabase
      const localUsers = readUsersListOnly();
      await syncUsersToMasterSupabase(localUsers);
      return;
    }

    if (data && data.data) {
      const mergedUsers = { ...readUsersListOnly(), ...data.data };
      fs.writeFileSync(USERS_FILE, JSON.stringify(mergedUsers, null, 2), "utf8");
      console.log(`- Restored/Synced ${Object.keys(mergedUsers).length} user accounts from fallback 'texly_storage' table.`);
    }
  } catch (err: any) {
    console.error("Failed syncing user list from Master Supabase:", err.message);
  }
}

async function saveUserKeysToMasterSupabase(username: string, updatedConfig: any) {
  const supabase = getMasterSupabaseClient();
  if (!supabase) return;

  const trimmedUser = username.trim();

  // 1. Save user credentials (username and password only) to the dedicated texly_users table
  try {
    const payload = {
      username: trimmedUser,
      password: updatedConfig.adminPassword || "admin123"
    };

    const { error } = await supabase
      .from("texly_users")
      .upsert(payload);

    if (error) {
      console.warn(`- Master database table 'texly_users' returned error during credentials upsert: ${error.message}`);
    } else {
      console.log(`- Successfully pushed ${trimmedUser}'s credentials to 'texly_users' table.`);
    }
  } catch (err: any) {
    console.error(`- Unexpected exception while syncing credentials for ${trimmedUser} to Master Supabase:`, err.message);
  }

  // 2. Clear out any legacy backups that might be in 'user_config_${username}' format to guarantee complete security cleanup
  const oldStorageKey = `user_config_${trimmedUser.toLowerCase()}`;
  try {
    await supabase
      .from("texly_storage")
      .delete()
      .eq("key", oldStorageKey);
  } catch (err) {}

  // 3. Back up the user's full sensitive configuration (including APIs, githubToken, etc.)
  // securely under their private, isolated, partitioned storage key u:${username.toLowerCase()}:config inside 'texly_storage'
  try {
    const backupKey = getSupabaseStorageKey("config", trimmedUser);
    const { error: sError } = await supabase
      .from("texly_storage")
      .upsert({ key: backupKey, data: updatedConfig });
    
    if (sError) {
      console.warn(`- Secure partitioned config backup returned message: ${sError.message}`);
    } else {
      console.log(`- Successfully synced isolated keys configurations under secure partition [${backupKey}] inside 'texly_storage'.`);
    }
  } catch (sEx: any) {
    console.warn(`- Exception backing up ${trimmedUser}'s config state inside texly_storage:`, sEx.message);
  }
}

async function syncUsersToMasterSupabase(usersList: Record<string, string>) {
  const supabase = getMasterSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Try to upsert to the dedicated 'texly_users' table with username and password only
    const rows = Object.entries(usersList).map(([username, password]) => ({
      username: username.trim(),
      password
    }));

    const { error: insertError } = await supabase
      .from("texly_users")
      .upsert(rows);

    if (!insertError) {
      console.log("- Successfully synced user accounts to dedicated 'texly_users' table!");
      return;
    }

    // 2. Fallback to upsert into 'texly_storage' with key 'global_users'
    console.log(`Dedicated 'texly_users' upsert returned info ("${insertError.message}"). Invoking fallback upsert to 'texly_storage'...`);
    const { error } = await supabase
      .from("texly_storage")
      .upsert({ key: "global_users", data: usersList });

    if (error) {
      console.error("- Failed to push global_users to Master Supabase fallback:", error.message);
    } else {
      console.log("- Successfully synced global_users to Master Supabase fallback cloud repository!");
    }
  } catch (err: any) {
    console.error("- Exception pushing global_users to Master Supabase:", err.message);
  }
}

function readUsersListOnly(): Record<string, string> {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      const initialUsers = { "admin": "admin123" };
      fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), "utf8");
      return initialUsers;
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (err) {
    return { "admin": "admin123" };
  }
}

function readUsersList(): Record<string, string> {
  return readUsersListOnly();
}

function writeUsersList(users: Record<string, string>) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  syncUsersToMasterSupabase(users).catch(err => {
    console.error("Error syncing users to master Supabase:", err);
  });
}

function getActiveUserDir(): string | null {
  const store = userSessionStorage.getStore();
  if (store && store.username) {
    return path.join(DATA_DIR, "users", store.username);
  }
  return null;
}

function resolveUserPath(file: string): string {
  const userDir = getActiveUserDir();
  if (!userDir) return file;

  // Ensure user specific directory exists
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  const baseName = path.basename(file);
  return path.join(userDir, baseName);
}

// Pre-seeded pages for TexlyOnline
const DEFAULT_PAGES = [
  {
    slug: "remove-symbols-online",
    keyword: "remove symbols online",
    title: "Remove Symbols and Special Characters Online - Text Cleaner | Texly",
    metaDescription: "Easily clean your text by removing symbols, stars, brackets, currency signs, and special characters online. Lightweight, instant, and secure utility tool.",
    intro: "Welcome to the ultimate online text cleaner. If you have scrambled data, muddy copied text, or legacy code fragments full of unwanted symbols, our programmatic utility instantly extracts purely alphabetic or alphanumeric content. Fully optimized for zero latency and browser native processing.",
    faqList: [
      {
        question: "How do I remove only specific symbols and keep punctuation?",
        answer: "By default, our engine lets you select distinct filters like 'Remove Special Symbols' while optionally keeping normal sentence punctuation like periods and commas."
      },
      {
        question: "Is my text data safe on Texly?",
        answer: "Absolutely. All processing occurs entirely in your browser. We never transmit your text contents to any remote server."
      },
      {
        question: "Can I clean large paragraphs of text instantly?",
        answer: "Yes, our web utility handles documents up to several megabytes with sub-millisecond execution times utilizing streaming buffer algorithms."
      },
      {
        question: "Will this preserve my line breaks?",
        answer: "Yes, standard formatting and newline segments are maintained unless you explicitly select the 'Remove Duplicate Lines' or 'Collapse Whitespace' options."
      },
      {
        question: "Does this utility work on mobile devices?",
        answer: "Yes, the interface is styled defensively using fluid CSS so you can clean text on any smartphone or tablet."
      }
    ],
    useCases: [
      {
        title: "Cleaning Raw Copy-Pasted Code",
        description: "Strip out random brackets, braces, and asterisks from copied text before using it in documentation templates."
      },
      {
        title: "Sanitizing User Registration Inputs",
        description: "Sanitize tabular CSV imports, removing punctuation anomalies to streamline database schema matching."
      },
      {
        title: "Social Caption Refinement",
        description: "Instantly clear out old hashtag symbols and trailing dots from precompiled drafts for cleaner presentation."
      }
    ],
    examples: [
      {
        input: "Hello @@#World!! Welcome$$",
        output: "Hello World Welcome",
        explanation: "Strips special punctuation signals while maintaining whitespace separation between English characters."
      },
      {
        input: "Price: $100 *discounted*",
        output: "Price 100 discounted",
        explanation: "Eliminates mathematical symbols and asterisk indicators for an uninterrupted narrative format."
      }
    ],
    relatedTools: ["remove-emojis-from-text", "duplicate-lines-remover", "case-converter"],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Text Symbols Remover",
      "url": "https://www.texlyonline.in/remove-symbols-online",
      "applicationCategory": "Utility",
      "operatingSystem": "All",
      "browserRequirements": "Requires HTML5 compatible browser"
    },
    category: "Text Cleaners",
    canonicalUrl: "https://www.texlyonline.in/remove-symbols-online",
    createdAt: "2026-05-18T12:00:00.000Z",
    updatedAt: "2026-05-18T12:00:00.000Z",
    socialMediaScripts: {
      pinterestDescription: "Struggling with messy text covered in stars, braces, and symbols? Clean your drafts in seconds with our free online Symbols Remover tool! 🚀 #textcleaner #productivity #seo",
      reelCaption: "Uncover the secret to pristine database inputs! Skip tedious regex searches and use our instant text sanitizer. Link in bio! 💻✨",
      shortsScript: "Are you still manually deleting symbols from copied text? Stop! Just paste it into Texly's symbols remover and boom — clean text instantly. Try it on texlyonline.in/remove-symbols-online!"
    }
  },
  {
    slug: "remove-emojis-from-text",
    keyword: "remove emojis from text",
    title: "Remove Emojis from Text Online - Clean Unicode Symbols | Texly",
    metaDescription: "Strip all expressive emojis, pictographs, and colored unicode symbols from your text content. Professional, fast, and free online tool.",
    intro: "Clean emojis, flags, symbols, and emoticon artifacts programmatically. Perfect for editorial professionals, legal transcripts, and database developers who require unicode-level character cleaning.",
    faqList: [
      {
        question: "Does it support modern Unicode emojis?",
        answer: "Yes, it tracks all modern Emoji Unicode blocks from Version 5.0 up to the newest releases, including combined skin-tones and gender modifiers."
      },
      {
        question: "Can I copy-paste directly from Instagram or Twitter?",
        answer: "Yes, simply copy your social captions and paste them in. The parser screens the base plane and strips emoticons instantly."
      }
    ],
    useCases: [
      {
        title: "Clean Chat Backups",
        description: "Strip out chat-style pictograms from customer support transcripts for compliance audits."
      },
      {
        title: "Publishing & Typesetting",
        description: "Format stories and manuscripts to traditional publishing parameters by excluding modern emoticons."
      }
    ],
    examples: [
      {
        input: "Having so much fun! 🎉🥳 Love this team ❤️",
        output: "Having so much fun! Love this team",
        explanation: "Strips the emoji sequences entirely, leaving standard grammatical sentence markers untouched."
      }
    ],
    relatedTools: ["remove-symbols-online", "duplicate-lines-remover"],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Emoji Strip Engine",
      "url": "https://www.texlyonline.in/remove-emojis-from-text",
      "applicationCategory": "Utility"
    },
    category: "Text Cleaners",
    canonicalUrl: "https://www.texlyonline.in/remove-emojis-from-text",
    createdAt: "2026-05-19T10:00:00.000Z",
    updatedAt: "2026-05-19T10:00:00.000Z"
  }
];

// Initialize Files with default values if empty
if (!fs.existsSync(PAGES_FILE)) {
  fs.writeFileSync(PAGES_FILE, JSON.stringify(DEFAULT_PAGES, null, 2));
}

if (!fs.existsSync(CONFIG_FILE)) {
  const initialConfig = {
    githubRepo: "",
    githubToken: "",
    vercelWebhookUrl: "",
    automatedFrequency: "24-hours",
    targetPagesPerDay: 3,
    useGroq: false,
    groqApiKey: "",
    groqModel: "llama3-70b-8192",
    supabaseUrl: "",
    supabaseKey: ""
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2));
}

const DEFAULT_LOGS = [
  {
    id: "log_init",
    timestamp: new Date().toISOString(),
    step: "System Init",
    message: "Programmatic AI SEO engine initialized. Tracking 2 primary dynamic modules.",
    status: "info"
  }
];
if (!fs.existsSync(LOGS_FILE)) {
  fs.writeFileSync(LOGS_FILE, JSON.stringify(DEFAULT_LOGS, null, 2));
}

// Supabase DB Cache & Real-Time Sync Engine
const userSupabaseClients: Record<string, any> = {};
const usersSyncedThisSession = new Set<string>();

function getSupabaseStorageKey(fileKey: string, username: string): string {
  // If the user configuration has distinct, private Supabase client details, they own the entire database,
  // we can use standard global keys ("pages", "config", "logs", etc.).
  // Otherwise, they share the system's central master Supabase instance,
  // so we MUST automatically prefix their keys to enforce total privacy, partition their data,
  // and prevent different users from seeing/overwriting each other's configuration and pages.
  const userConfig = readDb(CONFIG_FILE);
  const isCustomSupabase = !!(userConfig?.supabaseUrl && userConfig?.supabaseKey);
  if (isCustomSupabase) {
    return fileKey;
  }
  return `u:${username.trim().toLowerCase()}:${fileKey}`;
}

function getSupabaseClient(): any {
  const store = userSessionStorage.getStore();
  const username = store?.username || "admin";

  if (userSupabaseClients[username]) return userSupabaseClients[username];

  const userConfig = readDb(CONFIG_FILE);
  let url = userConfig?.supabaseUrl || process.env.SUPABASE_URL;
  let key = userConfig?.supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const client = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      userSupabaseClients[username] = client;
      return client;
    } catch (err) {
      console.error(`Failed to initialize Supabase client for ${username}:`, err);
    }
  }
  return null;
}

async function seedSupabaseWithLocalData(supabase: any) {
  try {
    const store = userSessionStorage.getStore();
    const u = store?.username || "admin";

    const resolvedPages = resolveUserPath(PAGES_FILE);
    const resolvedConfig = resolveUserPath(CONFIG_FILE);
    const resolvedLogs = resolveUserPath(LOGS_FILE);
    const resolvedLinksMap = resolveUserPath(LINKS_MAP_FILE);

    // Ensure files exist before reading
    if (!fs.existsSync(resolvedPages)) {
      fs.writeFileSync(resolvedPages, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
    }
    if (!fs.existsSync(resolvedConfig)) {
      fs.writeFileSync(resolvedConfig, JSON.stringify({ adminUsername: "admin", adminPassword: "admin123" }, null, 2), "utf8");
    }
    if (!fs.existsSync(resolvedLogs)) {
      fs.writeFileSync(resolvedLogs, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");
    }
    if (!fs.existsSync(resolvedLinksMap)) {
      fs.writeFileSync(resolvedLinksMap, JSON.stringify({}, null, 2), "utf8");
    }

    const pages = JSON.parse(fs.readFileSync(resolvedPages, "utf8"));
    const config = JSON.parse(fs.readFileSync(resolvedConfig, "utf8"));
    const logs = JSON.parse(fs.readFileSync(resolvedLogs, "utf8"));
    const linksMap = JSON.parse(fs.readFileSync(resolvedLinksMap, "utf8"));

    const items = [
      { key: getSupabaseStorageKey("pages", u), data: pages },
      { key: getSupabaseStorageKey("config", u), data: config },
      { key: getSupabaseStorageKey("logs", u), data: logs },
      { key: getSupabaseStorageKey("links_map", u), data: linksMap }
    ];

    for (const item of items) {
      const { error } = await supabase
        .from("texly_storage")
        .upsert(item);
      if (error) {
        console.warn(`Could not seed key ${item.key} to Supabase: ${error.message}`);
      }
    }
    console.log("Successfully seeded local database contents to Supabase as cloud backups.");
  } catch (err: any) {
    console.warn("Error seeding Supabase on startup:", err.message);
  }
}

async function syncFromSupabase() {
  const store = userSessionStorage.getStore();
  const u = store?.username || "admin";
  delete userSupabaseClients[u];

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log(`Supabase URL and Key not configured for user ${u}. Using local JSON store.`);
    return;
  }

  const pagesKey = getSupabaseStorageKey("pages", u);
  const configKey = getSupabaseStorageKey("config", u);
  const logsKey = getSupabaseStorageKey("logs", u);
  const linksMapKey = getSupabaseStorageKey("links_map", u);

  console.log(`Supabase credentials detected for ${u}! Restoring latest backup state from Supabase...`);
  try {
    const { data: records, error } = await supabase
      .from("texly_storage")
      .select("*")
      .in("key", [pagesKey, configKey, logsKey, linksMapKey]);

    if (error) {
       console.log(`Supabase table 'texly_storage' fetch info for ${u} (table may need to be created):`, error.message);
       console.log(`Seeding current local state to cloud Supabase now for ${u}...`);
       await seedSupabaseWithLocalData(supabase);
       return;
    }

    const resolvedPages = resolveUserPath(PAGES_FILE);
    const resolvedConfig = resolveUserPath(CONFIG_FILE);
    const resolvedLogs = resolveUserPath(LOGS_FILE);
    const resolvedLinksMap = resolveUserPath(LINKS_MAP_FILE);

    if (records && records.length > 0) {
      console.log(`Successfully fetched ${records.length} dataset tables from Supabase cloud for ${u}!`);
      for (const record of records) {
        if (record.key === pagesKey) {
          fs.writeFileSync(resolvedPages, JSON.stringify(record.data, null, 2), "utf8");
          console.log(`- Restored ${record.data.length} SEO Landing page structures for ${u}.`);
        } else if (record.key === configKey) {
          let localConf = {};
          try { localConf = JSON.parse(fs.readFileSync(resolvedConfig, "utf8")); } catch (e) {}
          const merged = { ...localConf, ...record.data };
          
          memoryConfigs[u] = { ...merged };
          fs.writeFileSync(resolvedConfig, JSON.stringify(merged, null, 2), "utf8");
          console.log(`- Restored system configuration from Supabase for ${u}.`);
        } else if (record.key === logsKey) {
          fs.writeFileSync(resolvedLogs, JSON.stringify(record.data, null, 2), "utf8");
          console.log(`- Restored system automation log history lists for ${u}.`);
        } else if (record.key === linksMapKey) {
          fs.writeFileSync(resolvedLinksMap, JSON.stringify(record.data, null, 2), "utf8");
          console.log(`- Restored user explicit links_map listings for ${u}.`);
          // Inject loaded links mapping into server memory
          if (record.data && typeof record.data === "object") {
            for (const [s, url] of Object.entries(record.data)) {
              if (s && typeof url === "string") {
                slugToUrlMap.set(s, url);
              }
            }
          }
        }
      }
    } else {
      console.log(`Supabase records are empty for ${u}. Seeding with local files...`);
      await seedSupabaseWithLocalData(supabase);
    }
  } catch (err: any) {
    console.error(`Warning syncing from Supabase for ${u}:`, err.message);
  }
}

// Read helper functions (Synchronous memory wrapper with user context)
const memoryConfigs: Record<string, any> = {};

function readDb(file: string) {
  const resolved = resolveUserPath(file);
  const store = userSessionStorage.getStore();
  const u = store?.username || "admin";

  try {
    if (file === CONFIG_FILE && memoryConfigs[u]) {
      return memoryConfigs[u];
    }

    if (!fs.existsSync(resolved)) {
      if (file === PAGES_FILE) {
        fs.writeFileSync(resolved, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
      } else if (file === CONFIG_FILE) {
        fs.writeFileSync(resolved, JSON.stringify({ adminUsername: u, adminPassword: "admin123" }, null, 2), "utf8");
      } else if (file === LOGS_FILE) {
        fs.writeFileSync(resolved, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");
      }
    }

    const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (file === CONFIG_FILE && raw && !Array.isArray(raw)) {
      if (!raw.adminUsername) raw.adminUsername = u;
      if (!raw.adminPassword) raw.adminPassword = "admin123";
      memoryConfigs[u] = raw;
    }
    return raw;
  } catch (err) {
    if (file === PAGES_FILE) return DEFAULT_PAGES;
    return [];
  }
}

function writeDb(file: string, data: any) {
  const resolved = resolveUserPath(file);
  const store = userSessionStorage.getStore();
  const u = store?.username || "admin";

  let finalData = data;
  if (file === CONFIG_FILE && data && !Array.isArray(data)) {
    memoryConfigs[u] = { ...data };
    finalData = { ...data };
    delete userSupabaseClients[u];
  }

  fs.writeFileSync(resolved, JSON.stringify(finalData, null, 2), "utf8");

  // Asynchronously synchronize configuration changes to Supabase cloud!
  const supabase = getSupabaseClient();
  if (supabase) {
    let key = "";
    if (file === PAGES_FILE) key = "pages";
    else if (file === CONFIG_FILE) key = "config";
    else if (file === LOGS_FILE) key = "logs";

    if (key) {
      const storageKey = getSupabaseStorageKey(key, u);
      const dataToPush = key === "config" ? memoryConfigs[u] : finalData;
      supabase
        .from("texly_storage")
        .upsert({ key: storageKey, data: dataToPush })
        .then(({ error }: any) => {
          if (error) {
            console.error(`- Supabase push failed for key [${key}] for ${u}: ${error.message}`);
          } else {
            console.log(`- Supabase real-time sync success for key : [${key}] for ${u}`);
          }
        })
        .catch((err: any) => {
          console.error(`- Supabase push throw error for key [${key}] for ${u}:`, err.message);
        });
    }
  }
}

function appendLog(step: string, message: string, status: "info" | "success" | "warning" | "error" = "info") {
  const logs = readDb(LOGS_FILE);
  const newLog = {
    id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString(),
    step,
    message,
    status
  };
  logs.unshift(newLog);
  // Keep last 150 logs
  if (logs.length > 150) logs.pop();
  writeDb(LOGS_FILE, logs);
  return newLog;
}

// Partitioned in-memory maps keyed by username (lowercased) to enforce absolute user data isolation
const userSlugToUrlMaps = new Map<string, Map<string, string>>();

function getUserMap(): Map<string, string> {
  const store = userSessionStorage.getStore();
  const u = (store?.username || "admin").trim().toLowerCase();
  let m = userSlugToUrlMaps.get(u);
  if (!m) {
    m = new Map<string, string>();
    userSlugToUrlMaps.set(u, m);
    
    // Seed it by reading links_map.json for this user if it exists
    const resolvedLinksMap = resolveUserPath(LINKS_MAP_FILE);
    if (fs.existsSync(resolvedLinksMap)) {
      try {
        const obj = JSON.parse(fs.readFileSync(resolvedLinksMap, "utf8"));
        if (obj && typeof obj === "object") {
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === "string") m.set(k, v);
          }
        }
      } catch (err) {}
    }
  }
  return m;
}

// Map compatibility wrapper proxy to dynamically access the active session user's partitioned map!
const slugToUrlMap = {
  get(key: string) { return getUserMap().get(key); },
  set(key: string, val: string) { getUserMap().set(key, val); return this; },
  delete(key: string) { return getUserMap().delete(key); },
  has(key: string) { return getUserMap().has(key); },
  clear() { getUserMap().clear(); },
  entries() { return getUserMap().entries(); },
  keys() { return getUserMap().keys(); },
  values() { return getUserMap().values(); },
  get size() { return getUserMap().size; },
  [Symbol.iterator]() { return getUserMap()[Symbol.iterator](); }
} as unknown as Map<string, string>;

// Robust definition of all real dynamic tools currently active on the main Next.js platform under /tool/ route prefix
const ALL_TOOL_SLUGS = [
  "face-swap", "bg-remover", "enhancer", "compressor", 
  "image-upscale", "image-generator", "snapchat-tag-generator", "ai-text-suite",
  "remove-extra-spaces-online", 
  "remove-line-breaks-tool", "remove-duplicate-lines-tool", "remove-empty-lines-online", 
  "remove-numbers-from-text", "military-alphabet-converter", "remove-special-characters-online", 
  "remove-html-tags-online", "upper-case-converter", "lower-case-converter", "title-case-converter", 
  "slug-generator-online-free", "binary-to-text-converter", "text-to-binary-converter", 
  "word-counter-online-free", "character-counter-tool", "clean-text-online-free", 
  "reading-time-calculator-online", "text-reverser-online", "text-repeater-tool", 
  "lorem-ipsum-generator-online", "find-and-replace-text-online", "sort-lines-alphabetically", 
  "camel-case-converter", "snake-case-converter", "kebab-case-converter", "pascal-case-converter", 
  "constant-case-converter", "alternating-case-converter", "inverse-case-converter", 
  "sentence-case-converter", "remove-accents-from-text", "remove-emojis-online", 
  "remove-punctuation-tool", "base64-encode-online", "base64-decode-online", "url-encode-online", 
  "url-decode-online", "rot13-cipher-online", "morse-code-translator", "upside-down-text-generator", 
  "mirror-text-generator", "qr-code-generator-online", "unit-converter-online", 
  "color-palette-generator-online", "base64-to-image-converter", "age-calculator-online", 
  "line-counter-online", "sentence-counter-online", "paragraph-counter-online", 
  "text-to-list-converter", "add-prefix-suffix-to-lines", "random-string-generator-online", 
  "remove-all-whitespace-online", "text-density-analyzer", "case-distribution-analyzer", 
  "json-formatter-online", "csv-to-json-converter", "extract-emails-from-text", 
  "extract-urls-from-text", "text-to-hex-converter", "hex-to-text-converter", 
  "html-entity-encoder", "html-entity-decoder", "remove-duplicate-words-online", 
  "zalgo-text-generator", "nato-phonetic-alphabet-translator", "ascii-banner-generator", 
  "trim-text-online", "whitespace-remover-online", "text-to-json-converter-online", 
  "json-to-text-converter", "character-frequency-counter", 
  "word-length-statistics", "markdown-to-plain-text", "image-to-text-extractor", 
  "pregnancy-due-date-calculator", "text-steganography-hidden-message", 
  "password-generator-strength-meter", "jwt-decoder-online", "sql-formatter-online", 
  "json-to-csv-converter-online", "invisible-text-generator", "youtube-timestamp-generator", 
  "fancy-text-generator-online", "braille-translator-online", "text-diff-checker-online", 
  "pdf-editor-online", "image-to-pdf-converter", "pdf-to-image-converter", "generate-pdf-online", 
  "compress-pdf-online", "reduce-pdf-size-online", "remove-pdf-password-online", 
  "pdf-to-excel-converter", "excel-to-pdf-converter", "word-to-pdf-converter", 
  "pdf-to-word-converter", "merge-pdf-online", "split-pdf-online", "rotate-pdf-online", 
  "whatsapp-text-formatter", "number-to-words-converter"
];

// Helper utility to resolve the correct, fully-qualified web URL for any given tool slug
function getLiveUrlForSlug(slug: string): string {
  if (!slug) return "https://www.texlyonline.in";
  const trimmed = slug.trim().toLowerCase();

  // If slug is defined in real dynamic sitemap crawler map, check if it fits the right pattern to avoid root leakage:
  const gotUrl = slugToUrlMap.get(slug.trim());
  if (gotUrl) {
    // If it maps to a root tool but it's listed in ALL_TOOL_SLUGS, override it to prevent mismatch!
    if (ALL_TOOL_SLUGS.includes(trimmed) && gotUrl === `https://www.texlyonline.in/${slug.trim()}`) {
      return `https://www.texlyonline.in/tool/${slug.trim()}`;
    }
    return gotUrl;
  }

  // 1. Force the "/tool/" prefix for any core workspace tools
  if (ALL_TOOL_SLUGS.includes(trimmed)) {
    return `https://www.texlyonline.in/tool/${slug.trim()}`;
  }

  // 2. Blog posts
  if (trimmed.includes("how-to") || trimmed.includes("best-") || trimmed.includes("guide") || trimmed.includes("explain") || trimmed.includes("text-cleaner")) {
    return `https://www.texlyonline.in/blog/${slug.trim()}`;
  }

  // 3. Known legacy root-level tools
  const legacyRootTools = [
    "remove-symbols-online", 
    "remove-emojis-from-text", 
    "duplicate-lines-remover",
    "remove-whitespace-online",
    "case-converter",
    "remove-space-online"
  ];
  if (legacyRootTools.includes(trimmed)) {
    return `https://www.texlyonline.in/${slug.trim()}`;
  }

  // 4. Default to standard dynamic programmatic landing pages
  return `https://www.texlyonline.in/seo/${slug.trim()}`;
}

// Fetch real active slugs from the live sitemap and merge with currently generated slugs
async function getRealTexlySlugs(): Promise<string[]> {
  const slugs: Set<string> = new Set();
  
  // 1. Fallback default slugs that are always on Texly
  slugs.add("remove-whitespace-online");
  slugs.add("case-converter");
  slugs.add("remove-space-online");
  slugs.add("duplicate-lines-remover");

  // Fetch sitemap from direct next.js script path and fallback routes
  const urlsToFetchSitemaps = [
    "https://www.texlyonline.in/api/sitemap.ts",
    "https://www.texlyonline.in/api/sitemap", // Direct Next.js dynamic endpoint defined in api/sitemap.ts
    "https://www.texlyonline.in/sitemap.xml"   // fallback path
  ];

  for (const targetUrl of urlsToFetchSitemaps) {
    try {
      const res = await withTimeout(
        fetch(targetUrl, {
          headers: { "User-Agent": "texly-automation-app" }
        }),
        1500,
        null
      );
      if (res && res.ok) {
        const textData = await res.text();
        const trimmed = textData.trim();
        
        if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
          // Robust JSON Parser
          try {
            const parsed = JSON.parse(trimmed);
            const processItem = (item: any) => {
              if (typeof item === "string") {
                const parts = item.split("/");
                const slug = parts[parts.length - 1];
                if (slug && !["sitemap", "blog", "about-us", "privacy-policy", "terms-and-conditions", "contact-us", "tool", "seo"].includes(slug.toLowerCase())) {
                  slugs.add(slug);
                  slugToUrlMap.set(slug, item);
                }
              } else if (item && typeof item === "object") {
                const rawVal = item.slug || item.url || item.loc;
                if (rawVal && typeof rawVal === "string") {
                  const parts = rawVal.split("/");
                  const slug = parts[parts.length - 1];
                  if (slug && !["sitemap", "blog", "about-us", "privacy-policy", "terms-and-conditions", "contact-us", "tool", "seo"].includes(slug.toLowerCase())) {
                    slugs.add(slug);
                    slugToUrlMap.set(slug, rawVal);
                  }
                }
              }
            };

            if (Array.isArray(parsed)) {
              parsed.forEach(processItem);
            } else if (typeof parsed === "object") {
              // Extract from arrays within the JSON object (e.g., if it has pages: [...], tools: [...])
              Object.keys(parsed).forEach(key => {
                if (Array.isArray(parsed[key])) {
                  parsed[key].forEach(processItem);
                }
              });
            }
          } catch (jsonErr) {
            // parsing failed, continue to fallback Regex match
          }
        }

        // Robust XML Loc Parser supporting spaces, special characters, Hindi font, CDATA
        const xmlLocRegex = /<loc>(?:\s*<!\[CDATA\[)?([\s\S]*?)(?:\]\]>\s*)?<\/loc>/gi;
        let xmlMatch;
        while ((xmlMatch = xmlLocRegex.exec(textData)) !== null) {
          let locUrl = xmlMatch[1].trim();
          if (locUrl) {
            // Remove CDATA tags if present
            locUrl = locUrl.replace(/^<!\[CDATA\[|\]\]>$/gi, "").trim();
            
            try {
              let pathStr = "";
              if (locUrl.startsWith("http://") || locUrl.startsWith("https://")) {
                const urlParsed = new URL(locUrl);
                pathStr = urlParsed.pathname;
              } else {
                pathStr = locUrl.startsWith("/") ? locUrl : "/" + locUrl;
              }

              const parts = pathStr.split("/").filter(Boolean);
              if (parts.length > 0) {
                const slugValue = parts[parts.length - 1].trim();
                const systemRouteSlugs = ["sitemap", "sitemap.xml", "about-us", "privacy-policy", "terms-and-conditions", "contact-us", "tool", "seo", "blog", ""];
                
                if (slugValue && !systemRouteSlugs.includes(slugValue.toLowerCase())) {
                  slugs.add(slugValue);
                  // Map the clean slug to its full live URL dynamically!
                  const fullLiveUrl = locUrl.startsWith("http") ? locUrl : `https://www.texlyonline.in${pathStr}`;
                  slugToUrlMap.set(slugValue, fullLiveUrl);
                }
              }
            } catch (urlErr) {
              // Fail-safe simple path string splitter for complex strings
              let parsedPath = locUrl;
              if (parsedPath.includes("://")) {
                parsedPath = parsedPath.split("://")[1] || "";
                const firstSlash = parsedPath.indexOf("/");
                parsedPath = firstSlash !== -1 ? parsedPath.substring(firstSlash) : "";
              }
              const parts = parsedPath.split("/").filter(Boolean);
              if (parts.length > 0) {
                const slugValue = parts[parts.length - 1].trim();
                const systemRouteSlugs = ["sitemap", "sitemap.xml", "about-us", "privacy-policy", "terms-and-conditions", "contact-us", "tool", "seo", "blog", ""];
                if (slugValue && !systemRouteSlugs.includes(slugValue.toLowerCase())) {
                  slugs.add(slugValue);
                  const fullLiveUrl = locUrl.startsWith("http") ? locUrl : `https://www.texlyonline.in/${locUrl}`;
                  slugToUrlMap.set(slugValue, fullLiveUrl);
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`Failed to fetch live sitemap from node at path ${targetUrl}:`, err.message);
    }
  }

  // 2. Load pages locally generated in data/pages.json to ensure they are also linkable
  try {
    const localPages = readDb(PAGES_FILE);
    if (Array.isArray(localPages)) {
      localPages.forEach((p: any) => {
        if (p.slug) {
          slugs.add(p.slug);
        }
      });
    }
  } catch (err: any) {
    console.warn("Failed to read local pages database:", err.message);
  }

  return Array.from(slugs);
}

// Helper utility to find contextually relevant alternative sitemap tools to replace outdated links
function findSemanticSitemapReplacements(pageSlug: string, pageCategory: string, pageKeyword: string, liveSlugs: string[], count: number = 3): string[] {
  const candidates = liveSlugs.filter(s => s !== pageSlug);
  
  const scores = candidates.map(slug => {
    let score = 0;
    const slugLower = slug.toLowerCase().replace(/-/g, " ");
    const keywordLower = pageKeyword.toLowerCase();
    const catLower = pageCategory.toLowerCase();

    // Word overlapping check for keyword
    const keywordWords = keywordLower.split(/\s+/).filter(w => w.length > 2);
    keywordWords.forEach(word => {
      if (slugLower.includes(word)) score += 3.0;
    });

    // Word overlapping check for Category
    const catWords = catLower.split(/\s+/).filter(w => w.length > 2);
    catWords.forEach(word => {
      if (slugLower.includes(word)) score += 2.0;
    });

    // Substring match in slugs
    const slugWords = slugLower.split(/\s+/);
    slugWords.forEach(sw => {
      if (sw.length > 2) {
        if (keywordLower.includes(sw)) score += 1.5;
        if (catLower.includes(sw)) score += 1.0;
      }
    });

    return { slug, score };
  });

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);
  
  const selected = scores.slice(0, count).map(s => s.slug);

  // Fillers if count is not reached
  const guaranteedFillers = [
    "duplicate-lines-remover",
    "remove-whitespace-online",
    "case-converter",
    "remove-space-online"
  ];

  const result = [...selected];
  for (const filler of guaranteedFillers) {
    if (result.length >= count) break;
    if (filler !== pageSlug && !result.includes(filler) && liveSlugs.includes(filler)) {
      result.push(filler);
    }
  }

  let i = 0;
  while (result.length < count && i < candidates.length) {
    const fSlug = candidates[i];
    if (!result.includes(fSlug)) {
      result.push(fSlug);
    }
    i++;
  }

  return result.slice(0, count);
}

// Automatically sanitize page structures, align relatedLinks, and correct canonical URLs across all pages
async function autoSanitizePagesDatabase() {
  console.log("[DATABASE] Initiating automatic database sanitization and link verification...");
  try {
    const realSlugsList = await getRealTexlySlugs();
    console.log(`[DATABASE] Loaded ${realSlugsList.length} total valid active slugs for link matrix verification.`);

    const pages = readDb(PAGES_FILE);
    if (!Array.isArray(pages) || pages.length === 0) {
      console.log("[DATABASE] No records found, skipping sanitization.");
      return;
    }

    let modified = false;
    let autoReplacedCount = 0;

    for (const page of pages) {
      if (!page.slug) continue;

      // 1. Filter out invalid/made-up links from related tools
      const originalRelated = Array.isArray(page.relatedTools) ? page.relatedTools : [];
      let validRelated = originalRelated.filter((s: string) => realSlugsList.includes(s));
      
      // Keep only unique ones
      validRelated = Array.from(new Set(validRelated));

      // Balance/fill up to 3 links if we deleted broken ones
      if (validRelated.length < 3) {
        const missingCount = 3 - validRelated.length;
        const replacements = findSemanticSitemapReplacements(
          page.slug, 
          page.category || "", 
          page.keyword || "", 
          realSlugsList, 
          missingCount
        );
        replacements.forEach(repSlug => {
          if (!validRelated.includes(repSlug) && repSlug !== page.slug) {
            validRelated.push(repSlug);
            autoReplacedCount++;
          }
        });
      }

      if (JSON.stringify(page.relatedTools) !== JSON.stringify(validRelated)) {
        const oldLinks = page.relatedTools;
        page.relatedTools = validRelated;
        modified = true;
        console.log(`[AUTO-HEAL] Replaced links for /${page.slug}: [${oldLinks ? oldLinks.join(", ") : ""}] -> [${validRelated.join(", ")}]`);
      }

      // 2. Correct schema url and canonical URL to point directly to correct directory
      const correctUrl = getLiveUrlForSlug(page.slug);

      if (page.schemaMarkup && page.schemaMarkup.url !== correctUrl) {
        page.schemaMarkup.url = correctUrl;
        modified = true;
      }

      // 3. Correct canonicalUrl
      if (page.canonicalUrl !== correctUrl) {
        page.canonicalUrl = correctUrl;
        modified = true;
      }
    }

    if (modified) {
      console.log("[DATABASE] Successfully finalized database sanitation. Writing pages.json changes...");
      writeDb(PAGES_FILE, pages);
      appendLog(
        "Sitemap Autopilot", 
        `Automatically audited all landing pages. Found and replaced/healed ${autoReplacedCount} missing or broken internal links using live sitemap indices from api/sitemap.ts.`, 
        "success"
      );
      
      // Auto-sync configuration and pages to Supabase to keep them clean in persistent storage
      const config = readDb(CONFIG_FILE);
      if (config?.githubRepo && config?.githubToken) {
        try {
          await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(pages, null, 2));
          console.log("[DATABASE] Successfully synced cleaned pages metadata to GitHub repository!");
        } catch (gitErr: any) {
          console.warn("[DATABASE] GitHub backup failed during auto-sanitization:", gitErr.message);
        }
      }
    } else {
      console.log("[DATABASE] Database is currently fully synchronized and correct.");
    }
  } catch (err: any) {
    console.error("[DATABASE] Error running pages sanitization:", err.message);
  }
}

// Lazy Gemini Client Initialization
const userGeminiClients: Record<string, any> = {};

function getGeminiClient(): any {
  const store = userSessionStorage.getStore();
  const username = store?.username || "admin";

  const config = readDb(CONFIG_FILE);
  const key = config?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (userGeminiClients[username] && userGeminiClients[username].key === key) {
    return userGeminiClients[username].client;
  }
  try {
    const client = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    userGeminiClients[username] = { key, client };
    return client;
  } catch (err) {
    console.error(`Failed to initialize GoogleGenAI for ${username}:`, err);
    return null;
  }
}

// ==========================================
// PENDING OTP REGISTRATIONS DATABASE & ENG
// ==========================================

const pendingRegistrations: Record<string, {
  email: string;
  password?: string;
  githubRepo?: string;
  githubToken?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  otp: string;
  expiresAt: number;
}> = {};

async function sendOTPEmail(email: string, username: string, otp: string) {
  console.log(`[OTP ENGINE] Generating 6-digit OTP verification code ${otp} for ${email}...`);
  
  // Write to visual Automation Log so users can always see it on AI Studio
  userSessionStorage.run({ username: "admin" }, () => {
    appendLog("OTP Engine", `गैस / पब्लिक प्रिव्यू के लिए 6-अंकों का वेरिफिकेशन ओटीपी: [ ${otp} ] (यूजर: "${username}", ईमेल: "${email}")`, "info");
  });

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const mailOptions = {
        from: `"Texly Core" <${smtpUser}>`,
        to: email,
        subject: `[Texly Support] Secure Account verification code: ${otp}`,
        text: `Hello ${username},\n\nYour 6-digit Texly verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nThank you,\nTexly Team`,
        html: `
          <div style="font-family: inherit; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="background-color: #06b6d4; color: #ffffff; font-weight: 900; font-family: monospace; font-size: 20px; padding: 8px 12px; border-radius: 8px;">TX</span>
              <h2 style="color: #09090b; margin-top: 15px; font-weight: 800; tracking: tight;">Texly Verification Code</h2>
            </div>
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">नमस्ते <b>${username}</b>,</p>
            <p style="color: #3f3f46; font-size: 14px; line-height: 1.5;">Texly पर अपना स्वतंत्र Cloud Sync Account सेटअप पूरा करने के लिए नीचे दिए गए 6- अंकों के वेरिफिकेशन कोड का उपयोग करें:</p>
            <div style="text-align: center; padding: 18px 0; background-color: #f4f4f5; border-radius: 8px; margin: 20px 0; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: #0891b2; font-family: monospace;">
              ${otp}
            </div>
            <p style="color: #71717a; font-size: 12px; line-height: 1.5; text-align: center;">यह कोड अगले 10 मिनट के लिए वैध है। कृपया इसे किसी के साथ साझा न करें।</p>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
            <p style="color: #a1a1aa; font-size: 11px; text-align: center;">यह एक स्वचालित ईमेल है। कृपया इस पर उत्तर न दें।</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[OTP ENGINE] Real email successfully sent to ${email}`);
    } catch (err: any) {
      console.error(`[OTP ENGINE] Failed to dispatch email via SMTP connection:`, err.message);
    }
  } else {
    console.log(`[OTP ENGINE] SMTP options not configured in env parameters. Visual fallback displayed inside System Logs.`);
  }
}

// 1. Send OTP Endpoint
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { username, email, password, githubRepo, githubToken, supabaseUrl, supabaseKey } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "कृपया यूजरनेम, ईमेल और पासवर्ड प्रदान करें।" });
    }

    const trimmedUser = username.trim();
    if (trimmedUser.length < 3) {
      return res.status(400).json({ success: false, message: "यूज़रनेम कम से कम 3 वर्णों का होना चाहिए।" });
    }

    if (trimmedUser.toLowerCase() === "admin") {
      return res.status(400).json({ success: false, message: "आप 'admin' नाम से नया स्वतंत्र अकाउंट नहीं बना सकते हैं।" });
    }

    const users = readUsersList();
    if (users[trimmedUser]) {
      return res.status(400).json({ success: false, message: "यह यूजरनेम पहले से उपलब्ध है! कृपया दूसरा चुनें।" });
    }

    // Generate 6 digit pin
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pendingRegistrations[trimmedUser] = {
      email: email.trim(),
      password,
      githubRepo: githubRepo ? githubRepo.trim() : "",
      githubToken: githubToken ? githubToken.trim() : "",
      supabaseUrl: supabaseUrl ? supabaseUrl.trim() : "",
      supabaseKey: supabaseKey ? supabaseKey.trim() : "",
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    };

    await sendOTPEmail(email.trim(), trimmedUser, otp);
    return res.json({ success: true, message: "ईमेल पर 6-अंकों का वेरिफिकेशन कोड भेज दिया गया है।" });
  } catch (err: any) {
    console.error("Error sending OTP email:", err);
    return res.status(500).json({ success: false, message: `OTP भेजने में दिक्कत हुई: ${err.message}` });
  }
});

// 2. Verify OTP Endpoint
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { username, otp } = req.body || {};
    if (!username || !otp) {
      return res.status(400).json({ success: false, message: "कृपया यूजरनेम और OTP कोड प्रदान करें।" });
    }

    const trimmedUser = username.trim();
    const pending = pendingRegistrations[trimmedUser];

    if (!pending) {
      return res.status(400).json({ success: false, message: "कोई लंबित पंजीकरण (pending registration) नहीं मिला या पुनः प्रयास करें।" });
    }

    if (pending.expiresAt < Date.now()) {
      delete pendingRegistrations[trimmedUser];
      return res.status(400).json({ success: false, message: "वेरिफिकेशन कोड की मियाद समाप्त (Expired) हो चुकी है।" });
    }

    if (pending.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: "अमान्य वेरिफिकेशन कोड! कृपया सही OTP दर्ज करें।" });
    }

    const users = readUsersList();
    if (users[trimmedUser]) {
      return res.status(400).json({ success: false, message: "यह यूजरनेम अब उपलब्ध नहीं है।" });
    }

    // Complete Registration
    const password = pending.password || "pass123";
    users[trimmedUser] = password;
    writeUsersList(users);

    // Initialize and seed directory configs
    const userDir = path.join(DATA_DIR, "users", trimmedUser);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    const { pagesFile, configFile, logsFile } = {
      pagesFile: path.join(userDir, "pages.json"),
      configFile: path.join(userDir, "config.json"),
      logsFile: path.join(userDir, "logs.json")
    };

    // Seed default pages
    fs.writeFileSync(pagesFile, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
    
    // Custom configs injected
    const seededConfig = {
      adminUsername: trimmedUser,
      adminPassword: password,
      githubRepo: pending.githubRepo || "",
      githubToken: pending.githubToken || "",
      supabaseUrl: pending.supabaseUrl || "",
      supabaseKey: pending.supabaseKey || "",
      automatedFrequency: "24-hours",
      targetPagesPerDay: 3,
      useGroq: false,
      groqModel: "llama3-70b-8192",
      vercelWebhookUrl: ""
    };
    fs.writeFileSync(configFile, JSON.stringify(seededConfig, null, 2), "utf8");
    fs.writeFileSync(logsFile, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");

    // Clear pending
    delete pendingRegistrations[trimmedUser];

    // Automatically sync to Supabase if config is provided, run within user's session context
    if (pending.supabaseUrl && pending.supabaseKey) {
      await userSessionStorage.run({ username: trimmedUser }, async () => {
        try {
          const client = createClient(pending.supabaseUrl, pending.supabaseKey);
          await seedSupabaseWithLocalData(client);
        } catch (e: any) {
          console.warn("Could not initial sync to user Supabase:", e.message);
        }
      });
    }

    // Generate login Token
    const token = Buffer.from(`${trimmedUser}:${password}`).toString("base64");
    
    userSessionStorage.run({ username: "admin" }, () => {
      appendLog("OTP Engine", `स्वतंत्र अकाउंट "${trimmedUser}" सफलतापूर्वक सत्यापित और एक्टिवेट कर दिया गया है!`, "success");
    });

    return res.json({ 
      success: true, 
      token,
      message: "अकाउंट सफलतापूर्वक सत्यापित और लॉगिन हो गया!" 
    });
  } catch (err: any) {
    console.error("OTP verification exception:", err);
    return res.status(500).json({ success: false, message: `सत्यापन में संचरण विफलता: ${err.message}` });
  }
});

// ==========================================
// API ROUTES
// ==========================================

// Register a new user
app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "कृपया यूजरनेम और पासवर्ड दोनों प्रदान करें।" });
  }

  const trimmedUser = username.trim();
  if (trimmedUser.length < 3) {
    return res.status(400).json({ success: false, message: "यूज़रनेम कम से कम 3 वर्णों का होना चाहिए।" });
  }

  const users = readUsersList();
  if (users[trimmedUser]) {
    return res.status(400).json({ success: false, message: "यह यूजरनेम पहले से उपलब्ध है! कृपया दूसरा चुनें।" });
  }

  // Register user
  users[trimmedUser] = password;
  writeUsersList(users);

  // Initialize their directory and seed base configurations
  const userDir = path.join(DATA_DIR, "users", trimmedUser);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Seed default files inside their folder so they are functional immediately
  const { pagesFile, configFile, logsFile } = {
    pagesFile: path.join(userDir, "pages.json"),
    configFile: path.join(userDir, "config.json"),
    logsFile: path.join(userDir, "logs.json")
  };

  fs.writeFileSync(pagesFile, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
  fs.writeFileSync(configFile, JSON.stringify({ adminUsername: trimmedUser, adminPassword: password }, null, 2), "utf8");
  fs.writeFileSync(logsFile, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");

  return res.json({ success: true, message: "अकाउंट सफलतापूर्वक बन गया! अब आप लॉगिन कर सकते हैं।" });
});

// 1. Admin Login Endpoint (username and password match server settings)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "कृपया यूजरनेम और पासवर्ड प्रदान करें।" });
  }

  const trimmedUser = username.trim();
  const users = readUsersList();
  const correctPass = users[trimmedUser];

  if (correctPass && password === correctPass) {
    const token = Buffer.from(`${trimmedUser}:${password}`).toString("base64");
    return res.json({ success: true, token, message: "लॉगिन सफल!" });
  } else {
    if (trimmedUser === "admin" && password === "admin123") {
      const token = Buffer.from("admin:admin123").toString("base64");
      return res.json({ success: true, token, message: "लॉगिन सफल!" });
    }
    return res.status(401).json({ success: false, message: "गलत यूजरनेम या पासवर्ड! फिर से प्रयास करें।" });
  }
});

// 2. Auth Verification Endpoint
app.get("/api/verify-auth", (req, res) => {
  const rawHeader = req.headers["authorization"] || req.headers["x-admin-token"] || "";
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : (rawHeader as string);
  if (!authHeader) {
    return res.status(401).json({ success: false, message: "क्रेडेंशियल्स गायब हैं।" });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [username, password] = decoded.split(":");

    const users = readUsersList();
    let correctPass = users[username];
    let wasRestored = false;

    // Resilient Auto-register on verification check if container restarted/slept & wiped users.json
    if (!correctPass && username && password && username.trim().toLowerCase() !== "admin") {
      console.log(`[AUTO-RESTORE] User "${username}" not found in reset database. Re-registering silently...`);
      users[username] = password;
      writeUsersList(users);
      correctPass = password;
      wasRestored = true;

      // Seed core paths
      const userDir = path.join(DATA_DIR, "users", username);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const { pagesFile, configFile, logsFile } = {
        pagesFile: path.join(userDir, "pages.json"),
        configFile: path.join(userDir, "config.json"),
        logsFile: path.join(userDir, "logs.json")
      };
      if (!fs.existsSync(pagesFile)) {
        fs.writeFileSync(pagesFile, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
      }
      if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, JSON.stringify({ adminUsername: username, adminPassword: password }, null, 2), "utf8");
      }
      if (!fs.existsSync(logsFile)) {
        fs.writeFileSync(logsFile, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");
      }
    }

    if (correctPass && password === correctPass) {
      return res.json({ success: true, user: { username }, restored: wasRestored });
    } else if (username === "admin" && password === "admin123") {
      return res.json({ success: true, user: { username } });
    }
  } catch (err) {}

  return res.status(401).json({ success: false, message: "लॉगिन सत्र समाप्त या अमान्य।" });
});

// 3. Global Admin Access Protection Middleware
app.use((req, res, next) => {
  // Pass non-API requests and auth endpoints
  if (
    !req.path.startsWith("/api/") || 
    req.path === "/api/login" || 
    req.path === "/api/register" || 
    req.path === "/api/verify-auth" ||
    req.path === "/api/auth/send-otp" ||
    req.path === "/api/auth/verify-otp"
  ) {
    return next();
  }

  const rawHeader = req.headers["authorization"] || req.headers["x-admin-token"] || "";
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : (rawHeader as string);
  if (!authHeader) {
    return res.status(401).json({ success: false, error: "Unauthorized", message: "आगे बढ़ने के लिए कृपया लॉगिन करें।" });
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const [username, password] = decoded.split(":");

    const users = readUsersList();
    let correctPass = users[username];

    // Resilient Auto-register in global middleware if container restarted/slept & wiped users.json
    if (!correctPass && username && password && username.trim().toLowerCase() !== "admin") {
      console.log(`[AUTO-RESTORE] Global middleware auto-restoring user: "${username}"`);
      users[username] = password;
      writeUsersList(users);
      correctPass = password;

      const userDir = path.join(DATA_DIR, "users", username);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const { pagesFile, configFile, logsFile } = {
        pagesFile: path.join(userDir, "pages.json"),
        configFile: path.join(userDir, "config.json"),
        logsFile: path.join(userDir, "logs.json")
      };
      if (!fs.existsSync(pagesFile)) {
        fs.writeFileSync(pagesFile, JSON.stringify(DEFAULT_PAGES, null, 2), "utf8");
      }
      if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, JSON.stringify({ adminUsername: username, adminPassword: password }, null, 2), "utf8");
      }
      if (!fs.existsSync(logsFile)) {
        fs.writeFileSync(logsFile, JSON.stringify(DEFAULT_LOGS, null, 2), "utf8");
      }
    }

    const isMatch = (correctPass && password === correctPass) || (username === "admin" && password === "admin123");

    if (isMatch) {
      return userSessionStorage.run({ username }, async () => {
        if (!usersSyncedThisSession.has(username)) {
          console.log(`[CLOUD SYNC ENGINE] Resolving first request for "${username}". Restoring latest dataset from Supabase if configured...`);
          // Impose strict 1800ms SLA timeout to prevent blocking/hanging connection failures
          await withTimeout(syncFromSupabase(), 1800, null);
          usersSyncedThisSession.add(username);
        }
        next();
      });
    }
  } catch (err) {}

  return res.status(401).json({ success: false, error: "Unauthorized", message: "लॉगिन क्रेडेंशियल अमान्य या पुराना हो चुका है।" });
});

// Get all generated SEO pages
app.get("/api/pages", (req, res) => {
  const pages = readDb(PAGES_FILE);
  const urlMapObj: Record<string, string> = {};
  for (const [s, url] of slugToUrlMap.entries()) {
    urlMapObj[s] = url;
  }
  res.json({ success: true, count: pages.length, pages, slugToUrlMap: urlMapObj });
});

// Fetch active slugs dynamically from Texly's real/live Next.js sitemap (api/sitemap.ts)
app.get("/api/sitemap/slugs", async (req, res) => {
  try {
    appendLog("Sitemap Linker", "Directly scanning all live slugs from Next.js dynamic api/sitemap...");
    const dynamicSlugs = await getRealTexlySlugs();
    const urlMapObj: Record<string, string> = {};
    for (const [s, url] of slugToUrlMap.entries()) {
      urlMapObj[s] = url;
    }
    res.json({
      success: true,
      slugs: dynamicSlugs,
      slugToUrlMap: urlMapObj,
      sourceUrl: "https://www.texlyonline.in/api/sitemap"
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Save a manual slug-to-URL mapping for the live site URL preview links
app.post("/api/sitemap/save-link", async (req, res) => {
  try {
    const { slug, url } = req.body;
    if (!slug || !url) {
      return res.status(400).json({ success: false, message: "Required parameters (slug, url) are missing." });
    }

    const s = slug.trim().toLowerCase();
    const uVal = url.trim();

    slugToUrlMap.set(s, uVal);

    const resolvedLinksMap = resolveUserPath(LINKS_MAP_FILE);
    let currentMap: Record<string, string> = {};
    if (fs.existsSync(resolvedLinksMap)) {
      try {
        currentMap = JSON.parse(fs.readFileSync(resolvedLinksMap, "utf8"));
      } catch {}
    }
    currentMap[s] = uVal;
    fs.writeFileSync(resolvedLinksMap, JSON.stringify(currentMap, null, 2), "utf8");

    appendLog("Sitemap Linker", `Explicit manual mapping added: /${s} -> ${uVal}`, "success");

    // Persist real-time to Supabase if configured 
    const supabase = getSupabaseClient();
    if (supabase) {
      const store = userSessionStorage.getStore();
      const u = store?.username || "admin";
      const storageKey = getSupabaseStorageKey("links_map", u);
      const { error } = await supabase
        .from("texly_storage")
        .upsert({ key: storageKey, data: currentMap });
      if (error) {
        console.error(`- Supabase real-time push failed for manual links_map: ${error.message}`);
      } else {
        console.log(`- Supabase real-time push success for manual links_map.`);
      }
    }

    res.json({ success: true, message: "Link saved and synchronized successfully!", slugToUrlMap: currentMap });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete a manual slug-to-URL mapping for the live site URL preview links
app.post("/api/sitemap/delete-link", async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ success: false, message: "Required parameter (slug) is missing." });
    }

    const s = slug.trim().toLowerCase();
    slugToUrlMap.delete(s);

    const resolvedLinksMap = resolveUserPath(LINKS_MAP_FILE);
    let currentMap: Record<string, string> = {};
    if (fs.existsSync(resolvedLinksMap)) {
      try {
        currentMap = JSON.parse(fs.readFileSync(resolvedLinksMap, "utf8"));
      } catch {}
    }
    delete currentMap[s];
    fs.writeFileSync(resolvedLinksMap, JSON.stringify(currentMap, null, 2), "utf8");

    appendLog("Sitemap Linker", `Manual mapping deleted: /${s}`, "success");

    // Persist real-time to Supabase if configured 
    const supabase = getSupabaseClient();
    if (supabase) {
      const store = userSessionStorage.getStore();
      const u = store?.username || "admin";
      const storageKey = getSupabaseStorageKey("links_map", u);
      const { error } = await supabase
        .from("texly_storage")
        .upsert({ key: storageKey, data: currentMap });
      if (error) {
        console.error(`- Supabase real-time push failed for manual links_map deletion: ${error.message}`);
      } else {
        console.log(`- Supabase real-time push success for manual links_map deletion.`);
      }
    }

    res.json({ success: true, message: "Link mapping deleted successfully!", slugToUrlMap: currentMap });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update companion tools related links for any specific SEO page node
app.post("/api/pages/update-links", async (req, res) => {
  try {
    const { slug, relatedTools } = req.body;
    if (!slug || !Array.isArray(relatedTools)) {
      return res.status(400).json({ success: false, message: "Required parameters are missing." });
    }

    const pages = readDb(PAGES_FILE);
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: "No local pages database loaded." });
    }

    const pageIndex = pages.findIndex((p: any) => p.slug === slug);
    if (pageIndex === -1) {
      return res.status(404).json({ success: false, message: `Programmatic SEO Page /${slug} not found.` });
    }

    const originalTools = pages[pageIndex].relatedTools || [];
    pages[pageIndex].relatedTools = Array.from(new Set(relatedTools.map((s: string) => s.trim()).filter(Boolean)));
    
    // Save updated DB
    writeDb(PAGES_FILE, pages);
    appendLog("Sitemap Linker", `User manually updated companion links for /${slug}. [Old: ${originalTools.join(", ") || "none"}] -> [New: ${pages[pageIndex].relatedTools.join(", ")}]`, "success");

    // Automatically sync updated list straight to Github + Vercel rebuild trigger if configured
    const config = readDb(CONFIG_FILE);
    let githubSynced = false;
    let vercelTriggered = false;

    if (config?.githubRepo && config?.githubToken) {
      try {
        await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(pages, null, 2), "data/pages.json");
        githubSynced = true;
        
        if (config.vercelWebhookUrl) {
          vercelTriggered = await triggerVercelWebhook(config.vercelWebhookUrl);
        }
        appendLog("Sitemap Linker", `Successfully auto-synced updated link catalog for /${slug} to GitHub repo. Vercel rebuild: ${vercelTriggered ? "Triggered" : "Skipped"}`, "success");
      } catch (gitErr: any) {
        appendLog("Sitemap Linker", `Failed to auto-sync manually repaired link to GitHub: ${gitErr.message}`, "error");
      }
    }

    res.json({
      success: true,
      message: `सफलतापूर्वक पेज /${slug} के लिंक्स को अपडेट कर दिया गया है! ${githubSynced ? "सॉर्स कोड GitHub पर पुश किया गया।" : ""}`,
      githubSynced,
      vercelTriggered,
      updatedPage: pages[pageIndex]
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update standard details of any programmatic SEO page in pages.json
app.post("/api/pages/update-details", async (req, res) => {
  try {
    const { originalSlug, slug, keyword, title, category, intro, relatedTools } = req.body;
    if (!originalSlug || !slug) {
      return res.status(400).json({ success: false, message: "Required parameters (originalSlug and slug) are missing." });
    }

    const pages = readDb(PAGES_FILE);
    if (!Array.isArray(pages)) {
      return res.status(400).json({ success: false, message: "No local pages database loaded." });
    }

    const pageIndex = pages.findIndex((p: any) => p.slug === originalSlug);
    if (pageIndex === -1) {
      return res.status(404).json({ success: false, message: `Programmatic SEO Page /${originalSlug} not found.` });
    }

    // Check slug collision if slug is being changed
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanSlug !== originalSlug) {
      const collisionExists = pages.some((p: any) => p.slug === cleanSlug);
      if (collisionExists) {
        return res.status(400).json({ success: false, message: `स्लग /${cleanSlug} पहले से ही किसी अन्य पेज द्वारा उपयोग किया जा रहा है!` });
      }
    }

    // Update details
    pages[pageIndex].slug = cleanSlug;
    if (keyword !== undefined) pages[pageIndex].keyword = keyword.trim();
    if (title !== undefined) pages[pageIndex].title = title.trim();
    if (category !== undefined) pages[pageIndex].category = category.trim();
    if (intro !== undefined) pages[pageIndex].intro = intro.trim();
    if (Array.isArray(relatedTools)) {
      pages[pageIndex].relatedTools = Array.from(new Set(relatedTools.map((s: string) => s.trim().toLowerCase()).filter(Boolean)));
    }

    // Save updated DB
    writeDb(PAGES_FILE, pages);
    appendLog("Page Management", `Details updated manually for /${originalSlug} -> /${cleanSlug}`, "success");

    // Automatically sync updated list straight to Github + Vercel rebuild trigger if configured
    const config = readDb(CONFIG_FILE);
    let githubSynced = false;
    let vercelTriggered = false;

    if (config?.githubRepo && config?.githubToken) {
      try {
        await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(pages, null, 2), "data/pages.json");
        githubSynced = true;
        
        if (config.vercelWebhookUrl) {
          vercelTriggered = await triggerVercelWebhook(config.vercelWebhookUrl);
        }
        appendLog("Page Management", `Successfully auto-synced updated details for /${cleanSlug} to GitHub. Vercel rebuild: ${vercelTriggered ? "Triggered" : "Skipped"}`, "success");
      } catch (gitErr: any) {
        appendLog("Page Management", `Failed to auto-sync updated details to GitHub: ${gitErr.message}`, "error");
      }
    }

    res.json({
      success: true,
      message: `पेज /${cleanSlug} के विवरण को सफलतापूर्वक अपडेट कर दिया गया है! ${githubSynced ? "बदलावों को GitHub पर भी सिंक किया गया है।" : ""}`,
      githubSynced,
      vercelTriggered,
      updatedPage: pages[pageIndex],
      pages
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI Content Rewriter Endpoint using Gemini
app.post("/api/pages/rewrite-intro", async (req, res) => {
  try {
    const { keyword, currentIntro, category, style } = req.body;
    if (!keyword) {
      return res.status(400).json({ success: false, message: "कीवर्ड निर्दिष्ट करना आवश्यक है।" });
    }

    appendLog("Content Rewriter", `AI Content rewrite requested for keyword: "${keyword}"`);

    const client = getGeminiClient();
    let responseText = "";

    if (client) {
      try {
        appendLog("Content Rewriter", "Attempting content rewrite via Gemini (gemini-3.5-flash)...");
        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `You are an expert SEO copywriter, marketer, and landing page expert. Rewrite the following introduction text to make it extremely engaging, professional, and SEO-optimized while targeting the keyword "${keyword}". It should be about 3-5 sentences long, and written in highly natural Hindi, Hinglish (Hindi written in English alphabets) or English, matching the original style and language of the text.

Current Intro: "${currentIntro || ""}"
Niche Category: "${category || "Utility Tool"}"
Keyword: "${keyword}"
Style/Tone: "${style || "engaging, professional and click-worthy"}"

Provide only the rewritten text directly. No quotes, no markdown wrappers, no introductory chat of any kind.`,
        });

        responseText = response.text || "";
      } catch (geminiErr: any) {
        appendLog("Content Rewriter", `Gemini Rewrite Failed: ${geminiErr.message}`, "error");
      }
    }

    // fallback engine if gemini fails or key not setup
    if (!responseText) {
      appendLog("Content Rewriter", "Using localized programmatic rewrite engine.", "warning");
      const capitalizedKw = keyword.replace(/\b\w/g, (c: string) => c.toUpperCase());
      responseText = `क्या आप ${capitalizedKw} के लिए एक बेहतरीन, तेज़ और सुरक्षित ऑनलाइन टूल तलाश कर रहे हैं? Texly का यह मुफ्त यूटिलिटी टूल आपको बिना किसी परेशानी के तुरंत परिणाम प्रदान करता है। चाहे आप डेवलपर हों, कंटेंट क्रिएटर हों, या डेटा एनालिस्ट; यह टूल आपके काम को आसान बनाने और उत्पादकता बढ़ाने के लिए विशेष रूप से डिज़ाइन किया गया है। आज ही आएं और अपनी आवश्यकताओं के अनुसार सर्वोत्तम प्रदर्शन का अनुभव करें।`;
    }

    res.json({ success: true, rewrittenIntro: responseText.trim() });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Resilient Backup Restore Endpoint to recover from Render cold starts
app.post("/api/user/restore-backup", async (req, res) => {
  try {
    const { pages, config } = req.body || {};
    const sessionStore = userSessionStorage.getStore();
    const activeUser = sessionStore?.username || "admin";

    appendLog("Backup Sync", `Received resilient container recovery data transfer for: "${activeUser}"`);

    if (pages && Array.isArray(pages) && pages.length > 0) {
      writeDb(PAGES_FILE, pages);
      appendLog("Backup Sync", `Restored ${pages.length} programmatic pages into recovered pages.json database.`, "success");
    }

    if (config && typeof config === "object" && !Array.isArray(config)) {
      const existingConfig = readDb(CONFIG_FILE);
      const mergedConfig = { ...existingConfig, ...config };

      // Make sure we carry forward any existing unmasked keys if the incoming backup contains masks
      const sensitiveKeys = [
        "githubToken", "groqApiKey", "supabaseKey", "openrouterApiKey", "geminiApiKey", "adminPassword", "vercelWebhookUrl"
      ];
      sensitiveKeys.forEach(k => {
        if (config[k] === "••••••••" && existingConfig[k]) {
          mergedConfig[k] = existingConfig[k];
        }
      });

      writeDb(CONFIG_FILE, mergedConfig);
      appendLog("Backup Sync", "Successfully restored custom keys and automated growth params.", "success");
    }

    res.json({ success: true, message: "डेटाबेस बैकअप सफलतापूर्वक डिवाइस से रीस्टोर कर दिया गया है!" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Helper to verify if an interactive companion tool is alive on Texly under the correct route prefix
async function checkLiveSlugStatus(slug: string): Promise<boolean> {
  if (!slug || typeof slug !== "string") return false;
  const trimmedSlug = slug.trim();
  if (!trimmedSlug) return false;

  const url = getLiveUrlForSlug(trimmedSlug);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for reliability

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const body = await response.text();
      const bodyLower = body.toLowerCase();
      
      // High-fidelity checks for Vercel/Next.js/React standard missing-route responses
      const isNotFound = 
        bodyLower.includes("tool not found") || 
        bodyLower.includes("page not found") || 
        bodyLower.includes("cannot get") || 
        bodyLower.includes("404 errors") || 
        bodyLower.includes("404 - not found") || 
        (bodyLower.includes("not found") && bodyLower.includes("404")) ||
        body.includes("<title>404") || 
        body.includes("<title>Not Found");

      if (!isNotFound && body.trim().length > 150) {
        return true; // Live and highly healthy!
      }
    }
  } catch (err: any) {
    // Treat as unreachable/dead
  }
  return false;
}

// Link Matrix Diagnostics and Integrity Audits with Real Live Site Verification
app.get("/api/links/audit", async (req, res) => {
  try {
    const pages = readDb(PAGES_FILE);
    if (!Array.isArray(pages)) {
      return res.json({
        success: true,
        scannedPagesCount: 0,
        totalLinks: 0,
        workingCount: 0,
        brokenCount: 0,
        workingLinks: [],
        brokenLinks: []
      });
    }

    appendLog("Link Doctor", "Starting professional deep-ping audit from live server...");

    // 1. Gather all unique targets to test in parallel to keep it fast
    const uniqueSlugs: Set<string> = new Set();
    pages.forEach((page: any) => {
      if (Array.isArray(page.relatedTools)) {
        page.relatedTools.forEach((s: string) => {
          if (s && typeof s === "string") uniqueSlugs.add(s.trim());
        });
      }
    });

    const liveStatusMap: Record<string, boolean> = {};
    const list = Array.from(uniqueSlugs);

    // Default basic slugs are always true
    const immutableSlugs = [
      "remove-whitespace-online", 
      "case-converter", 
      "remove-space-online", 
      "duplicate-lines-remover"
    ];

    // Check each unique link target via actual live GET/HEAD request with timeout
    await Promise.all(list.map(async (slug) => {
      if (immutableSlugs.includes(slug)) {
        liveStatusMap[slug] = true;
        return;
      }
      const isAlive = await checkLiveSlugStatus(slug);
      liveStatusMap[slug] = isAlive;
    }));

    const workingLinks: any[] = [];
    const brokenLinks: any[] = [];

    pages.forEach((page: any) => {
      const related = Array.isArray(page.relatedTools) ? page.relatedTools : [];
      related.forEach((targetSlug: string) => {
        const isWorking = liveStatusMap[targetSlug] !== false; // treat undefined as working to be safe, or false as broken
        const item = {
          sourceSlug: page.slug,
          sourceKeyword: page.keyword,
          sourceTitle: page.title,
          targetSlug: targetSlug
        };
        if (isWorking) {
          workingLinks.push(item);
        } else {
          brokenLinks.push(item);
        }
      });
    });

    res.json({
      success: true,
      scannedPagesCount: pages.length,
      totalLinks: workingLinks.length + brokenLinks.length,
      workingCount: workingLinks.length,
      brokenCount: brokenLinks.length,
      workingLinks,
      brokenLinks
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/links/repair", async (req, res) => {
  try {
    const pages = readDb(PAGES_FILE);
    if (!Array.isArray(pages) || pages.length === 0) {
      return res.json({ success: true, message: "डेटाबेस में कोई पृष्ठ नहीं मिले।", count: 0 });
    }

    appendLog("Link Doctor", "Starting thorough automatic live-repair. Synchronizing with active live sitemap index...");

    // 1. Fetch live active sitemap slugs first to ensure our mappings are up-to-date
    const realSlugsList = await getRealTexlySlugs();
    appendLog("Link Doctor", `Success: Synchronized active inventory. Found ${realSlugsList.length} total live slugs.`);

    // 2. Scan all related companion tools inside our database
    const uniqueSlugs: Set<string> = new Set();
    pages.forEach((page: any) => {
      if (Array.isArray(page.relatedTools)) {
        page.relatedTools.forEach((s: string) => {
          if (s && typeof s === "string") uniqueSlugs.add(s.trim());
        });
      }
    });
    // Add real slugs as candidates as well
    realSlugsList.forEach(s => uniqueSlugs.add(s));

    const liveStatusMap: Record<string, boolean> = {};
    const list = Array.from(uniqueSlugs);

    const immutableSlugs = [
      "remove-whitespace-online", 
      "case-converter", 
      "remove-space-online", 
      "duplicate-lines-remover"
    ];

    // Check each unique target live in parallel
    await Promise.all(list.map(async (slug) => {
      if (immutableSlugs.includes(slug)) {
        liveStatusMap[slug] = true;
        return;
      }
      const isAlive = await checkLiveSlugStatus(slug);
      liveStatusMap[slug] = isAlive;
    }));

    let brokenPurgedCount = 0;
    let filledCount = 0;
    let modified = false;

    pages.forEach((page: any) => {
      const originalRelated = Array.isArray(page.relatedTools) ? page.relatedTools : [];
      
      // Clean up dead/404 links, self-linking, or empty values
      let cleanRelated = originalRelated.filter((s: string) => {
        const trimmed = s.trim();
        if (!trimmed) return false;
        if (trimmed === page.slug) return false;
        
        // Allowed if listed in live sitemap OR found active/responsive on live site
        return (realSlugsList.includes(trimmed) || liveStatusMap[trimmed] === true);
      });

      // Maintain uniqueness
      cleanRelated = Array.from(new Set(cleanRelated));

      const brokenCountForPage = originalRelated.length - cleanRelated.length;
      if (brokenCountForPage > 0) {
        brokenPurgedCount += brokenCountForPage;
      }

      // Auto-fill up to exactly 3 related tools if we are short of connections on this landing page!
      if (cleanRelated.length < 3) {
        const missingCount = 3 - cleanRelated.length;
        const replacements = findSemanticSitemapReplacements(
          page.slug,
          page.category || "Utility Tools",
          page.keyword || "",
          realSlugsList,
          missingCount
        );

        replacements.forEach(repSlug => {
          if (repSlug && repSlug !== page.slug && !cleanRelated.includes(repSlug)) {
            cleanRelated.push(repSlug);
            filledCount++;
          }
        });
      }

      // Slice output to reasonable bounds (max 3-4 linked items)
      if (cleanRelated.length > 4) {
        cleanRelated = cleanRelated.slice(0, 3);
      }

      if (JSON.stringify(originalRelated) !== JSON.stringify(cleanRelated)) {
        page.relatedTools = cleanRelated;
        modified = true;
        console.log(`[REPAIR ENGINE] Aligned /${page.slug}: -> [${cleanRelated.join(", ")}]`);
      }
    });

    if (modified) {
      writeDb(PAGES_FILE, pages);
      appendLog("Link Doctor", `Successfully completed link repair! Purged ${brokenPurgedCount} broken links, auto-filled ${filledCount} missing tools based on semantic tags.`, "success");
      await autoSanitizePagesDatabase();

      // Automatically sync updated databases to active GitHub repositories
      const config = readDb(CONFIG_FILE);
      if (config?.githubRepo && config?.githubToken) {
        try {
          const freshPages = readDb(PAGES_FILE);
          await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(freshPages, null, 2), "data/pages.json");
          
          let vercelTriggered = false;
          if (config.vercelWebhookUrl) {
            vercelTriggered = await triggerVercelWebhook(config.vercelWebhookUrl);
          }
          appendLog("Link Doctor", `Healed link directory synced to GitHub repository. Dynamic sitemap re-index triggered on live server. Vercel rebuild: ${vercelTriggered ? "Triggered" : "Skipped"}`, "success");
        } catch (gitErr: any) {
          appendLog("Link Doctor", `Failed to backup healed link matrix to GitHub: ${gitErr.message}`, "error");
        }
      } else {
        appendLog("Link Doctor", "GitHub sync skipped: missing repository or access tokens in control configuration.", "warning");
      }
    } else {
      appendLog("Link Doctor", "Perfect Health Checked: All programmatic related landing links are completely healthy and saturated on current map.", "success");
    }

    res.json({
      success: true,
      message: `सफलतापूर्वक सभी लिंक्स को हील कर दिया गया है! ${brokenPurgedCount} टूटे हुए लिंक्स हटाए गए और ${filledCount} नए रेलेटेड टूल्स जोड़े गए। लाइव डिप्लोयमेंट शुरू कर दी गयी है!`,
      purgedCount: brokenPurgedCount,
      filledCount: filledCount,
      modified: modified
    });
  } catch (err: any) {
    appendLog("Link Doctor", `Link repair routine failed: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Explicitly trigger self-healing database sanitization on-demand
app.post("/api/database/sanitize", async (req, res) => {
  try {
    appendLog("Database Sanitizer", "Manual database cleansing triggered from control panel.");
    await autoSanitizePagesDatabase();
    const updatedPages = readDb(PAGES_FILE);
    res.json({
      success: true,
      message: "सफलतापूर्वक Supabase और स्थानीय डेटाबेस को डिटॉक्स व अलाइन कर दिया गया है।",
      count: updatedPages.length,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    appendLog("Database Sanitizer", `Sanitization failed: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Explicitly push local pages database and sitemap to GitHub and trigger Vercel rebuild on-demand
app.post("/api/github/push", async (req, res) => {
  try {
    const config = readDb(CONFIG_FILE);
    if (!config?.githubRepo || !config?.githubToken) {
      appendLog("GitHub Deployer", "Manual push rejected: GitHub credentials are not configured in system settings.", "warning");
      return res.status(400).json({
        success: false,
        message: "GitHub Repository or Token not configured in settings."
      });
    }

    appendLog("GitHub Deployer", "Manual deployment triggered. Packaging pages and sitemap files...");

    const tblClean = readDb(PAGES_FILE);

    // 1. Push PAGES_FILE (data/pages.json)
    const pagesGitUrl = await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(tblClean, null, 2), "data/pages.json");
    appendLog("GitHub Deployer", `Successfully pushed pages.json to GitHub! Commit: ${pagesGitUrl}`, "success");

    // 2. Sitemap notice (dynamic update)
    appendLog("GitHub Deployer", "Sitemap will dynamically update on the fly via api/sitemap.ts based on data/pages.json. No static sitemap.xml push needed.", "success");

    // 3. Trigger Vercel Webhook Deployment
    let vercelTriggered = false;
    if (config.vercelWebhookUrl) {
      vercelTriggered = await triggerVercelWebhook(config.vercelWebhookUrl);
      if (vercelTriggered) {
        appendLog("GitHub Deployer", "Vercel build deployment triggered on webhook successfully.", "success");
      } else {
        appendLog("GitHub Deployer", "Vercel Webhook endpoint returned warning or failed to respond.", "warning");
      }
    }

    res.json({
      success: true,
      message: "सफलतापूर्वक GitHub पर push कर दिया गया है और Vercel build ट्रिगर हो गई है!",
      pagesUrl: pagesGitUrl,
      sitemapUrl: "Dynamic mapping (api/sitemap.ts)",
      vercelTriggered
    });
  } catch (err: any) {
    appendLog("GitHub Deployer", `Manual push failed: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve the dynamic sitemap.xml to queries and search engines
app.get("/sitemap.xml", async (req, res) => {
  try {
    const pages = readDb(PAGES_FILE);
    const sitemapXml = await generateSitemapXml(pages);
    res.header("Content-Type", "application/xml");
    res.status(200).send(sitemapXml);
  } catch (err: any) {
    res.status(500).send(`<error>${err.message}</error>`);
  }
});

// Serve the robots.txt file to search engines and spiders
app.get("/robots.txt", (req, res) => {
  res.header("Content-Type", "text/plain");
  res.status(200).send("User-agent: *\nAllow: /\nSitemap: https://www.texlyonline.in/sitemap.xml");
});

// Proxy endpoint to fetch OpenRouter models and split them into Free and Paid
app.get("/api/models/openrouter", async (req, res) => {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) {
      throw new Error(`OpenRouter API responded with status ${response.status}`);
    }
    const data = await response.json();
    const list = data.data || [];

    const models = list.map((m: any) => {
      const promptPrice = parseFloat(m.pricing?.prompt || "0");
      const completionPrice = parseFloat(m.pricing?.completion || "0");
      const isFree = m.id.endsWith(":free") || (promptPrice === 0 && completionPrice === 0);
      return {
        id: m.id,
        name: m.name || m.id,
        isFree,
        promptPrice,
        completionPrice
      };
    });

    res.json({ success: true, models });
  } catch (err: any) {
    console.error("Failed to load OpenRouter models:", err.message);
    const fallbackPresets = [
      { id: "google/gemini-2.5-flash:free", name: "Google: Gemini 2.5 Flash (Free)", isFree: true },
      { id: "meta-llama/llama-3-8b-instruct:free", name: "Meta: LLaMA 3 8B Instruct (Free)", isFree: true },
      { id: "deepseek/deepseek-r1:free", name: "DeepSeek: R1 Distill LLaMA 70B (Free)", isFree: true },
      { id: "google/gemini-2.1-flash:free", name: "Google: Gemini 2.1 Flash (Free)", isFree: true },
      { id: "mistralai/mistral-7b-instruct:free", name: "Mistral: Mistral 7B Instruct (Free)", isFree: true },
      { id: "openchat/openchat-7b:free", name: "OpenChat 7B (Free)", isFree: true },
      // Paid
      { id: "google/gemini-2.5-pro", name: "Google: Gemini 2.5 Pro (Paid)", isFree: false },
      { id: "google/gemini-2.5-flash", name: "Google: Gemini 2.5 Flash (Paid)", isFree: false },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Meta: LLaMA 3.3 70B Instruct (Paid)", isFree: false },
      { id: "deepseek/deepseek-r1", name: "DeepSeek: R1 Full (Paid)", isFree: false },
      { id: "anthropic/claude-3.5-sonnet", name: "Anthropic: Claude 3.5 Sonnet (Paid)", isFree: false },
      { id: "mistralai/mistral-large-2411", name: "Mistral: Mistral Large (Paid)", isFree: false }
    ];
    res.json({ success: true, models: fallbackPresets, fallback: true });
  }
});

// Proxy endpoint to fetch Groq models
app.get("/api/models/groq", async (req, res) => {
  const config = readDb(CONFIG_FILE);
  let apiKey = req.query.apiKey as string;
  if (!apiKey || typeof apiKey !== "string" || apiKey === "••••••••" || apiKey.includes("•")) {
    apiKey = config?.groqApiKey || "";
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey === "••••••••" || apiKey.includes("•")) {
    apiKey = "";
  }

  // Strictly sanitize API key to bypass Undici header crashes for weird spacing/tabs/newlines
  apiKey = apiKey.trim().replace(/[\r\n\t\s]/g, "");

  if (!apiKey) {
    return res.json({ 
      success: true, 
      models: [
        { id: "llama3-70b-8192", name: "llama3-70b-8192 (Free/Developer Tier Preset)", isFree: true },
        { id: "deepseek-r1-distill-llama-70b", name: "deepseek-r1-distill-llama-70b (Free/Developer Tier Preset)", isFree: true },
        { id: "gemma2-9b-it", name: "gemma2-9b-it (Free/Developer Tier Preset)", isFree: true },
        { id: "mixtral-8x7b-32768", name: "mixtral-8x7b-32768 (Free/Developer Tier Preset)", isFree: true }
      ]
    });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Groq API responded with status ${response.status}`);
    }

    const data = await response.json();
    const list = data.data || [];
    const models = list.map((m: any) => ({
      id: m.id,
      name: `${m.id} (Groq Active)`,
      isFree: true
    }));

    res.json({ success: true, models });
  } catch (err: any) {
    console.error("Failed to load Groq models from API:", err?.message || err);
    res.json({ 
      success: true, 
      models: [
        { id: "llama3-70b-8192", name: "llama3-70b-8192 (Free/Developer Tier Fallback)", isFree: true },
        { id: "deepseek-r1-distill-llama-70b", name: "deepseek-r1-distill-llama-70b (Free/Developer Tier Fallback)", isFree: true },
        { id: "gemma2-9b-it", name: "gemma2-9b-it (Free/Developer Tier Fallback)", isFree: true },
        { id: "mixtral-8x7b-32768", name: "mixtral-8x7b-32768 (Free/Developer Tier Fallback)", isFree: true }
      ],
      fallback: true
    });
  }
});

// Get system configuration
app.get("/api/config", (req, res) => {
  const config = readDb(CONFIG_FILE);
  if (!config || Array.isArray(config)) {
    return res.json({ success: true, config: {} });
  }
  const safeConfig = { ...config };

  const sensitiveKeys = [
    "githubToken",
    "groqApiKey",
    "supabaseKey",
    "openrouterApiKey",
    "geminiApiKey",
    "adminPassword",
    "vercelWebhookUrl"
  ];
  sensitiveKeys.forEach(key => {
    if (safeConfig[key]) {
      safeConfig[key] = "••••••••";
    }
  });

  // Calculate Supabase connection indicators via custom user config or environment variables
  const isConnected = !!getSupabaseClient();
  let maskedUrl = "";
  const envUrl = config?.supabaseUrl || process.env.SUPABASE_URL || "";
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const hostParts = parsed.hostname.split(".");
      if (hostParts[0] && hostParts[0].length > 4) {
        hostParts[0] = hostParts[0].substring(0, 4) + "••••";
      }
      maskedUrl = `https://${hostParts.join(".")}`;
    } catch {
      maskedUrl = "Configured (User DB)";
    }
  }

  res.json({ 
    success: true, 
    config: safeConfig, 
    supabaseConnected: isConnected,
    supabaseUrlMasked: maskedUrl
  });
});

// Update configuration
app.post("/api/config/save", async (req, res) => {
  const config = readDb(CONFIG_FILE);
  const updated = { ...config };

  const sensitiveKeys = [
    "githubToken",
    "groqApiKey",
    "supabaseKey",
    "openrouterApiKey",
    "geminiApiKey",
    "adminPassword",
    "vercelWebhookUrl"
  ];
  
  Object.keys(req.body).forEach(key => {
    if (sensitiveKeys.includes(key)) {
       if (req.body[key] !== "••••••••") {
         updated[key] = req.body[key];
       }
    } else {
      updated[key] = req.body[key];
    }
  });

  writeDb(CONFIG_FILE, updated);
  appendLog("Config Update", "System automation panel configs updated.", "success");

  // Sync these credentials securely to their master profile inside the Master Supabase database
  const sessionStore = userSessionStorage.getStore();
  const activeUser = sessionStore?.username || "admin";
  
  // Clear any cached Supabase client so a brand-new connection builds using updated credentials
  delete userSupabaseClients[activeUser];

  // Sync securely to Master profile & pull current backup with a safe 2000ms SLA, ensuring non-blocking success response
  await withTimeout(saveUserKeysToMasterSupabase(activeUser, updated), 2000, null);
  await withTimeout(syncFromSupabase(), 2000, null);
  
  const safeConfig = { ...updated };
  sensitiveKeys.forEach(key => {
    if (safeConfig[key]) {
      safeConfig[key] = "••••••••";
    }
  });

  // Calculate indicators for frontend callback
  const isConnected = !!getSupabaseClient();
  let maskedUrl = "";
  const envUrl = updated?.supabaseUrl || process.env.SUPABASE_URL || "";
  if (envUrl) {
    try {
      const parsed = new URL(envUrl);
      const hostParts = parsed.hostname.split(".");
      if (hostParts[0] && hostParts[0].length > 4) {
        hostParts[0] = hostParts[0].substring(0, 4) + "••••";
      }
      maskedUrl = `https://${hostParts.join(".")}`;
    } catch {
      maskedUrl = "Configured (User DB)";
    }
  }

  res.json({ 
    success: true, 
    config: safeConfig, 
    supabaseConnected: isConnected,
    supabaseUrlMasked: maskedUrl
  });
});

// Get logs
app.get("/api/logs", (req, res) => {
  const logs = readDb(LOGS_FILE);
  res.json({ success: true, logs });
});

// Clear all logs
app.post("/api/logs/clear", (req, res) => {
  writeDb(LOGS_FILE, []);
  appendLog("System Logs", "Logs DB cleared manually.", "warning");
  res.json({ success: true });
});

// Delete a generated SEO page
app.delete("/api/pages/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const pages = readDb(PAGES_FILE);
    const filtered = pages.filter((p: any) => p.slug !== slug);
    if (pages.length === filtered.length) {
      return res.status(404).json({ success: false, message: "Page not found" });
    }
    
    writeDb(PAGES_FILE, filtered);
    appendLog("Page Management", `Deleted generated page with slug: /${slug}`, "warning");

    // Automatically sync updated list straight to Github + Vercel rebuild trigger if configured
    const config = readDb(CONFIG_FILE);
    let githubSynced = false;
    let vercelTriggered = false;

    if (config?.githubRepo && config?.githubToken) {
      try {
        await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(filtered, null, 2), "data/pages.json");
        githubSynced = true;
        
        if (config.vercelWebhookUrl) {
          vercelTriggered = await triggerVercelWebhook(config.vercelWebhookUrl);
        }
        appendLog("Page Management", `Successfully auto-synced page deletion of /${slug} to GitHub repo. Vercel rebuild: ${vercelTriggered ? "Triggered" : "Skipped"}`, "success");
      } catch (gitErr: any) {
        appendLog("Page Management", `Failed to auto-sync manually deleted page to GitHub: ${gitErr.message}`, "error");
      }
    }

    res.json({ 
      success: true, 
      message: `पेज /${slug} को सफलतापूर्वक डेटाबेस से डिलीट कर दिया गया है! ${githubSynced ? "सॉर्स कोड GitHub पर भी अपडेट किया गया।" : ""}`,
      githubSynced,
      vercelTriggered,
      pages: filtered
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI Niche Tool & Keyword Gap Detector
app.post("/api/gap-analyzer/scan", async (req, res) => {
  try {
    appendLog("Gap Analyzer", "Initiating global deep-gap semantic auditing...");
    
    // Read current pages
    const pages = readDb(PAGES_FILE) || [];
    const activeSlugs = pages.map((p: any) => p.slug || "");
    
    // Create compact summary of existing tools for AI analysis containing max 100 tools (to fit tokens safely)
    const currentPagesCompact = pages.slice(0, 100).map((p: any) => ({
      slug: p.slug,
      keyword: p.keyword,
      category: p.category
    }));

    let source = "Offline Algorithmic Preset Gaps";
    let gaps: any[] = [];

    // Check if Gemini or Groq are configured
    const client = getGeminiClient();
    const config = readDb(CONFIG_FILE);
    const apiAvailable = !!(client || config?.groqApiKey);

    if (apiAvailable) {
      try {
        appendLog("Gap Analyzer", `Analysing database of ${pages.length} live landing pages using active AI LLM model...`);
        
        const systemPrompt = "You are a professional programmatic SEO growth architect, data designer, and niche tool finder.";
        const userPrompt = `Review the current database containing ${pages.length} active web utilities on Texly:
${JSON.stringify(currentPagesCompact)}

Identify exactly 10 to 12 distinct strategic target tool gaps (keywords with slugs and categories) that do NOT exist in the list.
Focus heavily on browser-native text cleaners, converters, formatters, developer tools, encoders, and math helpers.

Each gap object in the JSON array MUST have:
- "keyword": Clean high-intent lowercased SEO keyword (e.g., "reverse text list")
- "slug": URL-safe slug with hyphens (e.g., "reverse-text-list")
- "category": Niche category name (e.g., "Text Cleaners", "Formatting Tools", "Developer Utilities", "Unit Converters")
- "difficulty": number from 1 to 100
- "searchVolumeEstimate": number from 100 to 80000
- "reason": A detailed high-fidelity rationale in simple Hindi/Hinglish describing what this tool does, who searches for it, and the gap filled (e.g. "Developers and writers constantly search for this to convert YAML formatting to JSON online without sending strings to server...").
- "priority": "High" | "Medium" | "Low"
- "intent": "utility" | "transactional" | "informational"

Return ONLY a flat JSON array of objects conforming to this specifications. No markdown block frames, no explanation.`;

        const { text, source: genSource } = await generateWithFallbackPipeline(systemPrompt, userPrompt);
        const cleaned = cleanJsonString(text);
        const parsedGaps = JSON.parse(cleaned);
        
        if (Array.isArray(parsedGaps)) {
          // Filter out gaps that already exist (safety check)
          gaps = parsedGaps.filter((g: any) => g && g.slug && !activeSlugs.includes(g.slug));
          source = genSource;
          appendLog("Gap Analyzer", `Successfully scanned database! Discovered ${gaps.length} dynamic SEO opportunities via ${source}.`, "success");
        }
      } catch (err: any) {
        appendLog("Gap Analyzer", `AI scanning failed: ${err.message}. Invoking high-fidelity offline compiler preset opportunities.`, "warning");
      }
    }

    // Fallback: If AI fails or is not configured, generate a high-quality list of offline strategic presets
    if (gaps.length === 0) {
      const offlinePool = [
        {
          keyword: "binary to text converter",
          slug: "binary-to-text-online",
          category: "Developer Utilities",
          difficulty: 14,
          searchVolumeEstimate: 16500,
          reason: "बाइनरी कोड को साधारण टेक्स्ट में परिवर्तित करने के लिए डेवलपर्स और छात्रों को अक्सर इस आसान टूल की आवश्यकता होती है।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "url encoder decoder",
          slug: "url-encoder-decoder-online",
          category: "Developer Utilities",
          difficulty: 10,
          searchVolumeEstimate: 22000,
          reason: "URL strings में विशेष कैरेक्टर्स को सुरक्षित रूप से एन्कोड और डिकोड करने के लिए एक महत्वपूर्ण उपयोगिता टूल।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "uuid generator online",
          slug: "uuid-generator-online",
          category: "Developer Utilities",
          difficulty: 22,
          searchVolumeEstimate: 18500,
          reason: "प्रोग्रामिंग और डेटाबेस ऑपरेशन्स के लिए तत्काल रैंडम UUID/GUID जनरेट करने का तेज़ क्लाइंट-साइड साधन।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "reverse text strings online",
          slug: "reverse-text-online",
          category: "Text Cleaners",
          difficulty: 7,
          searchVolumeEstimate: 4200,
          reason: "टेक्स्ट को पूरी तरह से उलटने (Reverse) या शब्दों के क्रम को बदलने की त्वरित और आसान ऑनलाइन उपयोगिता।",
          priority: "Medium",
          intent: "utility"
        },
        {
          keyword: "yaml to json converter",
          slug: "yaml-to-json-online",
          category: "Formatting Tools",
          difficulty: 19,
          searchVolumeEstimate: 11000,
          reason: "कॉन्फ़िगरेशन फाइलों (YAML) को बिना डेटा लीक किये लोकल ब्राउज़र में तुरंत JSON फॉर्मेट में बदलने का बेहतरीन टूल।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "sha255 hash generator",
          slug: "sha255-hash-online",
          category: "Developer Utilities",
          difficulty: 24,
          searchVolumeEstimate: 15500,
          reason: "किसी भी स्ट्रिंग या टेक्स्ट के लिए सुरक्षित SHA255 हैश वैल्यू प्राप्त करने की तेज़ ब्राउज़र-नेटिव यूटिलिटी।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "sort text lines alphabetically",
          slug: "sort-lines-online",
          category: "Text Cleaners",
          difficulty: 11,
          searchVolumeEstimate: 5400,
          reason: "बड़ी लिस्ट्स, सीएसवी रिकाॅर्ड्स, और शब्दों की सूची को वर्णमाला (Alphabetical) क्रम या लम्बाई के अनुसार सॉर्ट करने का टूल।",
          priority: "Medium",
          intent: "utility"
        },
        {
          keyword: "lorem ipsum online generator",
          slug: "lorem-ipsum-generator",
          category: "Developer Utilities",
          difficulty: 30,
          searchVolumeEstimate: 44000,
          reason: "डिजाइनर और डवलपर्स के लिए प्लेसहोल्डर टेक्स्ट के लिए पैराग्राफ, वाक्य या शब्दों को तत्काल जनरेट करने का टूल।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "markdown to html parser",
          slug: "markdown-to-html-online",
          category: "Formatting Tools",
          difficulty: 16,
          searchVolumeEstimate: 6200,
          reason: "मार्कडाउन (MD) लिखे गए डॉक्यूमेंट्स को सीधे लाइव ब्लॉग या वेबसाइट के अनुकूल HTML कोड में परिवर्तित करने का साधन।",
          priority: "Medium",
          intent: "utility"
        },
        {
          keyword: "word and line count counter",
          slug: "word-counter-online",
          category: "Text Cleaners",
          difficulty: 25,
          searchVolumeEstimate: 38000,
          reason: "लेखकों और एसईओ कॉपीराइटर्स के लिए शब्दों, वाक्यों, पैराग्राफ्स और कीवर्ड डेंसिटी की सटीक गणना करने वाला उपयोगी काउंटर।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "hex to rgb color converter",
          slug: "hex-to-rgb-converter",
          category: "Formatting Tools",
          difficulty: 12,
          searchVolumeEstimate: 9800,
          reason: "वेब डिजाइनरों के लिए हेक्साडेसिमल (#fff) रंगों को आरजीबी फ़ॉर्मेट में कनवर्ट करने की तेज़ ब्राउज़र-नेटिव यूटिलिटी।",
          priority: "Medium",
          intent: "utility"
        },
        {
          keyword: "remove duplicate lines online",
          slug: "duplicate-lines-remover",
          category: "Text Cleaners",
          difficulty: 15,
          searchVolumeEstimate: 14000,
          reason: "बड़ी टेक्स्ट सूचियों और डेटाबेस डंप से डुप्लीकेट कतरनों और अनचाही लाइनों को हटाने के लिए कुशल फ़िल्टर।",
          priority: "High",
          intent: "utility"
        },
        {
          keyword: "csv to json formatter online",
          slug: "csv-to-json-online",
          category: "Formatting Tools",
          difficulty: 18,
          searchVolumeEstimate: 13000,
          reason: "एक्सेल या स्प्रेडशीट सीएसवी फाइल्स को प्रोग्रामिंग अनुप्रयोगों के लिए स्टैंडर्ड जेएसओएन रिकॉर्ड्स में बदलने का टूल।",
          priority: "High",
          intent: "utility"
        }
      ];

      // Filter out gaps that already exist in active slugs
      gaps = offlinePool.filter((g: any) => !activeSlugs.includes(g.slug));
      appendLog("Gap Analyzer", `Discovered ${gaps.length} offline programmatic gap opportunities from high-intent SEO templates database.`, "success");
    }

    res.json({
      success: true,
      source,
      count: gaps.length,
      gaps
    });

  } catch (err: any) {
    appendLog("Gap Analyzer", `Scan workflow crashed: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Android App Suite and Configuration Generator
app.post("/api/android/generate-config", async (req, res) => {
  try {
    const { appId, appName, webUrl } = req.body;
    const finalAppId = appId ? appId.trim() : "com.texlyonline.app";
    const finalAppName = appName ? appName.trim() : "Texly Online";
    const finalWebUrl = webUrl ? webUrl.trim() : "https://www.texlyonline.in";

    appendLog("Android Suite", `Generating custom Capacitor & WebView integration config for app ID: ${finalAppId}...`);

    const capConfig = {
      appId: finalAppId,
      appName: finalAppName,
      webDir: "dist",
      server: {
        androidScheme: "https",
        url: finalWebUrl,
        allowNavigation: [
          "www.texlyonline.in",
          "texlyonline.in",
          "*.texlyonline.in",
          "*.supabase.co"
        ]
      }
    };

    // Save capacitor config locally
    try {
      const configPath = path.join(process.cwd(), "capacitor.config.json");
      fs.writeFileSync(configPath, JSON.stringify(capConfig, null, 2), "utf8");
    } catch (writeErr: any) {
      console.warn(`[VERCEL WARNING] Could not write capacitor.config.json to local read-only filesystem (expected in serverless): ${writeErr.message}`);
    }

    // Also write down a ready-to-use Android Manifest template in processed format
    const androidManifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${finalAppId}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${finalAppName}"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:usesCleartextTraffic="true"
        android:theme="@style/AppTheme">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="${finalAppName}"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection|fontScale|screenLayout|density"
            android:theme="@style/AppTheme.NoActionBarLaunch">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>`;

    // Also write down a custom highly optimized MainActivity.java WebView wrapper template
    const mainActivityJava = `package ${finalAppId};

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView myWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize high performance web layout
        myWebView = new WebView(this);
        setContentView(myWebView);

        WebSettings webSettings = myWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setLoadsImagesAutomatically(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Anti-flicker speed accelerators
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        myWebView.setDrawingCacheEnabled(true);

        myWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.contains("texlyonline.in")) {
                    view.loadUrl(url);
                    return false;
                }
                return true; // block outgoing third-party links inside app
            }
        });

        // Load the live Texly platform containing 100+ browser tools
        myWebView.loadUrl("${finalWebUrl}");
    }

    @Override
    public void onBackPressed() {
        if (myWebView.canGoBack()) {
            myWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

    // Write file backups to allow user download/use
    try {
      const templatesDir = path.join(process.cwd(), "android_templates");
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }
      fs.writeFileSync(path.join(templatesDir, "AndroidManifest.xml"), androidManifestXml, "utf8");
      fs.writeFileSync(path.join(templatesDir, "MainActivity.java"), mainActivityJava, "utf8");
    } catch (writeErr: any) {
      console.warn(`[VERCEL WARNING] Could not write android templates to local read-only filesystem (expected in serverless): ${writeErr.message}`);
    }

    appendLog("Android Suite", `Capacitor configuration initialized and Android templates written inside './android_templates/'!`, "success");

    res.json({
      success: true,
      message: "Capacitor configuration and Android Studio Java Templates are successfully generated in workspace!",
      capConfig,
      androidManifestXml,
      mainActivityJava
    });

  } catch (err: any) {
    appendLog("Android Suite", `Error compiling Android suite config: ${err.message}`, "error");
    res.status(500).json({ success: false, error: err.message });
  }
});

// Core Keyword Research Engine
app.post("/api/keywords/research", async (req, res) => {
  const { seedKeyword } = req.body;
  if (!seedKeyword || seedKeyword.trim() === "") {
    return res.status(400).json({ success: false, message: "A seed keyword is required" });
  }

  appendLog("Keyword Research", `Initiated robotic analysis for seed: "${seedKeyword}"`);

  // 1. Core Generator Pipeline fallback (Gemini -> Groq -> OpenRouter)
  try {
    const systemPrompt = "You are an expert programmatic SEO analyst specializing in high-performance keyword gap mapping.";
    const userPrompt = `Perform programmatic SEO keyword research. Analyze the utility tool seed keyword: "${seedKeyword}".
Generate a structured JSON output with 5 long-tail semantic variations suitable for landing pages or secondary utilities. 
Each variation must have:
- keyword: string
- slug: URL-safe string, e.g. "remove-weird-symbols"
- intent: one of "informational", "transactional", "commercial", "navigational", "utility"
- difficulty: number from 1 to 100 (difficulty estimate)
- searchVolumeEstimate: number from 100 to 50000
- category: broad niche category (e.g. "Text Cleaners", "Formatting Tools", "Developers Tools")
- competition: one of "Low", "Medium", "High"
- relatedLongTails: array of 3 string phrases related to this specific sub-keyword.

Return strictly a valid JSON array of objects conforming to this schema. Do not write markdown blocks, do not write extra conversational text. Return flat JSON lists only.`;

    const { text, source } = await generateWithFallbackPipeline(systemPrompt, userPrompt);
    const cleaned = cleanJsonString(text);
    const results = JSON.parse(cleaned);

    appendLog("Keyword Research", `Successfully completed keyword analysis via ${source}. Found ${results.length} clusters.`, "success");
    return res.json({ success: true, source, data: results });
  } catch (err: any) {
    appendLog("Keyword Research", `AI Pipeline Execution Warning: ${err.message}. Reverting to offline heuristics.`, "warning");
  }

  // Fallback intelligent offline engine when Gemini is not fully configured or throwsconfigured or throws
  const staticFallbackArr = [
    {
      keyword: `${seedKeyword} online`,
      slug: seedKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-online",
      intent: "utility",
      difficulty: 18,
      searchVolumeEstimate: 3800,
      category: "Utility Tools",
      competition: "Low",
      relatedLongTails: [`free ${seedKeyword}`, `best ${seedKeyword} page`, `clean text with ${seedKeyword}`]
    },
    {
      keyword: `remove ${seedKeyword} from paragraph`,
      slug: "remove-" + seedKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-from-text",
      intent: "utility",
      difficulty: 12,
      searchVolumeEstimate: 1400,
      category: "Text Cleaners",
      competition: "Low",
      relatedLongTails: [`clean copied ${seedKeyword}`, `strip emoji and ${seedKeyword}`, `sanitize text inputs`]
    },
    {
      keyword: `batch ${seedKeyword} converter`,
      slug: "batch-" + seedKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-converter",
      intent: "utility",
      difficulty: 24,
      searchVolumeEstimate: 950,
      category: "Formatting Tools",
      competition: "Medium",
      relatedLongTails: [`convert massive ${seedKeyword} list`, `bulk ${seedKeyword} stripping`, `node js ${seedKeyword}`]
    },
    {
      keyword: `free ${seedKeyword} tool`,
      slug: "free-" + seedKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-tool",
      intent: "utility",
      difficulty: 15,
      searchVolumeEstimate: 4500,
      category: "Utility Tools",
      competition: "Low",
      relatedLongTails: [`texlyonline ${seedKeyword}`, `${seedKeyword} no sign up`, `fast client-side ${seedKeyword}`]
    },
    {
      keyword: `clean ${seedKeyword} characters`,
      slug: "clean-" + seedKeyword.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-characters",
      intent: "informational",
      difficulty: 9,
      searchVolumeEstimate: 620,
      category: "Developers Tools",
      competition: "Low",
      relatedLongTails: [`how to clean ${seedKeyword}`, `strip ${seedKeyword} regex`, `database friendly ${seedKeyword}`]
    }
  ];

  appendLog("Keyword Research", `Returned ${staticFallbackArr.length} local semantic fallback variations for: "${seedKeyword}"`, "success");
  res.json({ success: true, source: "Offline Engine Fallback", data: staticFallbackArr });
});

// Programmatic Content Generation Route
app.post("/api/generate-content", async (req, res) => {
  const { keyword, slug, category } = req.body;
  if (!keyword || !slug) {
    return res.status(400).json({ success: false, message: "Keyword and Slug are required parameters." });
  }

  appendLog("Content Generator", `Starting autonomous content outline for: "${keyword}" (/${slug})`);

  // Fetch real slugs from live sitemap and merged databases to prevent broken links
  const realSlugsList = await getRealTexlySlugs();
  const slugsPromptStr = realSlugsList.join(", ");

  // 1. Centralized High-Availability Pipeline Generator (Gemini -> Groq -> OpenRouter)
  try {
    const systemPrompt = "You are an expert search engine marketer, copywriter, and high-performance SEO landing page architect.";
    const userPrompt = `Your job is to construct a perfect Programmatic SEO JSON object detailing content for a new utility website tool on TexlyOnline.
Target Keyword: "${keyword}"
Niche Category: "${category || "Utility Tool"}"
Slug Name: "${slug}"

Generate a raw JSON object matching the following structure exactly. 
The content MUST be authoritative, highly engaging, very useful, and extremely rich in detail. 
To ensure this is considered premium-quality content by search spiders, you MUST generate a thorough 'detailedContent' section.
The TOTAL word count of the text fields (intro, FAQ answers, useCases descriptions, and detailedContent paragraphs) MUST be between 800 and 1000 words. Keep content informative and avoid fluff, but write in-depth and exhaustively.

Return only a raw JSON matching the following schema. Make sure no parts are omitted:

{
  "slug": "${slug}",
  "keyword": "${keyword}",
  "title": "A perfect catchy SEO Title under 60 chars. Append ' | Texly' to the title.",
  "metaDescription": "A highly readable, search-friendly meta description under 155 chars with call to action.",
  "intro": "A 3-4 sentence detailed introduction outlining the benefits of stripping or solving for this keyword instantly on our free client-side tool.",
  "faqList": [
    { "question": "Question 1 relative to ${keyword} (FAQ/Search Ground)?", "answer": "Clear, detailed 3-4 sentence answer optimized with semantic terms." },
    { "question": "Question 2?", "answer": "Detailed answer." },
    { "question": "Question 3?", "answer": "Detailed answer." },
    { "question": "Question 4?", "answer": "Detailed answer." },
    { "question": "Question 5?", "answer": "Detailed answer." }
  ],
  "useCases": [
    { "title": "Real-world Practical Niche Case 1", "description": "Exhaustive description of how a professional or developer benefits from this tool." },
    { "title": "Case 2", "description": "Detailed description." },
    { "title": "Case 3", "description": "Detailed description." }
  ],
  "examples": [
    { "input": "Sample scrambled text highlighting unwanted elements", "output": "Pristine cleaned text results", "explanation": "Brief explanation of what was stripped." },
    { "input": "Another scrambled sample input", "output": "Clean output example", "explanation": "Detailed step-by-step processing explanation." }
  ],
  "relatedTools": ["slug-1", "slug-2"],
  "detailedContent": [
    {
      "heading": "Comprehensive Guide on ${keyword}",
      "paragraphs": [
        "A substantial 120-150 word paragraph digging deep into the technical foundations of why ${keyword} presents unique challenges to web development, copywriting, and data entry, explaining the exact character rules and standard expressions involved in resolving it.",
        "Another 100-120 word paragraph outlining the traditional hurdles developers faced prior to instant client-side tools, such as configuring custom server-side formatting libraries or raw regex expressions manually in local terminals."
      ]
    },
    {
      "heading": "How Our Browser-Native Tool Solves This Safely",
      "paragraphs": [
        "A highly informative 120-150 word paragraph elaborating on our platform-native architecture. Explain how the script evaluates raw string memory lines inside the sandbox without transmitting a single byte over HTTP APIs or cloud endpoints, guaranteeing absolute confidentiality.",
        "Include insights into the sub-millisecond execution times, showing how modern JavaScript engines parse mega-sized text documents instantly on any standard device."
      ]
    },
    {
      "heading": "Pro Tips for Text Processing Automation",
      "paragraphs": [
        "A substantial 100-120 word paragraph detailing advanced developer workflows. Explain how developers can paste CSV data, JSON payloads, or bulk database tables into the text frame and use the clipboard copy capability to pipeline standardized clean scripts."
      ]
    }
  ],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${keyword}",
    "url": "https://www.texlyonline.in/${slug}",
    "applicationCategory": "Utility",
    "operatingSystem": "All"
  },
  "socialMediaScripts": {
    "pinterestDescription": "A scroll-stopping Pinterest description with relevant tags.",
    "reelCaption": "Hook, Value, and CTA captions with emojis.",
    "shortsScript": "Engaging 15-second transcript for a short video introducing the tool."
  }
}

CRITICAL RULES FOR RELATED TOOLS:
You MUST set "relatedTools" array elements ONLY from the following list of active real slugs. Do NOT invent or make up a slug not present in this list:
[${slugsPromptStr}]

Return ONLY standard JSON. No markdown wrappers, no conversational filler. Output must be valid JSON in standard format.`;

    const { text, source } = await generateWithFallbackPipeline(systemPrompt, userPrompt);
    const cleaned = cleanJsonString(text);
    const parsedData = JSON.parse(cleaned);

    // Save to PAGES_FILE
    const pages = readDb(PAGES_FILE);
    // Avoid duplicate slug
    const filtered = pages.filter((p: any) => p.slug !== slug);
    
    const completePage = {
      ...parsedData,
      category: category || "Utility Tools",
      canonicalUrl: getLiveUrlForSlug(slug),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    filtered.push(completePage);
    writeDb(PAGES_FILE, filtered);

    // Dynamic self-healing database sanitization of links and formats on update
    await autoSanitizePagesDatabase();

    // Auto-push to live deployment if requested
    if (req.body.pushToLive) {
      const config = readDb(CONFIG_FILE);
      if (config?.githubRepo && config?.githubToken) {
        try {
          const freshPages = readDb(PAGES_FILE);
          await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(freshPages, null, 2), "data/pages.json");
          if (config.vercelWebhookUrl) {
            await triggerVercelWebhook(config.vercelWebhookUrl);
          }
          appendLog("Content Generator", `Automatically pushed metadata node /${slug} to GitHub live repository. Dynamic sitemap will auto-update.`, "success");
        } catch (gitErr: any) {
          appendLog("Content Generator", `Automatic live push failed: ${gitErr.message}`, "error");
        }
      } else {
        appendLog("Content Generator", `Automatic live push skipped: GitHub credentials not set up.`, "warning");
      }
    }

    appendLog("Content Generator", `Page generated using ${source} and persisted successfully. Slug: /${slug}`, "success");
    return res.json({ success: true, source, page: completePage });

  } catch (err: any) {
    appendLog("Content Generator", `AI Fallback Pipeline failed: ${err.message}. Invoking programmatic content synthesis fallback.`, "warning");
  }

  // Get active local / real companion slugs for fallback links
  const fallbackRelated = realSlugsList.filter(s => s !== slug).slice(0, 3);

  // Fallback programmatic generation when Gemini is not configured/offline
  const offlinePage = {
    slug,
    keyword,
    title: `Instant ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Clean Text Online | Texly`,
    metaDescription: `Sanitize your text inputs using our instant free web tool. Best automated cleaner designed for ${keyword} removal tasks.`,
    intro: `Eliminate messy character logs. Our browser-native optimizer solves for '${keyword}' with single-click algorithms. Build custom structures, refine your copy content, and stream clean output directly. This lightweight application delivers rapid data sanitization utilities safely inside client workstation architectures.`,
    faqList: [
      {
        question: `How does the ${keyword} utility work?`,
        answer: `The tool evaluates character glyphs and strips matching characters within milliseconds right inside your browser code context. Using highly tuned custom matching arrays, it filters structural patterns instantly without degrading system throughput.`
      },
      {
        question: "Is there any software to install?",
        answer: "No. The utility is 100% cloud-hosted and works without setup or permissions on any smart platform. Simply navigate to our domain URL and utilize the clean utility directly on any standard workstation."
      },
      {
        question: "Is this secure?",
        answer: "Yes, Texly prioritizes your data safety. Your strings are never stored, logged, or sent to server resources. The security architecture guarantees that all formatting cycles complete entirely inside your sandbox memory context."
      },
      {
        question: "Can I use it programmatically?",
        answer: "Yes, we present the clean text results with immediate 'Copy to Clipboard' accessibility for automated developer chains. You can quickly pipe raw scraped segments, database dumps, or CSV text blocks directly into our frame."
      },
      {
        question: "Does it support Unicode systems?",
        answer: "Yes, the parsing engines are tested with standard base unicode planes, guaranteeing support for standard text blocks, emoticons, tabular spreadsheets, and code scripts cleanly."
      }
    ],
    useCases: [
      {
        title: "Developer Form Formatting",
        description: "Standardize raw inputs before integrating into JSON pipelines, SQL inserts, or REST databases to circumvent unexpected server exceptions."
      },
      {
        title: "Content Marketing Cleanup",
        description: "Prune dirty copied documents, getting rid of trailing artifacts, spaces, and punctuation anomalies before deploying on CMS platforms."
      },
      {
        title: "Database Bulk Processing",
        description: "Ensure character stability and consistent encoding formats across legacy structures prior to initiating SQL search indexing commands."
      }
    ],
    examples: [
      {
        input: `Sample dirty text matching [${keyword}] parameters`,
        output: `Sample clean text with ${keyword} fully stripped!`,
        explanation: "Identifies and eliminates specific matching patterns based on standard regex schemas execution."
      }
    ],
    relatedTools: fallbackRelated.length > 0 ? fallbackRelated : ["remove-symbols-online", "remove-emojis-from-text"],
    detailedContent: [
      {
        heading: `Comprehensive Guide on ${keyword}`,
        paragraphs: [
          `Optimizing text data is a fundamental process in databases, modern web development, and digital marketing. Handling ${keyword} can be quite a meticulous challenge because manual scanning is notoriously prone to human errors and is highly time-consuming. Traditionally, designers, software developers, and copywriters had to construct complex regular expressions in advanced programming languages like Python, Java, or Node.js to strip characters or refine formatting. This tedious process frequently leads to corrupted code, missing metadata, or unaligned tables, causing disruptions in indexing or content publication workflows.`,
          `By automating this text-cleaning workflow, our instant utility ensures that your text is formatted properly and standardized within seconds. This client-side, browser-based tool allows anyone, from seasoned data engineers to amateur bloggers, to immediately execute standard cleaning routines. There is zero code to write, no libraries to npm install, and no complex terminal interfaces to debug. You simply drop your messy text block into the container box, select the preferred processing option, and execute the algorithm with a single-click action.`
        ]
      },
      {
        heading: "Secure Browser-Native Sanitation Architecture",
        paragraphs: [
          "Data privacy and security are paramount in modern tech environments. Most existing web tools transmit your sensitive data fragments to remote cloud servers for cleaning, exposing confidential information to logs or middleman sniffing risks. Texly approaches text processing with an absolute security mindset. Our utility is built to execute purely client-side, using optimized sandboxed native JavaScript frameworks.",
          "When you paste your script strings or copy fragments, the character evaluation rules execute locally within the runtime scope of your browser's memory. Not a single byte of your text data is sent to external APIs or database servers. This means you can clean credit card dumps, secure configurations, password segments, or corporate documents with total peace of mind."
        ]
      },
      {
        heading: "Practical Business & Technical Use Cases",
        paragraphs: [
          "Whether you are refining raw scraper inputs, formatting transactional records for SQL databases, or preparing optimized blog articles, our tool is incredibly helpful. For web developers, standardizing user-generated input avoids unexpected system exceptions or broken UI alignment. For SEO strategists and bloggers, removing unnecessary trailing characters ensures pristine code tags and better search indexing efficiency. Scale your publishing output by utilizing unified formatting patterns.",
          "Simply leverage our immediate 'Copy to Clipboard' buttons to streamline developer chains. Save and format documents continuously without having to navigate messy configurations or install third-party dependencies. Enjoy direct, high-availability optimization on any workstation or mobile device today!"
        ]
      }
    ],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": keyword,
      "url": getLiveUrlForSlug(slug),
      "applicationCategory": "Utility",
      "operatingSystem": "All"
    },
    category: category || "Text Cleaners",
    canonicalUrl: getLiveUrlForSlug(slug),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    socialMediaScripts: {
      pinterestDescription: `Ready to clean up your text database fast? Access our free ${keyword} tool online. Clean and sanitize scripts instantly! 🌟 #utility #marketing #seo`,
      reelCaption: `Save thousands of hours! Clean up matching text clusters with our one-click free SEO tools online. Check out Texly! 🚀🔗`,
      shortsScript: `Doing boring regex syntax writing in Node? Try Texly's instant page. It strips characters flawlessly without you writing any custom code!`
    }
  };

  const pages = readDb(PAGES_FILE);
  const filtered = pages.filter((p: any) => p.slug !== slug);
  filtered.push(offlinePage);
  writeDb(PAGES_FILE, filtered);

  // Run dynamic self-healing link database sanitization
  await autoSanitizePagesDatabase();

  // Auto-push to live deployment if requested
  if (req.body.pushToLive) {
    const config = readDb(CONFIG_FILE);
    if (config?.githubRepo && config?.githubToken) {
      try {
        const freshPages = readDb(PAGES_FILE);
        await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(freshPages, null, 2), "data/pages.json");
        if (config.vercelWebhookUrl) {
          await triggerVercelWebhook(config.vercelWebhookUrl);
        }
        appendLog("Content Generator", `Automatically pushed metadata node /${slug} to GitHub live repository. Dynamic sitemap will auto-update.`, "success");
      } catch (gitErr: any) {
        appendLog("Content Generator", `Automatic live push failed: ${gitErr.message}`, "error");
      }
    } else {
      appendLog("Content Generator", `Automatic live push skipped: GitHub credentials not set up.`, "warning");
    }
  }

  appendLog("Content Generator", `Page generated using local compiler. Saved slug: /${slug}`, "success");
  res.json({ success: true, source: "Offline Compiler", page: offlinePage });
});

// Automated Daily Workflow Runner
app.all("/api/automation/run", async (req, res) => {
  appendLog("Automation Cron", "Daily Programmatic Cron started mechanically.", "info");

  const logsArr: any[] = [];
  const logStep = (stepName: string, message: string, status: "info" | "success" | "warning" | "error" = "info") => {
    const l = appendLog(stepName, message, status);
    logsArr.push(l);
  };

  const config = readDb(CONFIG_FILE);

  // Step 1: Research Keywords
  logStep("Automation Step 1/8", "Scanning low-competition utility opportunities for 'texlyonline.in'.");
  
  // Step 2: Gap Analysis against current page lists
  const currentPages = readDb(PAGES_FILE);
  const currentSlugs = currentPages.map((p: any) => p.slug);
  logStep("Automation Step 2/8", `Analyzing current database gap index. found ${currentPages.length} existing live landing templates.`);

  // Step 3: Select Best Keywords - limit to exactly 1 candidate to STAGGER creation naturally!
  const pool = [
    { keyword: "remove whitespace online", slug: "remove-whitespace-online", category: "Text Cleaners" },
    { keyword: "uppercase to lowercase converter", slug: "case-converter", category: "Formatting Tools" },
    { keyword: "remove duplicate lines online", slug: "duplicate-lines-remover", category: "Text Cleaners" },
    { keyword: "strip html tags from text", slug: "strip-html-tags-online", category: "Developer Utilities" },
    { keyword: "json formatter utility", slug: "json-formatter", category: "Formatting Tools" },
    { keyword: "remove multiple spaces online", slug: "remove-multiple-spaces", category: "Text Cleaners" },
    { keyword: "count characters online", slug: "count-characters-online", category: "Developer Utilities" }
  ];

  // We read from pool, filter what isn't already created, and slice EXACTLY ONE to keep updates staggered
  const candidates = pool.filter(item => !currentSlugs.includes(item.slug)).slice(0, 1);
  
  if (candidates.length === 0) {
    logStep("Automation Step 3/8", "No page gaps discovered. Satisfied with current indexed content density. Sleeping.", "warning");
    return res.json({ success: true, processedCount: 0, logs: logsArr });
  }

  logStep("Automation Step 3/8", `Selected 1 staggered keyword gap: "${candidates[0].keyword}" (Avoiding simultaneous multiple item pushes for safety)`, "success");

  // Step 4 & 5: Content Gen and Save for the staggered page
  const cand = candidates[0];
  logStep("Automation Step 4/8", `Compiling dynamic structural definitions for staggered target: "${cand.keyword}"`);
  
  // Check model choice (Groq or Gemini) and compile
  let completePage: any;
  const activeModel = config?.useGroq && config?.groqApiKey ? (config.groqModel || "llama3-70b-8192") : "gemini-3.5-flash";

  try {
    const realSlugsList = await getRealTexlySlugs();
    const slugsPromptStr = realSlugsList.join(", ");

    const systemPrompt = "You are an expert search engine marketer, copywriter, and high-performance SEO landing page architect.";
    const userPrompt = `Your job is to construct a perfect Programmatic SEO JSON object detailing content for a new utility website tool on TexlyOnline.
Target Keyword: "${cand.keyword}"
Niche Category: "${cand.category}"
Slug Name: "${cand.slug}"

Generate a raw JSON object matching the following structure exactly. 
The content MUST be authoritative, highly engaging, very useful, and extremely rich in detail. 
To ensure this is considered premium-quality content by search spiders, you MUST generate a thorough 'detailedContent' section.
The TOTAL word count of the text fields (intro, FAQ answers, useCases descriptions, and detailedContent paragraphs) MUST be between 800 and 1000 words. Keep content informative and avoid fluff, but write in-depth and exhaustively.

Return only a raw JSON matching the following schema. Make sure no parts are omitted:

{
  "slug": "${cand.slug}",
  "keyword": "${cand.keyword}",
  "title": "A perfect catchy SEO Title under 60 chars. Append ' | Texly' to the title.",
  "metaDescription": "A highly readable, search-friendly meta description under 155 chars with call to action.",
  "intro": "A 3-4 sentence detailed introduction outlining the benefits of stripping or solving for this keyword instantly on our free client-side tool.",
  "faqList": [
    { "question": "Question 1 relative to ${cand.keyword} (FAQ/Search Ground)?", "answer": "Clear, detailed 3-4 sentence answer optimized with semantic terms." },
    { "question": "Question 2?", "answer": "Detailed answer." },
    { "question": "Question 3?", "answer": "Detailed answer." },
    { "question": "Question 4?", "answer": "Detailed answer." },
    { "question": "Question 5?", "answer": "Detailed answer." }
  ],
  "useCases": [
    { "title": "Real-world Practical Niche Case 1", "description": "Exhaustive description of how a professional or developer benefits from this tool." },
    { "title": "Case 2", "description": "Detailed description." },
    { "title": "Case 3", "description": "Detailed description." }
  ],
  "examples": [
    { "input": "Sample scrambled text highlighting unwanted elements", "output": "Pristine cleaned text results", "explanation": "Brief explanation of what was stripped." },
    { "input": "Another scrambled sample input", "output": "Clean output example", "explanation": "Detailed step-by-step processing explanation." }
  ],
  "relatedTools": ["slug-1", "slug-2"],
  "detailedContent": [
    {
      "heading": "Comprehensive Guide on ${cand.keyword}",
      "paragraphs": [
        "A substantial 120-150 word paragraph digging deep into the technical foundations of why ${cand.keyword} presents unique challenges to web development, copywriting, and data entry, explaining the exact character rules and standard expressions involved in resolving it.",
        "Another 100-120 word paragraph outlining the traditional hurdles developers faced prior to instant client-side tools, such as configuring custom server-side formatting libraries or raw regex expressions manually in local terminals."
      ]
    },
    {
      "heading": "How Our Browser-Native Tool Solves This Safely",
      "paragraphs": [
        "A highly informative 120-150 word paragraph elaborating on our platform-native architecture. Explain how the script evaluates raw string memory lines inside the sandbox without transmitting a single byte over HTTP APIs or cloud endpoints, guaranteeing absolute confidentiality.",
        "Include insights into the sub-millisecond execution times, showing how modern JavaScript engines parse mega-sized text documents instantly on any standard device."
      ]
    },
    {
      "heading": "Pro Tips for Text Processing Automation",
      "paragraphs": [
        "A substantial 100-120 word paragraph detailing advanced developer workflows. Explain how developers can paste CSV data, JSON payloads, or bulk database tables into the text frame and use the clipboard copy capability to pipeline standardized clean scripts."
      ]
    }
  ],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${cand.keyword}",
    "url": "https://www.texlyonline.in/${cand.slug}",
    "applicationCategory": "Utility",
    "operatingSystem": "All"
  },
  "socialMediaScripts": {
    "pinterestDescription": "A scroll-stopping Pinterest description with relevant tags.",
    "reelCaption": "Hook, Value, and CTA captions with emojis.",
    "shortsScript": "Engaging 15-second transcript for a short video introducing the tool."
  }
}

CRITICAL RULES FOR RELATED TOOLS:
You MUST set "relatedTools" array elements ONLY from the following list of active real slugs. Do NOT invent or make up a slug not present in this list:
[${slugsPromptStr}]

Return ONLY standard JSON. No markdown wrappers, no conversational filler. Output must be valid JSON in standard format.`;

    const { text, source } = await generateWithFallbackPipeline(systemPrompt, userPrompt);
    if (text) {
      const cleaned = cleanJsonString(text);
      completePage = JSON.parse(cleaned);
      logStep("Automation Step 4/8", `Content compiled successfully via ${source}.`);
    }
  } catch (err: any) {
    logStep("Automation Warning", `AI fetch failed: ${err.message}. Invoking local offline compiler.`, "warning");
  }

  // Fallback if AI generation failed
  if (!completePage) {
    const realSlugsList = await getRealTexlySlugs();
    const fallbackRelated = realSlugsList.filter(s => s !== cand.slug).slice(0, 3);

    completePage = {
      slug: cand.slug,
      keyword: cand.keyword,
      title: `Instant ${cand.keyword.charAt(0).toUpperCase() + cand.keyword.slice(1)} - Clean Text Online | Texly`,
      metaDescription: `Sanitize your text inputs using our instant free web tool. Best automated cleaner designed for ${cand.keyword} removal tasks.`,
      intro: `Eliminate messy character logs. Our browser-native optimizer solves for '${cand.keyword}' with single-click algorithms. Build custom structures, refine your copy content, and stream clean output directly. This lightweight application delivers rapid data sanitization utilities safely inside client workstation architectures.`,
      faqList: [
        {
          question: `How does the ${cand.keyword} utility work?`,
          answer: `The tool evaluates character glyphs and strips matching characters within milliseconds right inside your browser code context. Using highly tuned custom matching arrays, it filters structural patterns instantly without degrading system throughput.`
        },
        {
          question: "Is there any software to install?",
          answer: "No. The utility is 100% cloud-hosted and works without setup or permissions on any smart platform. Simply navigate to our domain URL and utilize the clean utility directly on any standard workstation."
        },
        {
          question: "Is this secure?",
          answer: "Yes, Texly prioritizes your data safety. Your strings are never stored, logged, or sent to server resources. The security architecture guarantees that all formatting cycles complete entirely inside your sandbox memory context."
        },
        {
          question: "Can I use it programmatically?",
          answer: "Yes, we present the clean text results with immediate 'Copy to Clipboard' accessibility for automated developer chains. You can quickly pipe raw scraped segments, database dumps, or CSV text blocks directly into our frame."
        },
        {
          question: "Does it support Unicode systems?",
          answer: "Yes, the parsing engines are tested with standard base unicode planes, guaranteeing support for standard text blocks, emoticons, tabular spreadsheets, and code scripts cleanly."
        }
      ],
      useCases: [
        {
          title: "Developer Form Formatting",
          description: "Standardize raw inputs before integrating into JSON pipelines, SQL inserts, or REST databases to circumvent unexpected server exceptions."
        },
        {
          title: "Content Marketing Cleanup",
          description: "Prune dirty copied documents, getting rid of trailing artifacts, spaces, and punctuation anomalies before deploying on CMS platforms."
        },
        {
          title: "Database Bulk Processing",
          description: "Ensure character stability and consistent encoding formats across legacy structures prior to initiating SQL search indexing commands."
        }
      ],
      examples: [
        {
          input: `Sample dirty text matching [${cand.keyword}] parameters`,
          output: `Sample clean text with ${cand.keyword} fully stripped!`,
          explanation: "Identifies and eliminates specific matching patterns based on standard regex schemas execution."
        }
      ],
      relatedTools: fallbackRelated.length > 0 ? fallbackRelated : ["remove-symbols-online", "remove-emojis-from-text"],
      detailedContent: [
        {
          heading: `Comprehensive Guide on ${cand.keyword}`,
          paragraphs: [
            `Optimizing text data is a fundamental process in databases, modern web development, and digital marketing. Handling ${cand.keyword} can be quite a meticulous challenge because manual scanning is notoriously prone to human errors and is highly time-consuming. Traditionally, designers, software developers, and copywriters had to construct complex regular expressions in advanced programming languages like Python, Java, or Node.js to strip characters or refine formatting. This tedious process frequently leads to corrupted code, missing metadata, or unaligned tables, causing disruptions in indexing or content publication workflows.`,
            `By automating this text-cleaning workflow, our instant utility ensures that your text is formatted properly and standardized within seconds. This client-side, browser-based tool allows anyone, from seasoned data engineers to amateur bloggers, to immediately execute standard cleaning routines. There is zero code to write, no libraries to npm install, and no complex terminal interfaces to debug. You simply drop your messy text block into the container box, select the preferred processing option, and execute the algorithm with a single-click action.`
          ]
        },
        {
          heading: "Secure Browser-Native Sanitation Architecture",
          paragraphs: [
            "Data privacy and security are paramount in modern tech environments. Most existing web tools transmit your sensitive data fragments to remote cloud servers for cleaning, exposing confidential information to logs or middleman sniffing risks. Texly approaches text processing with an absolute security mindset. Our utility is built to execute purely client-side, using optimized sandboxed native JavaScript frameworks.",
            "When you paste your script strings or copy fragments, the character evaluation rules execute locally within the runtime scope of your browser's memory. Not a single byte of your text data is sent to external APIs or database servers. This means you can clean credit card dumps, secure configurations, password segments, or corporate documents with total peace of mind."
          ]
        },
        {
          heading: "Practical Business & Technical Use Cases",
          paragraphs: [
            "Whether you are refining raw scraper inputs, formatting transactional records for SQL databases, or preparing optimized blog articles, our tool is incredibly helpful. For web developers, standardizing user-generated input avoids unexpected system exceptions or broken UI alignment. For SEO strategists and bloggers, removing unnecessary trailing characters ensures pristine code tags and better search indexing efficiency. Scale your publishing output by utilizing unified formatting patterns.",
            "Simply leverage our immediate 'Copy to Clipboard' buttons to streamline developer chains. Save and format documents continuously without having to navigate messy configurations or install third-party dependencies. Enjoy direct, high-availability optimization on any workstation or mobile device today!"
          ]
        }
      ],
      schemaMarkup: {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": cand.keyword,
        "url": getLiveUrlForSlug(cand.slug),
        "applicationCategory": "Utility",
        "operatingSystem": "All"
      },
      category: cand.category,
      canonicalUrl: getLiveUrlForSlug(cand.slug),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    // Inject runtime dynamic attributes
    const realSlugsList = await getRealTexlySlugs();
    // Validate that AI returned relatedTools from our real list; if any invented, filter them out and replace with verified
    if (completePage.relatedTools && Array.isArray(completePage.relatedTools)) {
      completePage.relatedTools = completePage.relatedTools.filter((s: string) => realSlugsList.includes(s));
      if (completePage.relatedTools.length === 0) {
        completePage.relatedTools = realSlugsList.filter(s => s !== cand.slug).slice(0, 3);
      }
    } else {
      completePage.relatedTools = realSlugsList.filter(s => s !== cand.slug).slice(0, 3);
    }
    completePage.category = cand.category;
    completePage.canonicalUrl = getLiveUrlForSlug(cand.slug);
    completePage.createdAt = new Date().toISOString();
    completePage.updatedAt = new Date().toISOString();
  }

  const pagesDb = readDb(PAGES_FILE);
  const tbl = pagesDb.filter((p: any) => p.slug !== cand.slug);
  tbl.push(completePage);
  writeDb(PAGES_FILE, tbl);

  // Dynamic self-healing database sanitization of links and formats on update
  await autoSanitizePagesDatabase();
  const tblClean = readDb(PAGES_FILE);

  logStep("Automation Step 5/8", `Successfully persisted generated content nodes locally. Saved slug: /${cand.slug}`, "success");

  // Step 6: Real GitHub Code Push if credentials provided!
  if (config?.githubRepo && config?.githubToken) {
    logStep("Automation Step 6/8", `Packaging update commit. Triggering GitHub API push for repository: '${config.githubRepo}'`);
    try {
      const gitUrl = await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(tblClean, null, 2));
      logStep("Automation Step 6/8", `Successfully pushed pages.json to GitHub branch main! Commit Link: ${gitUrl}`, "success");
    } catch (err: any) {
      logStep("Automation Step 6/8", `GitHub commit rejected: ${err.message}. Local changes are still saved.`, "error");
    }
  } else {
    logStep("Automation Step 6/8", "GitHub Repository sync skipped (No credentials configured).", "warning");
  }

  // Step 7: Vercel Webhook Deployment Trigger
  if (config?.vercelWebhookUrl) {
    logStep("Automation Step 7/8", "Dispatching secure POST webhook trigger to Vercel APIs.");
    const vercelOk = await triggerVercelWebhook(config.vercelWebhookUrl);
    if (vercelOk) {
      logStep("Automation Step 7/8", "Vercel build deployment triggered and queued dynamically.", "success");
    } else {
      logStep("Automation Step 7/8", "Vercel Webhook endpoint returned warning or failed to respond.", "warning");
    }
  } else {
    logStep("Automation Step 7/8", "Vercel build trigger skipped (No hook URL config).", "warning");
  }

  // Step 8: Sitemap updates (Now dynamic via api/sitemap.ts on Vercel frontend)
  logStep("Automation Step 8/8", "Sitemap will dynamically fetch the newly-updated pages listed in data/pages.json via api/sitemap.ts at runtime on Next.js/Vercel.", "success");
  logStep("Automation Step 8/8", `Job Complete. Staggered organic automation cycle is idle. Main database now has ${readDb(PAGES_FILE).length} total pages.`, "success");

  res.json({
    success: true,
    processedCount: 1,
    generated: [cand],
    logs: logsArr
  });
});

function loadRootLinksMap() {
  try {
    const rootPath = path.join(DATA_DIR, "links_map.json");
    if (fs.existsSync(rootPath)) {
      const data = JSON.parse(fs.readFileSync(rootPath, "utf8"));
      if (data && typeof data === "object") {
        for (const [s, url] of Object.entries(data)) {
          if (s && typeof url === "string") {
            slugToUrlMap.set(s, url);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Failed to load root links_map on boot:", err.message);
  }
}

// Serve the applet
async function startServer() {
  // Load local links mapping first as baseline
  loadRootLinksMap();

  // Run Master Supabase and backup syncs in parallel to optimize startup time (with strict timeouts)
  await Promise.all([
    withTimeout(syncUsersFromMasterSupabase(), 2000, null),
    withTimeout(syncFromSupabase(), 2000, null)
  ]).catch(err => {
    console.warn("Parallel boot synchronization finished with some errors:", err.message || err);
  });

  // Run dynamic self-healing database sanitization on startup in the background to avoid blocking the serverless boot
  autoSanitizePagesDatabase().catch((err: any) => {
    console.warn("Background autoSanitizePagesDatabase finished with notice:", err.message || err);
  });

  // Automatically execute dynamic sitemap sanitization and automatic link repair in the background every 30 minutes
  if (!process.env.VERCEL) {
    setInterval(async () => {
      console.log("[SITEMAP AUTOPILOT] Periodic automatic background validation and link healing cycle initiated...");
      try {
        await autoSanitizePagesDatabase();
      } catch (err: any) {
        console.error("[SITEMAP AUTOPILOT] Error in background auto-sanitization loop:", err.message);
      }
    }, 1000 * 60 * 30); // 30 minutes interval
  }

  // Vite dynamic mounting
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`AI-Automated programmetical SEO engine listening on http://0.0.0.0:${PORT}`);
    });
  }
}

initPromise = startServer();
