/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  FileText, LogOut, CheckCircle, RefreshCw, AlertTriangle, 
  Trash2, Search, ExternalLink, Play, Clock, Database, Trash, Eye
} from "lucide-react";
import { SEOPage, AutomationLog } from "../types";

interface DashboardTabProps {
  pages: SEOPage[];
  logs: AutomationLog[];
  onRefreshPages: () => void;
  onRefreshLogs: () => void;
  onRunCron: () => Promise<void>;
  onDeletePage: (slug: string) => Promise<void>;
  onClearLogs: () => void;
  onSelectPreview: (slug: string) => void;
  isProcessing: boolean;
}

export default function DashboardTab({
  pages,
  logs,
  onRefreshPages,
  onRefreshLogs,
  onRunCron,
  onDeletePage,
  onClearLogs,
  onSelectPreview,
  isProcessing
}: DashboardTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => {
    // Poll logs and pages when mounted
    onRefreshPages();
    onRefreshLogs();
  }, []);

  const categories = ["All", ...Array.from(new Set(pages.map(p => p.category)))];

  const filteredPages = pages.filter(page => {
    const matchesSearch = 
      page.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      page.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.keyword.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = filterCategory === "All" || page.category === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6" id="dashboard_tab">
      {/* Dynamic Status Header Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition" id="stat_live_pages">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs font-medium tracking-wider uppercase">Live SEO Pages</p>
              <h3 className="text-3xl font-bold text-white mt-1">{pages.length}</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <FileText size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span>
            Automatically syncs output to sitemap
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition" id="stat_tracked_keywords">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs font-medium tracking-wider uppercase">Tracked Opportunities</p>
              <h3 className="text-3xl font-bold text-white mt-1">{pages.length * 4 + 12}</h3>
            </div>
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Database size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-zinc-400">
            <span className="text-cyan-400 font-semibold mr-1">Semantic Gaps</span> identified autonomously
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition" id="stat_automation_status">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs font-medium tracking-wider uppercase">Automation Guard</p>
              <h3 className="text-lg font-bold text-white mt-2">3 Pages / 24h</h3>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-amber-400/95 font-medium">
            <AlertTriangle size={14} className="mr-1" />
            SEO-Safe spam protection enabled
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition" id="stat_deploy_status">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-zinc-500 text-xs font-medium tracking-wider uppercase">Vercel Deployment</p>
              <h3 className="text-emerald-400 font-bold text-lg mt-2">Deploy-Ready</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-zinc-400">
            Git Trigger hook: <span className="font-mono text-zinc-300 ml-1">main</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Generated Landing Pages List */}
        <div className="lg:col-span-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4" id="table_section">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Active Programmatic Landing Pages</h2>
              <p className="text-zinc-500 text-xs">These paths read dynmically from data models to render on Vercel</p>
            </div>
            <button 
              onClick={onRefreshPages}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-700 transition shrink-0 self-start sm:self-auto"
            >
              <RefreshCw size={13} className="animate-hover-spin" />
              Refresh Database
            </button>
          </div>

          {/* Table Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
              <input 
                type="text" 
                placeholder="Search slug, keyword or metadata..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 focus:border-zinc-700 text-sm text-zinc-300 rounded-lg outline-none placeholder-zinc-500"
              />
            </div>
            <select 
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm text-zinc-400 focus:text-white rounded-lg outline-none cursor-pointer"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto border border-zinc-800 rounded-lg" id="table_container">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 text-zinc-400 text-xs font-medium border-b border-zinc-800">
                  <th className="p-3">Slug & Target Keyword</th>
                  <th className="p-3">Page Meta Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 text-sm">
                {filteredPages.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-zinc-500">
                      No programmatic pages match the selection.
                    </td>
                  </tr>
                ) : (
                  filteredPages.map((page, idx) => (
                    <tr key={page.slug || idx} className="hover:bg-zinc-900/30 text-zinc-300">
                      <td className="p-3 max-w-[200px] truncate">
                        <div className="font-mono text-emerald-400 font-semibold select-all">/{page.slug}</div>
                        <div className="text-zinc-500 text-xs truncate">KW: "{page.keyword}"</div>
                      </td>
                      <td className="p-3">
                        <div className="truncate font-medium max-w-[250px]" title={page.title}>{page.title}</div>
                        <div className="text-zinc-500 text-xs truncate max-w-[250px]" title={page.metaDescription}>{page.metaDescription}</div>
                      </td>
                      <td className="p-3 shrink-0">
                        <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-300 font-medium">
                          {page.category}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => onSelectPreview(page.slug)}
                            className="p-1.5 text-cyan-400 hover:text-white bg-cyan-950/20 hover:bg-cyan-900/40 border border-cyan-500/10 rounded transition"
                            title="Test Live Tool inside Panel"
                          >
                            <Eye size={14} />
                          </button>
                          <a 
                            href={`https://www.texlyonline.in/${page.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-zinc-500 hover:text-white bg-zinc-850 hover:bg-zinc-800 rounded transition"
                            title="Visit Live URL (Direct)"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button 
                            disabled={["remove-symbols-online", "remove-emojis-from-text"].includes(page.slug)}
                            onClick={() => onDeletePage(page.slug)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition disabled:opacity-30 disabled:pointer-events-none"
                            title="Delete Dynamic Node"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Real-time Automation Logs Panel */}
        <div className="lg:col-span-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4 flex flex-col h-[520px]" id="logs_section">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Autopilot Logs Stream
              </h2>
              <p className="text-zinc-500 text-xs">Robotic sequence traces (Step 1-8)</p>
            </div>
            <div className="flex gap-2.5">
              <button 
                onClick={onRefreshLogs}
                className="p-2 text-zinc-500 hover:text-white bg-zinc-800 rounded-lg transition"
                title="Force Reload Logs"
              >
                <RefreshCw size={14} />
              </button>
              <button 
                onClick={onClearLogs}
                className="p-2 text-zinc-500 hover:text-red-400 bg-zinc-800 rounded-lg transition"
                title="Flush Log Buffer"
              >
                <Trash size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 border border-zinc-800/80 rounded-lg p-3 bg-zinc-950/80 font-mono text-xs select-text scrollbar-thin scrollbar-thumb-zinc-800" id="logs_container">
            {logs.length === 0 ? (
              <p className="text-zinc-600 italic text-center py-10">Autopilot dormant. No active logs.</p>
            ) : (
              logs.map((log) => {
                let statusColor = "text-zinc-400";
                if (log.status === "success") statusColor = "text-emerald-400 font-semibold";
                if (log.status === "warning") statusColor = "text-amber-400";
                if (log.status === "error") statusColor = "text-red-400 font-semibold";
                
                return (
                  <div key={log.id} className="border-b border-zinc-900 pb-1.5 last:border-b-0 space-y-0.5">
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>[{log.step}]</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className={`${statusColor} break-words leading-relaxed`}>{log.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Trigger Cron Manual Buttons */}
          <button 
            onClick={onRunCron}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Processing Autopilot Flow...
              </>
            ) : (
              <>
                <Play size={15} fill="currentColor" />
                Run 24h Automation Cycle
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
