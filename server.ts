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

dotenv.config();

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

  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error("Invalid repository format. Must be 'owner/repo'.");
  }

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

function generateSitemapXml(pages: any[]): string {
  const today = new Date().toISOString().split("T")[0];
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // 1. Home Page URL
  xml += `  <url>\n`;
  xml += `    <loc>https://www.texlyonline.in/</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;

  // 2. Add Dynamic Page URLs
  for (const page of pages) {
    if (!page.slug) continue;
    const itemDate = page.updatedAt ? page.updatedAt.split("T")[0] : today;
    xml += `  <url>\n`;
    xml += `    <loc>https://www.texlyonline.in/${page.slug}</loc>\n`;
    xml += `    <lastmod>${itemDate}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  return xml;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent Data Paths
const DATA_DIR = path.join(process.cwd(), "data");
const PAGES_FILE = path.join(DATA_DIR, "pages.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

// Ensure Data Directory Exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
let supabaseClient: any = null;

function getSupabaseClient(): any {
  if (supabaseClient) return supabaseClient;

  // 1. Try process env variables
  let url = process.env.SUPABASE_URL;
  let key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  // 2. Try loaded configuration file
  if (!url || !key) {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
        if (!url) url = config?.supabaseUrl;
        if (!key) key = config?.supabaseKey;
      }
    } catch (e) {}
  }

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      return supabaseClient;
    } catch (err) {
      console.error("Failed to initialize Supabase client:", err);
    }
  }
  return null;
}

async function seedSupabaseWithLocalData(supabase: any) {
  try {
    const pages = JSON.parse(fs.readFileSync(PAGES_FILE, "utf8"));
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"));

    const items = [
      { key: "pages", data: pages },
      { key: "config", data: config },
      { key: "logs", data: logs }
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
  // Free client to ensure we pick up fresh credentials
  supabaseClient = null;
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("Supabase URL and Key not configured. Using local JSON store.");
    return;
  }

  console.log("Supabase credentials detected! Restoring latest backup state from Supabase to survive Render restarts...");
  try {
    const { data: records, error } = await supabase
      .from("texly_storage")
      .select("*");

    if (error) {
       console.log("Supabase table 'texly_storage' fetch info (table may need to be created):", error.message);
       console.log("Seeding current local state to cloud Supabase now...");
       await seedSupabaseWithLocalData(supabase);
       return;
    }

    if (records && records.length > 0) {
      console.log(`Successfully fetched ${records.length} dataset tables from Supabase cloud!`);
      for (const record of records) {
        if (record.key === "pages") {
          fs.writeFileSync(PAGES_FILE, JSON.stringify(record.data, null, 2), "utf8");
          console.log(`- Restored ${record.data.length} SEO Landing page structures from Supabase.`);
        } else if (record.key === "config") {
          let localConf = {};
          try { localConf = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch (e) {}
          const merged = { ...localConf, ...record.data };
          fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), "utf8");
          console.log(`- Restored system configuration from Supabase.`);
        } else if (record.key === "logs") {
          fs.writeFileSync(LOGS_FILE, JSON.stringify(record.data, null, 2), "utf8");
          console.log(`- Restored system automation log history lists from Supabase.`);
        }
      }
    } else {
      console.log("Supabase records are empty. Seeding with local files...");
      await seedSupabaseWithLocalData(supabase);
    }
  } catch (err: any) {
    console.error("Warning syncing from Supabase:", err.message);
  }
}

// Read helper functions (Synchronous memory wrapper)
function readDb(file: string) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (file === CONFIG_FILE && raw && !Array.isArray(raw)) {
      if (!raw.adminUsername) raw.adminUsername = "admin";
      if (!raw.adminPassword) raw.adminPassword = "admin123";
    }
    return raw;
  } catch (err) {
    return [];
  }
}

function writeDb(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

  if (file === CONFIG_FILE) {
    // Force recreate client on any config save to read potential credentials updates
    supabaseClient = null;
  }

  // Asynchronously synchronize configuration changes to Supabase cloud!
  const supabase = getSupabaseClient();
  if (supabase) {
    let key = "";
    if (file === PAGES_FILE) key = "pages";
    else if (file === CONFIG_FILE) key = "config";
    else if (file === LOGS_FILE) key = "logs";

    if (key) {
      supabase
        .from("texly_storage")
        .upsert({ key, data })
        .then(({ error }: any) => {
          if (error) {
            console.error(`- Supabase push failed for key [${key}]: ${error.message}`);
          } else {
            console.log(`- Supabase real-time sync success for key : [${key}]`);
          }
        })
        .catch((err: any) => {
          console.error(`- Supabase push throw error for key [${key}]:`, err.message);
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

// Lazy Gemini Client Initialization
let cachedApiKey: string | null = null;
let aiClient: any = null;
function getGeminiClient(): any {
  const config = readDb(CONFIG_FILE);
  const key = config?.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (aiClient && cachedApiKey === key) {
    return aiClient;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    cachedApiKey = key;
    return aiClient;
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
    return null;
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Admin Login Endpoint (username and password match server settings)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const config = readDb(CONFIG_FILE);
  const correctUser = config.adminUsername || "admin";
  const correctPass = config.adminPassword || "admin123";

  if (username === correctUser && password === correctPass) {
    // Generate simple robust Bearer base64 authorization token
    const token = Buffer.from(`${username}:${password}`).toString("base64");
    return res.json({ success: true, token, message: "लॉगिन सफल!" });
  } else {
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

    const config = readDb(CONFIG_FILE);
    const correctUser = config.adminUsername || "admin";
    const correctPass = config.adminPassword || "admin123";

    if (username === correctUser && password === correctPass) {
      return res.json({ success: true, user: { username } });
    }
  } catch (err) {}

  return res.status(401).json({ success: false, message: "लॉगिन सत्र समाप्त या अमान्य।" });
});

// 3. Global Admin Access Protection Middleware
app.use((req, res, next) => {
  // Pass non-API requests and auth endpoints
  if (!req.path.startsWith("/api/") || req.path === "/api/login" || req.path === "/api/verify-auth") {
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

    const config = readDb(CONFIG_FILE);
    const correctUser = config.adminUsername || "admin";
    const correctPass = config.adminPassword || "admin123";

    if (username === correctUser && password === correctPass) {
      return next();
    }
  } catch (err) {}

  return res.status(401).json({ success: false, error: "Unauthorized", message: "लॉगिन क्रेडेंशियल अमान्य या पुराना हो चुका है।" });
});

// Get all generated SEO pages
app.get("/api/pages", (req, res) => {
  const pages = readDb(PAGES_FILE);
  res.json({ success: true, count: pages.length, pages });
});

// Serve the dynamic sitemap.xml to queries and search engines
app.get("/sitemap.xml", (req, res) => {
  try {
    const pages = readDb(PAGES_FILE);
    const sitemapXml = generateSitemapXml(pages);
    res.header("Content-Type", "application/xml");
    res.status(200).send(sitemapXml);
  } catch (err: any) {
    res.status(500).send(`<error>${err.message}</error>`);
  }
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
  const apiKey = (req.query.apiKey as string) || config?.groqApiKey;

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
    console.error("Failed to load Groq models:", err.message);
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
  res.json({ success: true, config });
});

// Update configuration
app.post("/api/config/save", (req, res) => {
  const config = readDb(CONFIG_FILE);
  const updated = { ...config, ...req.body };
  writeDb(CONFIG_FILE, updated);
  appendLog("Config Update", "System automation panel configs updated.", "success");
  res.json({ success: true, config: updated });
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
app.delete("/api/pages/:slug", (req, res) => {
  const slug = req.params.slug;
  const pages = readDb(PAGES_FILE);
  const filtered = pages.filter((p: any) => p.slug !== slug);
  if (pages.length === filtered.length) {
    return res.status(404).json({ success: false, message: "Page not found" });
  }
  writeDb(PAGES_FILE, filtered);
  appendLog("Page Management", `Deleted generated page with slug: /${slug}`, "warning");
  res.json({ success: true, message: `Page /${slug} successfully deleted.` });
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

  // 1. Centralized High-Availability Pipeline Generator (Gemini -> Groq -> OpenRouter)
  try {
    const systemPrompt = "You are a professional search engine copywriter focused on high-quality web tools description content.";
    const userPrompt = `Your job is to construct a perfect Programmatic SEO JSON object detailing content for a new utility website tool on TexlyOnline.
Target Keyword: "${keyword}"
Niche Category: "${category || "Utility Tool"}"
Slug Name: "${slug}"

Generate a raw JSON object matching the following structure exactly. Make it sound helpful, concise, optimized for Google, ChatGPT Search, Gemini and Claude. Complete all text fully with no abbreviations:

{
  "slug": "${slug}",
  "keyword": "${keyword}",
  "title": "A perfect catchy SEO Title under 60 chars. Append ' | Texly' to the title.",
  "metaDescription": "A highly readable, search-friendly meta description under 155 chars with call to action.",
  "intro": "A 2-3 sentence introduction outlining the benefits of stripping or solving for this keyword instantly on our free client-side tool.",
  "faqList": [
    { "question": "Question 1 relative to ${keyword} (FAQ/Search Ground)?", "answer": "Clear, detailed 2 sentence answer optimized with semantic links." },
    { "question": "Question 2?", "answer": "Answer etc." },
    { "question": "Question 3?", "answer": "Answer etc." },
    { "question": "Question 4?", "answer": "Answer etc." },
    { "question": "Question 5?", "answer": "Answer etc." }
  ],
  "useCases": [
    { "title": "Real-world Practical Niche Case 1", "description": "How the user benefits from this specific tool." },
    { "title": "Case 2", "description": "Detailed description." },
    { "title": "Case 3", "description": "Detailed description." }
  ],
  "examples": [
    { "input": "Sample scrambled text highlighting unwanted elements", "output": "Pristine cleaned text results", "explanation": "Brief explanation of what was stripped." },
    { "input": "Another scrambled sample input", "output": "Clean output example", "explanation": "Explanation etc." }
  ],
  "relatedTools": ["remove-symbols-online", "remove-emojis-from-text"],
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
    "reelCaption": "Hook, Value, and CTA captions with emojis for reels etc.",
    "shortsScript": "Engaging 15-second transcript for a short video introducing the tool."
  }
}

