/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Globe, Check, RefreshCw, Layers, ArrowRight, Eye, ShieldCheck, 
  Sparkles, Search, CheckSquare, Square, AlertCircle, Send, HeartPulse,
  Edit2, Trash2, Plus, X
} from "lucide-react";
import { SEOPage } from "../types";

interface SitemapTabProps {
  pages: SEOPage[];
  onRefreshPages: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

export default function SitemapTab({ pages, onRefreshPages, getAuthHeaders }: SitemapTabProps) {
  const [liveSlugs, setLiveSlugs] = useState<string[]>([]);
  const [loadingSitemap, setLoadingSitemap] = useState(false);
  const [sitemapError, setSitemapError] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("https://www.texlyonline.in/api/sitemap");

  // Filter preset for local pages (All vs Linked vs Unlinked)
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Slug existence verification helper
  const isSlugValid = (slug: string) => {
    if (!slug) return false;
    return liveSlugs.includes(slug) || pages.some(p => p.slug === slug);
  };

  // Selected SEO Page for link configuring
  const [selectedPageSlug, setSelectedPageSlug] = useState<string>("");
  const [pageSearch, setPageSearch] = useState("");
  const [slugSearch, setSlugSearch] = useState("");
  
  // Local modifications for the selected page's companion tools
  const [selectedCompanionTools, setSelectedCompanionTools] = useState<string[]>([]);
  const [savingLinks, setSavingLinks] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);

