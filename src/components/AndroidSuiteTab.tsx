/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Smartphone, Sparkles, CheckCircle, Copy, Code, FileCode, Check, 
  Terminal, ArrowRight, Layers, FileText, Download, Play, ShieldAlert, Library
} from "lucide-react";

interface AndroidSuiteTabProps {
  getAuthHeaders: () => Record<string, string>;
}

export default function AndroidSuiteTab({ getAuthHeaders }: AndroidSuiteTabProps) {
  const [appId, setAppId] = useState("com.texlyonline.app");
  const [appName, setAppName] = useState("Texly Online");
  const [webUrl, setWebUrl] = useState("https://www.texlyonline.in");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [stepStatus, setStepStatus] = useState<"idle" | "running" | "success" | "failed">("idle");
  const [feedbackMsg, setFeedbackMsg] = useState("");

  const [copConfigText, setCopConfigText] = useState("");
  const [manifestText, setManifestText] = useState("");
  const [javaText, setJavaText] = useState("");

  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, sectionId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionId);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleGenerateAndInit = async () => {
    setIsGenerating(true);
    setStepStatus("running");
    setFeedbackMsg("एंड्रॉइड कॉन्फ़िगरेशन फाइल्स तैयार की जा रही हैं...");

    try {
      const res = await fetch("/api/android/generate-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({ appId, appName, webUrl })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStepStatus("success");
        setFeedbackMsg("बधाई हो! आपकी एंड्रॉइड टेम्पलेट्स और Capacitor कॉन्फ़िग तैयार कर दी गई हैं।");
        setCopConfigText(JSON.stringify(data.capConfig, null, 2));
        setManifestText(data.androidManifestXml);
        setJavaText(data.mainActivityJava);
      } else {
        setStepStatus("failed");
        setFeedbackMsg(data.error || "कॉन्फ़िगरेशन जनरेट करने में त्रुटि आई।");
      }
    } catch (e: any) {
      setStepStatus("failed");
      setFeedbackMsg(e.message || "सर्वर से कनेक्ट नहीं हो पाया।");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6" id="android_suite_workspace">
      
      {/* Intro Header */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-[#0e160e] border border-zinc-800 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <Smartphone size={220} className="text-emerald-400" />
        </div>
        <div className="max-w-3xl space-y-3.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold uppercase tracking-wider">
            <Smartphone size={13} className="animate-pulse" />
            Vite Web-to-APK Hybrid Suite
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            अपनी Texly Online को एंड्रॉइड ऐप (APK) में बदलें
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            आपके 100+ टूल्स पूरी तरह से क्लाइन्ट-साइड ब्राउज़र कोड पर बने हैं, जिसका अर्थ है कि वे एंड्रॉइड के <strong>WebView</strong> या <strong>Capacitor Integration Engine</strong> पर बिना किसी बैकएंड सर्वर के सुपर-फास्ट रिस्पॉन्स टाइम में चलेंगे। नीचे दिए क्रेडेंशियल्स भरें और अपनी कस्टमाइज्ड एंड्रॉइड प्रोजेक्ट फाइल्स प्राप्त करें!
          </p>
        </div>
      </div>

      {/* Inputs Form */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest text-emerald-400">
          ऐप की बुनियादी सेटिंग्स
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="space-y-1.5">
            <label className="text-zinc-400 text-xs font-semibold">Package ID / Application Identifier</label>
            <input 
              type="text" 
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="e.g. com.texlyonline.app"
              className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-200 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 font-mono italic">Google Play Store पर आपकी यूनिक आईडी</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-zinc-400 text-xs font-semibold">Android App Name</label>
            <input 
              type="text" 
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Texly Online"
              className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-200 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 font-mono italic">एंड्रॉइड फोन के होमस्क्रीन पर नाम</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-zinc-400 text-xs font-semibold">Native Web Source URL</label>
            <input 
              type="text" 
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="e.g. https://www.texlyonline.in"
              className="w-full px-3 py-2.5 bg-zinc-900 text-zinc-200 text-xs border border-zinc-800 rounded-lg focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[10px] text-zinc-500 font-mono italic">प्राइमरी वेब डोमेन या लाइव लाइवहोस्ट यूआरएल</span>
          </div>

        </div>

        <div className="pt-3 border-t border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500 leading-normal max-w-lg">
            बटन दबाने पर सिस्टम आपके लिए <strong>Capacitor configuration (.json)</strong> और एंड्रॉइड प्रोजेक्ट की मुख्य <strong>Java Activity Class</strong> एवं <strong>Manifest file</strong> तैयार कर देगा।
          </p>
          
          <button 
            disabled={isGenerating}
            onClick={handleGenerateAndInit}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-40 text-black font-black text-xs rounded-xl shadow-lg transition duration-150 uppercase tracking-widest cursor-pointer flex justify-center items-center gap-2 shrink-0"
          >
            {isGenerating ? "तैयार हो रहा है... ✨" : "एंड्रॉइड कॉन्फ़िग जनरेट करें"}
          </button>
        </div>
      </div>

      {/* Generator Status Feed Message */}
      {stepStatus !== "idle" && (
        <div className={`p-4 rounded-xl text-xs leading-relaxed border ${
          stepStatus === "running" ? "bg-cyan-500/5 text-cyan-400 border-cyan-500/10" :
          stepStatus === "success" ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10" :
          "bg-rose-500/5 text-rose-450 border-rose-500/10"
        }`}>
          <div className="font-bold flex items-center gap-1.5 mb-1.5 text-sm uppercase">
            {stepStatus === "running" && "तैयारी जारी है..."}
            {stepStatus === "success" && "सफलतापूर्वक कॉन्फ़िगरेशन जनरेट हो गया ✓"}
            {stepStatus === "failed" && "फाइल्स प्रोसेस फेल"}
          </div>
          <p className="font-sans text-zinc-300 font-medium">{feedbackMsg}</p>
        </div>
      )}

      {/* Code Snippets Viewer (Visible when succeeded) */}
      {manifestText !== "" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="generated_android_assets_grid">
          
          {/* Box 1: capacitor.config.json */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-zinc-900/40 border-b border-zinc-900 px-4 py-3 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Code size={14} className="text-cyan-400" />
                capacitor.config.json
              </span>
              <button 
                onClick={() => handleCopy(copConfigText, "cap")}
                className="text-zinc-500 hover:text-white transition duration-150 cursor-pointer text-xs flex items-center gap-1 font-mono"
              >
                {copiedSection === "cap" ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[10px]">Copy JSON</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-[300px] text-[11px] font-mono text-cyan-300 bg-zinc-950/70 select-all leading-relaxed flex-1">
              {copConfigText}
            </pre>
          </div>

          {/* Box 2: AndroidManifest.xml */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-zinc-900/40 border-b border-zinc-900 px-4 py-3 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <FileCode size={14} className="text-amber-400" />
                AndroidManifest.xml
              </span>
              <button 
                onClick={() => handleCopy(manifestText, "manifest")}
                className="text-zinc-500 hover:text-white transition duration-150 cursor-pointer text-xs flex items-center gap-1 font-mono"
              >
                {copiedSection === "manifest" ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[10px]">Copy XML</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-[300px] text-[11px] font-mono text-zinc-400 bg-zinc-950/70 select-all leading-relaxed flex-1">
              {manifestText}
            </pre>
          </div>

          {/* Box 3: MainActivity.java (Full width on large screen for readability) */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden flex flex-col lg:col-span-2">
            <div className="bg-zinc-900/40 border-b border-zinc-900 px-4 py-3 flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Library size={14} className="text-emerald-400" />
                MainActivity.java (WebView Core Accelerator Controller)
              </span>
              <button 
                onClick={() => handleCopy(javaText, "java")}
                className="text-zinc-500 hover:text-white transition duration-150 cursor-pointer text-xs flex items-center gap-1 font-mono"
              >
                {copiedSection === "java" ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 text-[10px]">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span className="text-[10px]">Copy Java Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 overflow-auto max-h-[350px] text-[11px] font-mono text-emerald-300 bg-zinc-950/70 select-all leading-relaxed flex-1">
              {javaText}
            </pre>
          </div>

        </div>
      )}

      {/* APK Compilation Instructions step-by-step roadmap */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 md:p-6 space-y-4">
        <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-widest text-emerald-400 flex items-center gap-2">
          <Play size={15} />
          APK बनाने के लिए स्टेप-बाय-स्टेप लाइव गाइड (Roadmap)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-zinc-400 leading-relaxed font-sans pt-2">
          
          <div className="bg-zinc-900/30 p-4 border border-zinc-900 rounded-lg space-y-2 relative">
            <span className="absolute top-2 right-3 text-lg font-black text-emerald-500/20 font-mono">01</span>
            <h4 className="font-bold text-zinc-200">पहला विकल्प (Capacitor Sync Workflow)</h4>
            <p>
              चूंकि आप Vite React प्रोजेक्ट का उपयोग कर रहे हैं, आप बस अपने टर्मिनल पर यह कमांड रन करें:
            </p>
            <div className="relative group/cmd">
              <div className="bg-zinc-950 p-2.5 rounded font-mono text-[10px] text-cyan-400 select-all border border-zinc-850 space-y-1 pr-14">
                <div>npm install @capacitor/core @capacitor/cli</div>
                <div>npx cap init "{appName}" "{appId}"</div>
                <div>npm run build</div>
                <div>npx cap add android</div>
                <div>npx cap sync</div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const cmdText = `npm install @capacitor/core @capacitor/cli\nnpx cap init "${appName}" "${appId}"\nnpm run build\nnpx cap add android\nnpx cap sync`;
                  navigator.clipboard.writeText(cmdText);
                  setCopiedSection("capacitor");
                  setTimeout(() => setCopiedSection(null), 2000);
                }}
                className="absolute top-2 right-2 p-1 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 hover:text-white transition duration-150 cursor-pointer flex items-center justify-center"
                title="Copy Commands"
              >
                {copiedSection === "capacitor" ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
              </button>
            </div>
            <p className="text-[10px] text-zinc-550 italic">
              यह आपके पूरे टूल्स के इंटरफेस को लोकल एंड्रॉइड कंपाइलर के लिए सिंक कर देगा।
            </p>
          </div>

          <div className="bg-zinc-900/30 p-4 border border-zinc-900 rounded-lg space-y-2 relative">
            <span className="absolute top-2 right-3 text-lg font-black text-emerald-500/20 font-mono">02</span>
            <h4 className="font-bold text-zinc-200">दूसरा विकल्प (WebView App Wrapper)</h4>
            <p>
              यदि आपको बहुत हल्का (Simple & Tiny) APK चाहिए (केवल 2MB-3MB):
            </p>
            <ul className="list-disc pl-4 space-y-1 text-zinc-500 text-[11px]">
              <li>Android Studio खोलें और एक <strong>Empty Activity</strong> (Java) प्रोजेक्ट बनाएं।</li>
              <li>पैक ज़ोन में कस्टमाइज्ड <strong>AndroidManifest.xml</strong> का कोड पेस्ट करें।</li>
              <li>MainActivity.java फ़ाइल में ऊपर दिए गए <strong>MainActivity.java</strong> कोड को रिप्लेस करें।</li>
            </ul>
            <p className="text-[10px] text-zinc-550 italic">
              यह डायरेक्टली आपकी लाइव साइट: {webUrl} के टूल्स को मोबाइल ऐप के रूप में बिना किसी लैग के रेंडर करेगा।
            </p>
          </div>

          <div className="bg-zinc-900/30 p-4 border border-zinc-900 rounded-lg space-y-2 relative">
            <span className="absolute top-2 right-3 text-lg font-black text-emerald-500/20 font-mono">03</span>
            <h4 className="font-bold text-zinc-200">APK बनाना और साइन करना (Play Store)</h4>
            <p>
              इन कस्टमाइज्ड कॉन्फ़िगरेशन को सिंक करने के बाद:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 text-zinc-400 text-[11px]">
              <li>Android Studio के ऊपरी मेनू में <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK</strong> पर क्लिक करें।</li>
              <li>प्ले स्टोर पर अपलोड करने के लिए <strong>Build &gt; Generate Signed Bundle / APK</strong> पर क्लिक करके सील रिलीज़ की जनरेट करें।</li>
            </ol>
            <p className="text-emerald-450 font-semibold bg-emerald-500/5 p-2 rounded text-[10px] leading-relaxed">
              ✓ आपका एंड्रॉइड ऐप आपके सभी लाइव टूल्स (जैसे क्लीनर, सैंडबॉक्स, गैप्स) को ऑटोमैटिकली सपोर्ट करेगा!
            </p>
          </div>

        </div>
      </div>

      {/* Security notice warning */}
      <div className="bg-zinc-950/40 border border-zinc-900 rounded-xl p-5 flex items-start gap-3.5 text-xs text-zinc-500 font-sans">
        <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-zinc-400">विशेष सुरक्षा और प्रदर्शन सलाह</h4>
          <p className="leading-relaxed">
            यह ऐप पूरी तरह से क्लाइंट-साइड टूल्स के उपयोग पर आधारित है। इसलिए ऐप की गति तेज बनी रहे इसके लिए हमने MainActivity.java में कस्टमाइज्ड कैशे नियंत्रण प्रणाली: <code>WebSettings.LOAD_DEFAULT</code> और DOM संग्रहण समर्थन सक्षम किया है। यदि आप टूल्स में कोई नई सुविधा जोड़ते हैं या नए गैप को लाइव पब्लिश करते हैं, तो उपयोगकर्ता को ऐप अपडेट करने की आवश्यकता नहीं होगी; वे ऑटोमैटिकली नए फीचर्स मोबाइल में तुरंत देख पाएंगे!
          </p>
        </div>
      </div>

    </div>
  );
}