Return ONLY standard JSON. No markdown wrappings, no extra descriptions. Return strictly standard JSON.`;

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
      canonicalUrl: `https://www.texlyonline.in/${slug}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    filtered.push(completePage);
    writeDb(PAGES_FILE, filtered);

    appendLog("Content Generator", `Page generated using ${source} and persisted successfully. Slug: /${slug}`, "success");
    return res.json({ success: true, source, page: completePage });

  } catch (err: any) {
    appendLog("Content Generator", `AI Fallback Pipeline failed: ${err.message}. Invoking programmatic content synthesis fallback.`, "warning");
  }

  // Fallback programmatic generation when Gemini is not configured/offline
  const offlinePage = {
    slug,
    keyword,
    title: `Instant ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} - Clean Text Online | Texly`,
    metaDescription: `Sanitize your text inputs using our instant free web tool. Best automated cleaner designed for ${keyword} removal tasks.`,
    intro: `Eliminate messy character logs. Our browser-native optimizer solves for '${keyword}' with single-click algorithms. Build custom structures, refine your copy content, and stream clean output directly.`,
    faqList: [
      {
        question: `How does the ${keyword} utility work?`,
        answer: "The tool evaluates character glyphs and strips matching characters within milliseconds right inside your browser code context."
      },
      {
        question: "Is there any software to install?",
        answer: "No. The utility is 100% cloud-hosted and works without setup or permissions on any smart platform."
      },
      {
        question: "Is this secure?",
        answer: "Yes, Texly prioritizes your data safety. Your strings are never stored, logged, or sent to server resources."
      },
      {
        question: "Can I use it programmatically?",
        answer: "Yes, we present the clean text results with immediate 'Copy to Clipboard' accessibility for automated developer chains."
      },
      {
        question: "Does it support Unicode systems?",
        answer: "Yes, the parsing engines are tested with standard base unicode planes, guaranteeing support for standard text blocks!"
      }
    ],
    useCases: [
      {
        title: "Developer Form Formatting",
        description: "Standardize raw inputs before integrating into JSON pipelines or REST databases."
      },
      {
        title: "Content Marketing Cleanup",
        description: "Prune dirty copied documents, getting rid of trailing artifacts before deploying on CMS platforms."
      },
      {
        title: "Database Bulk Processing",
        description: "Ensure character stability across legacy structures prior to initiating SQL search indexing."
      }
    ],
    examples: [
      {
        input: `Sample dirty text matching [${keyword}] parameters`,
        output: `Sample clean text with ${keyword} fully stripped!`,
        explanation: "Identifies and eliminates specific matching patterns based on standard regex schemas."
      }
    ],
    relatedTools: ["remove-symbols-online", "remove-emojis-from-text"],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": keyword,
      "url": `https://www.texlyonline.in/${slug}`,
      "applicationCategory": "Utility",
      "operatingSystem": "All"
    },
    category: category || "Text Cleaners",
    canonicalUrl: `https://www.texlyonline.in/${slug}`,
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
    const systemPrompt = "You are a professional search engine copywriter focused on high-quality web tools description content.";
    const userPrompt = `Your job is to construct a perfect Programmatic SEO JSON object detailing content for a new utility website tool on TexlyOnline.
Target Keyword: "${cand.keyword}"
Niche Category: "${cand.category}"
Slug Name: "${cand.slug}"

Generate a raw JSON object matching the following structure exactly. Make it sound helpful, concise, optimized for Google, ChatGPT Search, Gemini and Claude. Complete all text fully with no abbreviations:

{
  "slug": "${cand.slug}",
  "keyword": "${cand.keyword}",
  "title": "${cand.keyword.charAt(0).toUpperCase() + cand.keyword.slice(1)} - Clean Text Online | Texly",
  "metaDescription": "Easily process your string inputs with Texly's instant free web tool.",
  "intro": "Clean up cluttered characters dynamically. Designed with pure client-side processing.",
  "faqList": [
    { "question": "Is this tool free and secure?", "answer": "Yes, everything runs inside your web browser." }
  ],
  "useCases": [
    { "title": "Bulk Text Formatting", "description": "Quick copy for legal or content formatting." }
  ],
  "examples": [
    { "input": "Sample test inputs", "output": "Clean results", "explanation": "Detailed summary." }
  ],
  "relatedTools": ["remove-symbols-online", "remove-emojis-from-text"],
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${cand.keyword}",
    "url": "https://www.texlyonline.in/${cand.slug}",
    "applicationCategory": "Utility",
    "operatingSystem": "All"
  },
  "socialMediaScripts": {
    "pinterestDescription": "Prune your lines fast with our online text tools. #seo #productivity",
    "reelCaption": "No regex manual coding. Just one-click text cleaners! Link in bio. 🔥📱",
    "shortsScript": "Writing boring code scripts? Open Texly in browser for instant sanitization!"
  }
}

Return ONLY standard JSON. No markdown wrappers, no descriptions.`;

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
    completePage = {
      slug: cand.slug,
      keyword: cand.keyword,
      title: `${cand.keyword.charAt(0).toUpperCase() + cand.keyword.slice(1)} - Free Utility | Texly`,
      metaDescription: `Fast browser tool to do ${cand.keyword} instantly. Safely formatted, secure, and responsive.`,
      intro: `Convert and format scripts instantly. Best professional ${cand.keyword} engine styled with tailwind CSS.`,
      faqList: [
        {
          question: `Is it really free?`,
          answer: `Yes, all programmatic tools on Texly are 100% free with no tracking.`
        }
      ],
      useCases: [{ title: "Bulk Cleaning", description: "Useful for marketing workflows" }],
      examples: [{ input: "Raw text input sample", output: "Beautiful outputs", explanation: "Details" }],
      relatedTools: ["remove-symbols-online", "remove-emojis-from-text"],
      schemaMarkup: {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "name": cand.keyword,
        "url": `https://www.texlyonline.in/${cand.slug}`,
        "applicationCategory": "Utility"
      },
      category: cand.category,
      canonicalUrl: `https://www.texlyonline.in/${cand.slug}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  } else {
    // Inject runtime dynamic attributes
    completePage.category = cand.category;
    completePage.canonicalUrl = `https://www.texlyonline.in/${cand.slug}`;
    completePage.createdAt = new Date().toISOString();
    completePage.updatedAt = new Date().toISOString();
  }

  const pagesDb = readDb(PAGES_FILE);
  const tbl = pagesDb.filter((p: any) => p.slug !== cand.slug);
  tbl.push(completePage);
  writeDb(PAGES_FILE, tbl);

  logStep("Automation Step 5/8", `Successfully persisted generated content nodes locally. Saved slug: /${cand.slug}`, "success");

  // Step 6: Real GitHub Code Push if credentials provided!
  if (config?.githubRepo && config?.githubToken) {
    logStep("Automation Step 6/8", `Packaging update commit. Triggering GitHub API push for repository: '${config.githubRepo}'`);
    try {
      const gitUrl = await pushToGitHub(config.githubRepo, config.githubToken, JSON.stringify(tbl, null, 2));
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

  // Step 8: Sitemap updates
  logStep("Automation Step 8/8", "Refreshing dynamic 'sitemap.xml' mapping inside local datastore matrix.");
  if (config?.githubRepo && config?.githubToken) {
    try {
      const sitemapContent = generateSitemapXml(readDb(PAGES_FILE));
      const sitemapUrl = await pushToGitHub(config.githubRepo, config.githubToken, sitemapContent, "public/sitemap.xml");
      logStep("Automation Step 8/8", `Successfully generated and pushed sitemap.xml to GitHub! Commitment verified.`, "success");
    } catch (err: any) {
      logStep("Automation Step 8/8", `Sitemap GitHub push failed: ${err.message}. Changes saved locally.`, "error");
    }
  } else {
    logStep("Automation Step 8/8", "Sitemap GitHub push skipped (No credentials configured).", "warning");
  }
  logStep("Automation Step 8/8", `Job Complete. Staggered organic automation cycle is idle. Main database now has ${readDb(PAGES_FILE).length} total pages.`, "success");

  res.json({
    success: true,
    processedCount: 1,
    generated: [cand],
    logs: logsArr
  });
});

// Serve the applet
async function startServer() {
  // Sync persistent backup state from Supabase if configured
  await syncFromSupabase();

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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI-Automated programmetical SEO engine listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