  // States for custom manual entry additions and inline edits of slugs
  const [customToolInput, setCustomToolInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // States for standard page details editor
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFormKeyword, setEditFormKeyword] = useState("");
  const [editFormSlug, setEditFormSlug] = useState("");
  const [editFormTitle, setEditFormTitle] = useState("");
  const [editFormCategory, setEditFormCategory] = useState("");
  const [editFormIntro, setEditFormIntro] = useState("");
  const [editFormRelatedLinks, setEditFormRelatedLinks] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);

  // States for page deletion confirmation flow
  const [deletingPageSlug, setDeletingPageSlug] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch verified active slugs from the server
  const fetchSitemapSlugs = async () => {
    setLoadingSitemap(true);
    setSitemapError(null);
    try {
      const res = await fetch("/api/sitemap/slugs", {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setLiveSlugs(data.slugs || []);
        if (data.sourceUrl) {
          setSourceUrl(data.sourceUrl);
        }
      } else {
        setSitemapError(data.message || "Failed to load dynamic sitemap database.");
      }
    } catch (err: any) {
      setSitemapError(`सर्वर एरर: ${err.message}. Please verify development server is running.`);
    } finally {
      setLoadingSitemap(false);
    }
  };

  // Load sitemap on mount
  useEffect(() => {
    fetchSitemapSlugs();
  }, []);

  // When selected page changes, sync the active checkboxes and standard form values
  const activePageObj = pages.find(p => p.slug === selectedPageSlug);
  useEffect(() => {
    if (activePageObj) {
      setSelectedCompanionTools(activePageObj.relatedTools || []);
      setSaveStatus(null);
      setIsEditingDetails(false);
      setEditFormKeyword(activePageObj.keyword || "");
      setEditFormSlug(activePageObj.slug || "");
      setEditFormTitle(activePageObj.title || "");
      setEditFormCategory(activePageObj.category || "Utility");
      setEditFormIntro(activePageObj.intro || "");
      setEditFormRelatedLinks((activePageObj.relatedTools || []).join(", "));
    } else {
      setSelectedCompanionTools([]);
      setEditFormKeyword("");
      setEditFormSlug("");
      setEditFormTitle("");
      setEditFormCategory("");
      setEditFormIntro("");
      setEditFormRelatedLinks("");
    }
  }, [selectedPageSlug, pages]);

  // Set default initial page selection once pages load
  useEffect(() => {
    if (pages.length > 0 && !selectedPageSlug) {
      setSelectedPageSlug(pages[0].slug);
    }
  }, [pages]);

  // Save page standard details back to server pages.json
  const handleSavePageDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPageSlug) return;
    
    const cleanFormSlug = editFormSlug.trim().toLowerCase();
    if (!cleanFormSlug) {
      setSaveStatus({ success: false, message: "स्लग का खाली होना अनुमत नहीं है।" });
      return;
    }

    const parsedRelatedTools = editFormRelatedLinks
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    setSavingDetails(true);
    setSaveStatus(null);

    try {
      const res = await fetch("/api/pages/update-details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          originalSlug: selectedPageSlug,
          slug: cleanFormSlug,
          keyword: editFormKeyword,
          title: editFormTitle,
          category: editFormCategory,
          intro: editFormIntro,
          relatedTools: parsedRelatedTools
        })
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus({ success: true, message: data.message });
        setIsEditingDetails(false);
        await onRefreshPages(); // refresh layout database
        setSelectedPageSlug(cleanFormSlug); // select renamed slug
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        setSaveStatus({ success: false, message: data.message || "विवरण सुरक्षित करने में असमर्थ।" });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: `सुरक्षित करने में त्रुटि: ${err.message}` });
    } finally {
      setSavingDetails(false);
    }
  };

  // AI Content Rewriter Handler (AI से कंटेंट दोबारा लिखें)
  const handleAiRewrite = async () => {
    if (!editFormKeyword) {
      setSaveStatus({ success: false, message: "AI से कंटेंट रीराइट कराने के लिए पहले एक कीवर्ड दर्ज करें।" });
      return;
    }

    setIsRewriting(true);
    setSaveStatus(null);

    try {
      const res = await fetch("/api/pages/rewrite-intro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          keyword: editFormKeyword,
          currentIntro: editFormIntro,
          category: editFormCategory
        })
      });

      const data = await res.json();
      if (data.success) {
        setEditFormIntro(data.rewrittenIntro);
        setSaveStatus({ success: true, message: "AI ने सफलतापूर्वक नया आकर्षक कंटेंट लिख दिया है!" });
        setTimeout(() => setSaveStatus(null), 5000);
      } else {
        setSaveStatus({ success: false, message: data.message || "AI कंटेंट रीराइट करने में विफल रहा।" });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: `रीराइट त्रुटि: ${err.message}` });
    } finally {
      setIsRewriting(false);
    }
  };

  // Delete a page entirely from server database pages.json with instant push
  const handleDeletePage = async (slug: string) => {
    setIsDeleting(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/pages/${slug}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus({ success: true, message: data.message });
        setDeletingPageSlug(null);
        await onRefreshPages(); // reload list
        
        // Pick safety selection next
        const remaining = pages.filter(p => p.slug !== slug);
        if (remaining.length > 0) {
          setSelectedPageSlug(remaining[0].slug);
        } else {
          setSelectedPageSlug("");
        }
        setTimeout(() => setSaveStatus(null), 7000);
      } else {
        setSaveStatus({ success: false, message: data.message || "पेज डिलीट नहीं हो सका।" });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: `पेज डिलीट करने में विफलता: ${err.message}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle dynamic slug selection in related tools array
  const handleToggleSlug = (slug: string) => {
    setSelectedCompanionTools(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      } else {
        return [...prev, slug];
      }
    });
  };

  // Add direct custom unrelated/arbitrary slug manually
  const handleAddCustomTool = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTool = customToolInput.trim().toLowerCase();
    if (!cleanTool) return;
    
    if (selectedCompanionTools.includes(cleanTool)) {
      setSaveStatus({ success: false, message: `स्लग /${cleanTool} पहले से जोड़ा जा चुका है!` });
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }
    
    if (cleanTool === activePageObj?.slug) {
      setSaveStatus({ success: false, message: "आप उसी पेज को स्वयं में सम्बद्ध नहीं कर सकते।" });
      setTimeout(() => setSaveStatus(null), 5000);
      return;
    }

    setSelectedCompanionTools(prev => [...prev, cleanTool]);
    setCustomToolInput("");
    setSaveStatus({ success: true, message: `स्लग /${cleanTool} को अस्थायी सूची में जोड़ा गया। सेव व डिप्लॉय पर क्लिक करें!` });
    setTimeout(() => setSaveStatus(null), 6000);
  };

  // Start inline editing of slug name
  const handleStartEditing = (idx: number, currentSlug: string) => {
    setEditingIndex(idx);
    setEditingValue(currentSlug);
  };

  const handleSaveInlineEdit = (idx: number) => {
    const cleanVal = editingValue.trim().toLowerCase();
    if (!cleanVal) return;
    
    setSelectedCompanionTools(prev => {
      const copy = [...prev];
      copy[idx] = cleanVal;
      return copy;
    });
    
    setEditingIndex(null);
    setSaveStatus({ success: true, message: "स्लग में बदलाव किया गया। सेव व डिप्लॉय पर क्लिक करें!" });
    setTimeout(() => setSaveStatus(null), 6000);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
  };

  const handleRemoveSlugAt = (idx: number) => {
    const slugRemoved = selectedCompanionTools[idx];
    setSelectedCompanionTools(prev => prev.filter((_, i) => i !== idx));
    setSaveStatus({ success: true, message: `स्लग /${slugRemoved} को हटाया गया। परिवर्तन को सुरक्षित करने के लिए नीचे 'सेव व डिप्लॉय' करें।` });
    setTimeout(() => setSaveStatus(null), 6000);
  };

  // Smart recommender: Select and match tools of same category or random fillers
  const handleSmartSuggest = () => {
    if (!activePageObj) return;
    
    // Select slugs matching category keywords, or fallback to standard ones
    const currentCategory = activePageObj.category || "";
    const semanticKeywords = currentCategory.toLowerCase().split(" ");
    
    // Filter slugs that might be related chemically or semantically
    const recommendations = liveSlugs.filter(slug => {
      if (slug === activePageObj.slug) return false;
      const slugClean = slug.replace(/-/g, " ").toLowerCase();
      return semanticKeywords.some(kw => kw.length > 2 && slugClean.includes(kw));
    });

    // Take top recommendations, fill with guaranteed ones up to 3 or 4
    let finalSelection = [...recommendations];
    const guaranteedFillers = ["duplicate-lines-remover", "case-converter", "remove-whitespace-online", "remove-space-online"];
    
    for (const filler of guaranteedFillers) {
      if (finalSelection.length >= 3) break;
      if (filler !== activePageObj.slug && !finalSelection.includes(filler) && liveSlugs.includes(filler)) {
        finalSelection.push(filler);
      }
    }

    setSelectedCompanionTools(Array.from(new Set(finalSelection)).slice(0, 4));
  };

  // Save manual modifications back to SQLite and deploy live
  const handleSaveAndDeploy = async () => {
    if (!selectedPageSlug) return;
    setSavingLinks(true);
    setSaveStatus(null);

    try {
      const res = await fetch("/api/pages/update-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          slug: selectedPageSlug,
          relatedTools: selectedCompanionTools
        })
      });

      const data = await res.json();
      if (data.success) {
        setSaveStatus({ success: true, message: data.message });
        await onRefreshPages(); // Refresh central state
      } else {
        setSaveStatus({ success: false, message: data.message || "Could not update related tools links." });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, message: `Error occurred during preservation: ${err.message}` });
    } finally {
      setSavingLinks(false);
    }
  };

  // Filter local pages matching pageSearch and linkFilter preset
  const filteredPages = pages.filter(p => {
    const matchesSearch = 
      p.slug.toLowerCase().includes(pageSearch.toLowerCase()) || 
      p.keyword.toLowerCase().includes(pageSearch.toLowerCase()) || 
      p.title.toLowerCase().includes(pageSearch.toLowerCase());
      
    if (!matchesSearch) return false;
    
    const linkCount = p.relatedTools?.length || 0;
    if (linkFilter === 'linked') {
      return linkCount > 0;
    }
    if (linkFilter === 'unlinked') {
      return linkCount === 0;
    }
    return true;
  });

  const totalLinkedCount = pages.filter(p => (p.relatedTools?.length || 0) > 0).length;
  const totalUnlinkedCount = pages.filter(p => (p.relatedTools?.length || 0) === 0).length;

  // Filter live sitemap slugs matching slugSearch
  const filteredSlugs = liveSlugs.filter(slug => 
    slug.toLowerCase().includes(slugSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden" id="sitemap_tab">
      
      {/* Dynamic Header Badge */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-805 rounded-xl p-6 relative overflow-hidden" id="sitemap_live_hero">
        <div className="absolute top-1/2 right-10 -translate-y-1/2 text-cyan-500/10 pointer-events-none hidden md:block">
          <Globe size={180} />
        </div>
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-bold uppercase tracking-wider">
            <HeartPulse size={12} className="animate-pulse" /> Live Next.js Sitemap Linker & Auditor
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Active Sitemap Link Integrity Manager</h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            यह मॉड्यूल सीधे आपके मुख्य Texly ब्लॉग/टूल के डायनामिक रूट <code className="text-cyan-400 font-mono text-[11px]">/api/sitemap.ts</code> से सक्रिय पेजों को लोड करता है। आप यहीं से उनके बीच के सम्बन्धों (relatedTools लिंक्स) को कस्टमाइज़ कर सकते हैं। परिवर्तनों को तुरंत GitHub रिपोजिटरी में सेव करके Vercel लाइव रीबिल्ड को ट्रिगर किया जाता है।
          </p>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Local SEO Landing Pages Index selector */}
        <div className="lg:col-span-4 bg-zinc-900/40 border border-zinc-850 rounded-xl p-5 flex flex-col h-[650px]" id="pages_selector_catalog">
          <div className="space-y-3 mb-4 shrink-0">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                <Layers size={14} className="text-zinc-500" />
                स्थानीय SEO पेजेस ({filteredPages.length})
              </h3>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono font-medium">Pages</span>
            </div>
            
            {/* Search inputs */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-650" size={14} />
              <input 
                type="text"
                placeholder="पेज या कीवर्ड सर्च करें..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="w-full bg-[#07070a] border border-zinc-850 text-xs pl-9 pr-4 py-2.5 rounded-lg outline-none text-zinc-300 focus:border-cyan-500/30 font-sans"
              />
            </div>

            {/* Link filtering stats presets */}
            <div className="flex gap-1 bg-[#050508]/80 p-1 rounded-lg border border-zinc-850 text-[10.5px] font-sans">
              <button
                type="button"
                onClick={() => setLinkFilter('all')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-all cursor-pointer text-center ${
                  linkFilter === 'all' 
                    ? "bg-zinc-800 text-cyan-400 border border-zinc-700/30" 
                    : "text-zinc-500 hover:text-zinc-350"
                }`}
              >
                All ({pages.length})
              </button>
              <button
                type="button"
                onClick={() => setLinkFilter('linked')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-all cursor-pointer text-center ${
                  linkFilter === 'linked' 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-505" 
                    : "text-zinc-500 hover:text-zinc-355"
                }`}
              >
                Linked ({totalLinkedCount})
              </button>
              <button
                type="button"
                onClick={() => setLinkFilter('unlinked')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-all cursor-pointer text-center ${
                  linkFilter === 'unlinked' 
                    ? "bg-rose-500/10 text-rose-400 border border-rose-505" 
                    : "text-zinc-500 hover:text-zinc-355"
                }`}
              >
                Unlinked ({totalUnlinkedCount})
              </button>
            </div>
          </div>

          {/* List catalog of local pages */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 divide-y divide-zinc-900">
            {filteredPages.length === 0 ? (
              <div className="text-center py-10 text-zinc-600 text-xs">
                कोई स्थानीय पेज नहीं मिला।
              </div>
            ) : (
              filteredPages.map((p) => {
                const isSelected = selectedPageSlug === p.slug;
                const linkCount = p.relatedTools?.length || 0;
                const isConfirmDeleting = deletingPageSlug === p.slug;

                return (
                  <div
                    key={p.slug}
                    onClick={() => !isConfirmDeleting && setSelectedPageSlug(p.slug)}
                    className={`w-full text-left p-3.5 rounded-lg transition-all border flex flex-col gap-1.5 cursor-pointer select-none group relative ${
                      isSelected 
                        ? "bg-cyan-500/10 border-cyan-500/40 text-white shadow-md shadow-cyan-950/20" 
                        : "bg-transparent border-transparent hover:bg-zinc-850/30 text-zinc-400"
                    }`}
                  >
                    {isConfirmDeleting ? (
                      <div className="flex flex-col gap-2 p-1 text-xs" onClick={(e) => e.stopPropagation()}>
                        <span className="text-rose-400 font-bold flex items-center gap-1 leading-normal">
                          <AlertCircle size={12} className="shrink-0" /> क्या आप इस पेज को पूरी तरह डिलीट करना चाहते हैं?
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeletePage(p.slug)}
                            disabled={isDeleting}
                            className="bg-rose-600 hover:bg-rose-500 text-zinc-950 font-bold px-2 py-1 rounded text-[10px] transition cursor-pointer"
                          >
                            {isDeleting ? "डिलीट..." : "हाँ, डिलीट करें"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPageSlug(null)}
                            className="bg-zinc-800 hover:bg-zinc-750 text-zinc-400 px-2 py-1 rounded text-[10px] transition cursor-pointer"
                          >
                            रद्द करें
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start gap-2 w-full">
                          <span className="text-xs font-bold font-sans tracking-tight line-clamp-1">{p.keyword}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`text-[9px] shrink-0 font-mono font-semibold px-2 py-0.5 rounded ${
                              linkCount > 0 
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                                : "bg-rose-550/10 text-rose-400 border border-rose-500/20"
                            }`}>
                              {linkCount} Links
                            </span>
                            
                            {/* Inline Delete Button icon */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingPageSlug(p.slug);
                              }}
                              className="p-1 text-zinc-650 hover:text-rose-450 bg-zinc-950/80 hover:bg-rose-500/10 border border-zinc-850 hover:border-rose-500/20 rounded opacity-0 group-hover:opacity-100 transition duration-200 cursor-pointer"
                              title="Delete Page completely"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-550 truncate">/{p.slug}</span>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Column 2 & 3: Detailed Link configuring & Sitemap check */}
        <div className="lg:col-span-8 bg-zinc-900/40 border border-zinc-850 rounded-xl p-6 flex flex-col h-[650px]" id="link_configs_workspace">
          {activePageObj ? (
            <div className="flex flex-col h-full space-y-5">
              
              {/* Header block for Selected Page Node */}
              <div className="border-b border-zinc-850 pb-4 shrink-0 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <Layers size={16} className="text-cyan-400 shadow-sm" />
                      {activePageObj.keyword}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono pt-0.5">
                      Target Path: <a href={`https://www.texlyonline.in/seo/${activePageObj.slug}`} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">/seo/{activePageObj.slug}</a>
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(!isEditingDetails)}
                      className={`px-3 py-1.5 text-[10px] uppercase font-mono font-bold border rounded-lg flex items-center gap-1.5 transition cursor-pointer select-none ${
                        isEditingDetails 
                          ? "bg-cyan-400 text-zinc-950 border-cyan-300" 
                          : "bg-zinc-900 border-zinc-800 text-zinc-330 hover:text-white"
                      }`}
                    >
                      <Edit2 size={11} />
                      <span>{isEditingDetails ? "Cancel Details Edit" : "Page Details Edit"}</span>
                    </button>
                    {!isEditingDetails && (
                      <button
                        type="button"
                        onClick={handleSmartSuggest}
                        className="px-3 py-1.5 text-[10px] uppercase font-mono font-bold bg-[#14141f] border border-zinc-800 text-zinc-300 hover:text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer select-none"
                      >
                        <Sparkles size={11} className="text-cyan-400 animate-pulse" /> Auto-Map Suggest
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#050508] border border-zinc-855 rounded-lg p-2.5">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-mono">Category (श्रेणी)</span>
                    <span className="text-xs font-bold text-zinc-350">{activePageObj.category || "Utility"}</span>
                  </div>
                  <div className="bg-[#050508] border border-zinc-855 rounded-lg p-2.5">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-mono">Current Links count</span>
                    <span className="text-xs font-mono font-bold text-cyan-400">{selectedCompanionTools.length} Tools mapped</span>
                  </div>
                  <div className="bg-[#050508] border border-zinc-855 rounded-lg p-2.5 col-span-2 md:col-span-1">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block font-mono">Live status checked</span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck size={12} /> Live Matrix Active
                    </span>
                  </div>
                </div>
              </div>

              {isEditingDetails ? (
                /* PAGE DETAILS EDIT FORM WORKSPACE */
                <form onSubmit={handleSavePageDetails} className="flex-1 min-h-0 bg-[#07070a]/60 border border-zinc-855 rounded-xl p-5 overflow-y-auto space-y-4">
                  <div className="pb-3 border-b border-zinc-850 flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-sans">
                      <Edit2 size={13} className="text-cyan-400" />
                      पेज विवरण संशोधित करें (Edit Page Properties)
                    </h4>
                    <span className="text-[10px] bg-zinc-850 px-2 py-0.5 rounded text-cyan-400 font-mono">pages.json</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-0.5 font-sans">Keyword (कीवर्ड)</label>
                      <input 
                        type="text"
                        value={editFormKeyword}
                        onChange={(e) => setEditFormKeyword(e.target.value)}
                        placeholder="जैसे: remove symbols online"
                        className="w-full bg-zinc-950 border border-zinc-800 text-xs px-3 py-2.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-0.5 font-sans">Slug / Target Path (स्लग / रूट)</label>
                      <input 
                        type="text"
                        value={editFormSlug}
                        onChange={(e) => setEditFormSlug(e.target.value)}
                        placeholder="जैसे: remove-symbols-online"
                        className="w-full bg-zinc-950 border border-zinc-805 text-xs px-3 py-2.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-0.5 font-sans">SEO Title (एसईओ टाइटल)</label>
                      <input 
                        type="text"
                        value={editFormTitle}
                        onChange={(e) => setEditFormTitle(e.target.value)}
                        placeholder="पेज का आकर्षक S.E.O. Title..."
                        className="w-full bg-zinc-950 border border-zinc-805 text-xs px-3 py-2.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-0.5 font-sans">Category (श्रेणी / निश)</label>
                      <input 
                        type="text"
                        value={editFormCategory}
                        onChange={(e) => setEditFormCategory(e.target.value)}
                        placeholder="जैसे: Text Cleaners"
                        className="w-full bg-zinc-950 border border-zinc-805 text-xs px-3 py-2.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center pl-0.5">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block font-sans">Introduction Copy (प्रस्तावना पैराग्राफ)</label>
                      <button
                        type="button"
                        onClick={handleAiRewrite}
                        disabled={isRewriting}
                        className="px-2.5 py-1 text-[9px] font-bold bg-[#14141f] hover:bg-cyan-500/10 border border-zinc-800 hover:border-cyan-500/20 text-cyan-400 rounded-md flex items-center gap-1.5 transition cursor-pointer select-none disabled:opacity-50"
                      >
                        {isRewriting ? (
                          <>
                            <RefreshCw size={10} className="animate-spin" />
                            <span>रीराइट हो रहा है...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={10} />
                            <span>AI से कंटेंट दोबारा लिखें (Rewrite with AI)</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea 
                      value={editFormIntro}
                      onChange={(e) => setEditFormIntro(e.target.value)}
                      placeholder="टूल के बारे में विस्तृत परिचय लिखें..."
                      rows={5}
                      className="w-full bg-zinc-950 border border-zinc-805 text-xs p-3.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none resize-none leading-relaxed"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block pl-0.5 font-sans">
                      Related Tools Slugs (सम्बद्ध टूल लिंक्स - कोमा <span className="text-cyan-400 font-mono">pages.json</span> से एडिट करें)
                    </label>
                    <textarea 
                      value={editFormRelatedLinks}
                      onChange={(e) => setEditFormRelatedLinks(e.target.value)}
                      placeholder="जैसे: remove-space-online, case-converter, reverse-text-online"
                      rows={2}
                      className="w-full bg-zinc-950 border border-zinc-805 text-xs p-3.5 rounded-lg text-zinc-200 focus:border-cyan-500/50 outline-none font-mono resize-none leading-relaxed placeholder:text-zinc-700"
                    />
                    <span className="text-[9px] text-zinc-550 block pl-0.5">Note: Slugs must be separated by commas (Example: slug-1, slug-2, slug-3). This directly edits the programmatic pages.json links list, allowing you to easily fix and clear broken links.</span>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-zinc-850 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      className="px-4 py-2 bg-zinc-900 border border-zinc-805 hover:bg-zinc-850 hover:text-white text-zinc-400 rounded-lg text-xs font-bold transition cursor-pointer font-sans"
                    >
                      कैंसिल
                    </button>
                    <button
                      type="submit"
                      disabled={savingDetails}
                      className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer font-sans"
                    >
                      {savingDetails ? (
                        <>
                          <RefreshCw size={12} className="animate-spin" />
                          <span>सहेज रहा है...</span>
                        </>
                      ) : (
                        <>
                          <Check size={12} />
                          <span>विवरण सहेजें (Save properties)</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Dual-Column Repair and Custom Mapping Board */
                <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-hidden">
                  
                  {/* 1. CURRENT REPAIR & EDITOR BOARD (LEFT COLUMN) */}
                  <div className="flex flex-col bg-[#07070a]/60 border border-zinc-855 rounded-xl p-4 overflow-hidden">
                    <div className="pb-3 border-b border-zinc-855 flex items-center justify-between shrink-0 gap-2">
                      <div className="flex flex-col">
                        <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                          <Edit2 size={13} className="text-cyan-400" />
                          पेज के वर्तमान लिंक्स ({selectedCompanionTools.length})
                        </h4>
                        {selectedCompanionTools.filter(slug => !isSlugValid(slug)).length > 0 && (
                          <span className="text-[9px] text-rose-400 font-medium pt-0.5 animate-pulse">
                            ⚠️ {selectedCompanionTools.filter(slug => !isSlugValid(slug)).length} अमान्य / टूटे कड़ियाँ मिलीं!
                          </span>
                        )}
                      </div>
                      
                      {selectedCompanionTools.filter(slug => !isSlugValid(slug)).length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const beforeCount = selectedCompanionTools.length;
                            const kept = selectedCompanionTools.filter(slug => isSlugValid(slug));
                            setSelectedCompanionTools(kept);
                            const cleaned = beforeCount - kept.length;
                            setSaveStatus({ success: true, message: `सफलतापूर्वक ${cleaned} टूटे हुए/अमान्य लिंक्स हटाए गए! इन्हें स्थायी रूप से सेव करने के लिए नीचे 'सेव व डिप्लॉय' बटन दबाएं।` });
                            setTimeout(() => setSaveStatus(null), 6000);
                          }}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-450 text-[10px] rounded font-bold cursor-pointer transition select-none flex items-center gap-1 shrink-0"
                          title="सभी अमान्य/टूटे हुए लिंक्स को एक क्लिक में हटाएँ"
                        >
                          <Trash2 size={9} />
                          <span>टूटे लिंक्स साफ़ करें ({selectedCompanionTools.filter(slug => !isSlugValid(slug)).length})</span>
                        </button>
                      ) : (
                        <span className="text-[9px] bg-zinc-850 px-2 py-0.5 rounded text-cyan-400 font-mono">pages.json</span>
                      )}
                    </div>

                    {/* Add manual slug form */}
                    <form onSubmit={handleAddCustomTool} className="py-2.5 flex gap-2 shrink-0">
                      <input 
                        type="text"
                        placeholder="नया slug लिखें (जैसे: lower-case)..."
                        value={customToolInput}
                        onChange={(e) => setCustomToolInput(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-850 text-xs px-2.5 py-1.5 rounded-lg text-zinc-330 outline-none focus:border-cyan-500/50 font-mono placeholder:text-zinc-650"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer font-sans"
                      >
                        <Plus size={12} />
                        <span>जोड़ें</span>
                      </button>
                    </form>

                    {/* List of currently selected companion tools slugs */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                      {selectedCompanionTools.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-6 text-zinc-600 text-center text-xs space-y-1 font-sans">
                          <AlertCircle size={16} className="text-zinc-700" />
                          <span>इस पेज में कोई सम्बंधित टूल लिंक नहीं है।</span>
                          <span>दाहिनी ओर सूची से चुनें या नया स्लग जोड़ें।</span>
                        </div>
                      ) : (
                        selectedCompanionTools.map((slug, idx) => {
                          const isEditing = editingIndex === idx;
                          const isValid = isSlugValid(slug);
                          return (
                            <div 
                              key={`${slug}-${idx}`}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs gap-3 transition-all ${
                                isValid 
                                  ? "bg-zinc-950/40 border-zinc-900 hover:border-zinc-850 text-zinc-300" 
                                  : "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 hover:border-rose-500/35 text-rose-300"
                              }`}
                            >
                              {isEditing ? (
                                <div className="flex-1 flex gap-1.5 min-w-0">
                                  <input 
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    className="flex-1 bg-zinc-900 border border-cyan-500/50 text-xs px-2 py-1 rounded text-white outline-none font-mono"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveInlineEdit(idx)}
                                    className="p-1.5 bg-emerald-500 text-zinc-950 rounded hover:bg-emerald-400 transition cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Check size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="p-1.5 bg-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="min-w-0 flex-1 truncate font-mono flex items-center gap-1.5">
                                    <span>/{slug}</span>
                                    {!isValid && (
                                      <span className="text-[8px] bg-rose-500/20 text-rose-450 border border-rose-500/30 px-1 py-0.5 rounded font-bold shrink-0 tracking-wide animate-pulse">
                                        ⚠️ Broken Link
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditing(idx, slug)}
                                      className="p-1 px-1.5 bg-zinc-900 hover:bg-zinc-855 hover:text-white border border-zinc-800 text-[10px] text-zinc-400 rounded transition cursor-pointer font-sans"
                                      title="Edit target slug link"
                                    >
                                      बदलें
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSlugAt(idx)}
                                      className="p-1 px-1.5 bg-rose-550/10 hover:bg-rose-500/20 text-rose-450 rounded transition text-[10px] cursor-pointer font-sans"
                                      title="Delete slug link"
                                    >
                                      हटाएं
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 2. LIVE SITE QUICK-SELECT BOARD (RIGHT COLUMN) */}
                  <div className="flex flex-col bg-[#07070a]/60 border border-zinc-855 rounded-xl p-4 overflow-hidden">
                    <div className="flex justify-between items-center gap-3 pb-3 mb-2 border-b border-zinc-855 shrink-0">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-zinc-350 flex items-center gap-1.5 truncate">
                          <Globe size={13} className="text-cyan-400 shrink-0" />
                          लाइव साइटमैप स्लग्स ({liveSlugs.length})
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={fetchSitemapSlugs}
                          disabled={loadingSitemap}
                          title="Sitemap रिफ्रेश करें"
                          className="p-1.5 bg-zinc-900 border border-zinc-805 disabled:opacity-40 text-zinc-400 hover:text-white rounded hover:bg-zinc-855 cursor-pointer transition flex items-center justify-center shrink-0"
                        >
                          <RefreshCw size={11} className={loadingSitemap ? "animate-spin text-cyan-400" : ""} />
                        </button>
                      </div>
                    </div>

                    {/* Search inside sitemap on the right */}
                    <div className="pb-2.5 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-700" size={12} />
                        <input 
                          type="text"
                          placeholder="खोजें... (जैसे: remove)"
                          value={slugSearch}
                          onChange={(e) => setSlugSearch(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-855 text-[10px] pl-7 pr-2 py-1.5 rounded outline-none text-zinc-400 focus:border-cyan-500/20 font-mono placeholder:text-zinc-650"
                        />
                      </div>
                    </div>

                    {/* Scroll list of checkboxes */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                      {loadingSitemap ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 text-zinc-600 text-xs font-mono py-12">
                          <RefreshCw className="animate-spin text-cyan-400" size={15} />
                          <span>नेक्स्ट-जीएस साइटमैप लोड हो रहा है...</span>
                        </div>
                      ) : sitemapError ? (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/25 rounded-lg text-xs font-mono text-rose-300 leading-normal">
                          {sitemapError}
                        </div>
                      ) : filteredSlugs.length === 0 ? (
                        <div className="text-center py-10 text-zinc-600 text-xs font-mono">
                          कोई सक्रिय स्लग नहीं मिला।
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-1 text-[11px] font-mono select-none">
                          {filteredSlugs.map((slug) => {
                            const isMapped = selectedCompanionTools.includes(slug);
                            const isSelf = slug === activePageObj.slug;
                            return (
                              <div 
                                key={slug}
                                onClick={() => !isSelf && handleToggleSlug(slug)}
                                className={`flex items-center gap-2 p-2 rounded-lg border transition cursor-pointer ${
                                  isSelf 
                                    ? "opacity-35 bg-transparent border-zinc-900 cursor-not-allowed"
                                    : isMapped 
                                      ? "bg-cyan-500/5 border-cyan-500/30 text-white" 
                                      : "bg-[#0c0c12]/40 border-zinc-905 text-zinc-500 hover:border-zinc-800 hover:bg-zinc-900/40"
                                }`}
                              >
                                <span className="shrink-0">
                                  {isSelf ? (
                                    <AlertCircle size={12} className="text-zinc-600" title="यह वही प्रोग्रामेटिक पेज है" />
                                  ) : isMapped ? (
                                    <CheckSquare size={12} className="text-cyan-400" />
                                  ) : (
                                    <Square size={12} className="text-zinc-800" />
                                  )}
                                </span>
                                <span className="truncate flex-1" title={slug}>{slug}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}


              {/* Footer Save Deploy Actions */}
              <div className="border-t border-zinc-850 pt-4 shrink-0 space-y-4">
                {saveStatus && (
                  <div className={`p-3 border rounded-lg text-xs leading-relaxed font-sans ${
                    saveStatus.success 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`}>
                    {saveStatus.message}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                  <div className="text-[10px] text-zinc-500 leading-normal max-w-md text-center sm:text-left">
                    संपादित सम्बद्ध टूल्स को सेव करने पर यह <code className="text-zinc-300 font-mono">data/pages.json</code> में सहेजा जाएगा, जिसे सीधे GitHub पर पुश कर Vercel पर अपडेट किया जाएगा।
                  </div>
                  <button
                    onClick={handleSaveAndDeploy}
                    disabled={savingLinks || loadingSitemap}
                    className="w-full sm:w-auto px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-lg uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5 transition select-none shrink-0 shadow-lg shadow-cyan-500/10"
                  >
                    {savingLinks ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        लाइव डिप्लॉय जारी है...
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        लिंक्स सेव करें व डिप्लॉय करें
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600 text-xs">
              <Layers size={24} className="text-zinc-800 mb-2 animate-pulse" />
              <span>प्रबंधन प्रारम्भ करने के लिए बाएं सूची से कोई प्रोग्रामेटिक वेब पेज चुनें।</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
