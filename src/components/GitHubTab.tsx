/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Github, GitBranch, FolderUp, FileCode, CheckCircle, AlertTriangle, 
  Terminal, RefreshCw, Upload, Eye, EyeOff, Save, Trash2, Check, ExternalLink, ArrowRight, ShieldCheck, FolderSync, Info
} from "lucide-react";
import JSZip from "jszip";

interface ParsedFile {
  path: string;
  size: number;
  type: string; // e.g. "ZIP Extract", "Local File"
  base64: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export default function GitHubTab() {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isTokenSaved, setIsTokenSaved] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [targetRepo, setTargetRepo] = useState("");
  const [customRepoPath, setCustomRepoPath] = useState("");
  const [targetBranch, setTargetBranch] = useState("main");
  const [commitMessage, setCommitMessage] = useState("Deploy via Texly Studio DevStudio");
  
  // Repo Creation Mode
  const [createRepoMode, setCreateRepoMode] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [isNewRepoPrivate, setIsNewRepoPrivate] = useState(true);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);

  // Files State
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [zipMessage, setZipMessage] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  // Push Execution Progress
  const [pushLogs, setPushLogs] = useState<string[]>([]);
  const [pushStatus, setPushStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [currentProgress, setCurrentProgress] = useState(0);
  const [commitUrl, setCommitUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and check for existing token in localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem("texly_github_token");
    if (savedToken) {
      setToken(savedToken);
      setIsTokenSaved(true);
      autoVerifyToken(savedToken);
    }
  }, []);

  const autoVerifyToken = async (savedToken: string) => {
    setIsVerifying(true);
    try {
      const uRes = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${savedToken}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsername(uData.login);
        setAvatarUrl(uData.avatar_url);
        
        // Fetch repositories
        const rRes = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
          headers: {
            "Authorization": `Bearer ${savedToken}`,
            "Accept": "application/vnd.github.v3+json"
          }
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          const list = rData.map((r: any) => ({
            name: r.name,
            full_name: r.full_name,
            private: r.private,
            html_url: r.html_url,
            default_branch: r.default_branch || "main"
          }));
          setUserRepos(list);
          if (list.length > 0) {
            setTargetRepo(list[0].full_name);
            setTargetBranch(list[0].default_branch);
          }
        }
      } else {
        localStorage.removeItem("texly_github_token");
        setIsTokenSaved(false);
      }
    } catch (err) {
      console.error("Auto verify GitHub token failed:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveToken = async () => {
    if (!token.trim()) return;
    setIsVerifying(true);
    setErrorMessage("");
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${token.trim()}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });
      if (res.ok) {
        const uData = await res.json();
        setUsername(uData.login);
        setAvatarUrl(uData.avatar_url);
        localStorage.setItem("texly_github_token", token.trim());
        setIsTokenSaved(true);

        // Fetch Repositories
        const rRes = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Accept": "application/vnd.github.v3+json"
          }
        });
        if (rRes.ok) {
          const rData = await rRes.json();
          const list = rData.map((r: any) => ({
            name: r.name,
            full_name: r.full_name,
            private: r.private,
            html_url: r.html_url,
            default_branch: r.default_branch || "main"
          }));
          setUserRepos(list);
          if (list.length > 0) {
            setTargetRepo(list[0].full_name);
            setTargetBranch(list[0].default_branch);
          }
        }
      } else {
        setErrorMessage("Invalid / Expired Token. Please make sure the token has correct scopes (repo level access).");
      }
    } catch (err) {
      setErrorMessage("Could not connect to GitHub API. Please check your network connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("texly_github_token");
    setToken("");
    setIsTokenSaved(false);
    setUsername("");
    setAvatarUrl("");
    setUserRepos([]);
    setParsedFiles([]);
    setZipMessage("");
    setPushStatus("idle");
    setPushLogs([]);
  };

  const handleCreateNewRepo = async () => {
    if (!newRepoName.trim()) return;
    setIsCreatingRepo(true);
    setErrorMessage("");
    try {
      const res = await fetch("https://api.github.com/user/repos", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: newRepoName.trim(),
          private: isNewRepoPrivate,
          auto_init: false
        })
      });
      if (res.ok) {
        const repo = await res.json();
        const freshRepo: GitHubRepo = {
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          html_url: repo.html_url,
          default_branch: "main"
        };
        setUserRepos([freshRepo, ...userRepos]);
        setTargetRepo(repo.full_name);
        setTargetBranch("main");
        setCreateRepoMode(false);
        setNewRepoName("");
        setZipMessage(`रिपोजिटरी "${repo.full_name}" सफलतापूर्वक बनाई गई!`);
      } else {
        const errData = await res.json();
        setErrorMessage(errData.message || "Repository creation failed.");
      }
    } catch (err) {
      setErrorMessage("Network error occurred during repository creation.");
    } finally {
      setIsCreatingRepo(false);
    }
  };

  // Convert files loaded locally directly to Base64 using standard React reader
  const parseDirectFile = (file: File): Promise<ParsedFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64Str = (reader.result as string).split(",")[1];
        resolve({
          path: file.name,
          size: file.size,
          type: "Local File",
          base64: base64Str
        });
      };
      reader.onerror = (e) => reject(e);
    });
  };

  // Process uploaded files and handle complex ZIP nested folder flattening
  const handleUploadedFiles = async (files: FileList) => {
    setIsExtracting(true);
    setZipMessage("");
    const parsed: ParsedFile[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.name.endsWith(".zip")) {
          // JSZip Extraction logic for automated folder fixes
          const zip = await JSZip.loadAsync(file);
          const zipFilePaths = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
          
          // Check for Apple internal garbage files and strip
          const filteredPaths = zipFilePaths.filter(
            (path) => !path.includes("__MACOSX") && !path.includes(".DS_Store")
          );

          if (filteredPaths.length === 0) {
            setZipMessage("इस ज़िप फ़ाइल में कोई फाइल मान्य नहीं पाई गई!");
            continue;
          }

          // Smart Automated Nesting Fix:
          // Check if all extracted files share a single common parent subdirectory prefix
          let hasCommonNest = false;
          let commonPrefix = "";
          const firstParts = filteredPaths[0].split("/");
          if (firstParts.length > 1) {
            const candidate = firstParts[0] + "/";
            const inheritsPref = filteredPaths.every((p) => p.startsWith(candidate));
            if (inheritsPref) {
              hasCommonNest = true;
              commonPrefix = candidate;
            }
          }

          setZipMessage(
            hasCommonNest 
              ? `ZIP Extracted: Nesting auto-fixed! (Stripe out common redundant folder: "${commonPrefix}")`
              : "ZIP Extracted: Standard files successfully uncompressed at primary level."
          );

          // Build file list representation
          for (const path of filteredPaths) {
            const zipEntry = zip.files[path];
            const base64Val = await zipEntry.async("base64");
            
            // If common nested parent folder exists, cleanly trim it out so it's committed straight to root level
            const finalGitPath = hasCommonNest ? path.substring(commonPrefix.length) : path;

            parsed.push({
              path: finalGitPath,
              size: (zipEntry as any)._data?.uncompressedSize || 0,
              type: "ZIP Extract" + (hasCommonNest ? " (Auto-Flattened)" : ""),
              base64: base64Val
            });
          }
        } else {
          // Standard standalone manual file additions
          const item = await parseDirectFile(file);
          parsed.push(item);
        }
      }
      setParsedFiles((prev) => [...prev, ...parsed]);
    } catch (err) {
      console.error(err);
      setErrorMessage("Error occurred while parsing custom files / Extracting compressed ZIP.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUploadedFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (idx: number) => {
    setParsedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAllFiles = () => {
    setParsedFiles([]);
    setZipMessage("");
  };

  // Execution: Commit & Push Process through GitHub REST Git Database endpoints
  const handlePushToGitHub = async () => {
    if (parsedFiles.length === 0) return;
    const repoFullName = targetRepo || customRepoPath.trim();
    if (!repoFullName) {
      setErrorMessage("कृपया रिपोजिटरी को चुनें या मार्ग डालें!");
      return;
    }

    setPushStatus("loading");
    setErrorMessage("");
    setCurrentProgress(10);
    const logs: string[] = [];
    const addLog = (msg: string) => {
      logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      setPushLogs([...logs]);
    };

    addLog(`Initiating commits of ${parsedFiles.length} files to "${repoFullName}"...`);
    const [owner, name] = repoFullName.split("/");

    const authHeaders = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    };

    try {
      // Step 1: Verify Repo Exists
      addLog("Step 1/5: Verification - Validating target repository ownership and scope...");
      const repoCheck = await fetch(`https://api.github.com/repos/${owner}/${name}`, { headers: authHeaders });
      if (!repoCheck.ok) {
        throw new Error(`Repository "${repoFullName}" not found or lacks token write scopes.`);
      }
      addLog(`Success: Repository "${repoFullName}" is active and writable.`);
      setCurrentProgress(25);

      // Step 2: Get branch reference (latest tree sha) if exists
      addLog(`Step 2/5: Checking latest commit branch reference: heads/${targetBranch}...`);
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${targetBranch}`, { headers: authHeaders });
      
      let parentCommitSha = "";
      let parentTreeSha = "";
      let isBrandNewBranch = false;
      let filesToProcess = [...parsedFiles];

      if (refRes.ok) {
        const refData = await refRes.json();
        parentCommitSha = refData.object.sha;
        addLog(`Located head branch commit anchor Point SHA: ${parentCommitSha.substring(0, 7)}`);

        // Fetch tree of latest commit
        const commitRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits/${parentCommitSha}`, { headers: authHeaders });
        if (commitRes.ok) {
          const commitData = await commitRes.json();
          parentTreeSha = commitData.tree.sha;
          addLog(`Active Base Tree anchor located: ${parentTreeSha.substring(0, 7)}`);
        }
      } else {
        // If branch doesn't exist, check default branch context or fallback to totally empty start
        addLog(`Target branch "/heads/${targetBranch}" not initiated yet.`);
        isBrandNewBranch = true;
        
        // Let's check fallback parent commit of default branch if repo isn't blank
        const repoData = await repoCheck.json();
        const dBranch = repoData.default_branch || "main";
        addLog(`Attempting to base on repository's default branch: heads/${dBranch}...`);
        
        const dBranchRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/ref/heads/${dBranch}`, { headers: authHeaders });
        if (dBranchRes.ok) {
          const dBranchData = await dBranchRes.json();
          parentCommitSha = dBranchData.object.sha;
          addLog(`Anchor point imported from default branch commit: ${parentCommitSha.substring(0, 7)}`);
          
          const dCommitRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits/${parentCommitSha}`, { headers: authHeaders });
          if (dCommitRes.ok) {
            const dCommitData = await dCommitRes.json();
            parentTreeSha = dCommitData.tree.sha;
          }
        } else {
          addLog("Repository is completely empty (अत्यंत नया रिपोजिटरी) - Bootstrapping with PUT contents...");
          const firstFile = parsedFiles[0];
          addLog(`Initializing first file /${firstFile.path} via PUT contents API to bootstrap initial repository branches...`);
          const initRes = await fetch(`https://api.github.com/repos/${owner}/${name}/contents/${firstFile.path}`, {
            method: "PUT",
            headers: authHeaders,
            body: JSON.stringify({
              message: `🎉 Bootstrap repository with ${firstFile.path}`,
              content: firstFile.base64,
              branch: targetBranch
            })
          });
          if (!initRes.ok) {
            const initErrText = await initRes.text();
            let initErrMsg = initErrText;
            try {
              const initErrJson = JSON.parse(initErrText);
              initErrMsg = initErrJson.message || initErrText;
            } catch(e) {}
            throw new Error(`Failed to bootstrap empty repository: ${initErrMsg}`);
          }
          const initData = await initRes.json();
          parentCommitSha = initData.commit.sha;
          parentTreeSha = initData.commit.tree.sha;
          isBrandNewBranch = false;
          filesToProcess = parsedFiles.slice(1);
          addLog(`Successfully bootstrapped repository with ${firstFile.path}! Commit: ${parentCommitSha.substring(0, 7)}`);
        }
      }
      setCurrentProgress(45);

      if (filesToProcess.length === 0) {
        addLog("All files have been successfully written to remote branches.");
        setCommitUrl(`https://github.com/${owner}/${name}/commit/${parentCommitSha}`);
        setPushStatus("success");
        addLog("🎉 Huzzah! Project committed and successfully pushed onto remote GitHub branches!");
        setCurrentProgress(100);
        return;
      }

      // Step 3: Create Blobs for each file sequentially (parallel limit or batch)
      addLog("Step 3/5: Encoding & Deploying repository files as Git Database Blobs...");
      const treeItems: any[] = [];
      
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        addLog(`Processing blob upload for: ${file.path} (${(file.size / 1024).toFixed(1)} KB)`);

        const blobRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/blobs`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            content: file.base64,
            encoding: "base64"
          })
        });

        if (!blobRes.ok) {
          const errData = await blobRes.json();
          throw new Error(`Failed to create git blob for file ${file.path}: ${errData.message}`);
        }

        const blobData = await blobRes.json();
        treeItems.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blobData.sha
        });
      }
      addLog(`Sourced the SHA hash signatures for all ${filesToProcess.length} file bundles successfully.`);
      setCurrentProgress(70);

      // Step 4: Create new Git Tree
      addLog("Step 4/5: Crafting the centralized virtual Git Tree layout...");
      const treePayload: any = {
        tree: treeItems
      };
      if (parentTreeSha) {
        treePayload.base_tree = parentTreeSha;
      }

      const treeRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/trees`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(treePayload)
      });

      if (!treeRes.ok) {
        const treeErr = await treeRes.json();
        throw new Error(`Failed to define git directory structure layout: ${treeErr.message}`);
      }

      const newTreeData = await treeRes.json();
      const newTreeSha = newTreeData.sha;
      addLog(`Directory indexing tree created at SHA reference: ${newTreeSha.substring(0, 10)}`);
      setCurrentProgress(85);

      // Step 5: Define the actual Commit
      addLog("Step 5/5: Preparing commit nodes and final signature references...");
      const commitPayload: any = {
        message: commitMessage.trim() || "Update files via Texly Studio DevStudio",
        tree: newTreeSha,
        parents: parentCommitSha ? [parentCommitSha] : []
      };

      const commitRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/commits`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(commitPayload)
      });

      if (!commitRes.ok) {
        const commitErr = await commitRes.json();
        throw new Error(`Execution block failed on creating commit metadata: ${commitErr.message}`);
      }

      const newCommitData = await commitRes.json();
      const newCommitSha = newCommitData.sha;
      addLog(`Commit signed successfully. SHA reference code: ${newCommitSha.substring(0, 10)}`);

      // Final Step: Write the reference update
      addLog(`Pushing branch head updates onto repo pointer: refs/heads/${targetBranch}...`);
      
      let refUpdateRes;
      if (isBrandNewBranch && !parentCommitSha) {
        // Create brand new reference
        refUpdateRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            ref: `refs/heads/${targetBranch}`,
            sha: newCommitSha
          })
        });
      } else {
        // Patch current reference
        refUpdateRes = await fetch(`https://api.github.com/repos/${owner}/${name}/git/refs/heads/${targetBranch}`, {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            sha: newCommitSha,
            force: true
          })
        });
      }

      if (!refUpdateRes.ok) {
        const refErr = await refUpdateRes.json();
        throw new Error(`Could not update branch reference path point: ${refErr.message}`);
      }

      setCommitUrl(`https://github.com/${owner}/${name}/commit/${newCommitSha}`);
      setPushStatus("success");
      addLog("🎉 Huzzah! Project committed and successfully pushed onto remote GitHub branches!");
      setCurrentProgress(100);
      
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An unexpected error occurred during database indexing push.");
      setPushStatus("error");
    }
  };

  return (
    <div className="space-y-6" id="github_pusher_tab">
      
      {/* Header Info Hero Banner */}
      <div className="p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-cyan-950/20 border border-zinc-850 rounded-2xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl z-10">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold tracking-wider rounded uppercase">Secure Integrator</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-zinc-500 text-xs font-mono">Status: Connected</span>
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-white flex items-center gap-2">
            <Github size={20} className="text-white" />
            GitHub Project Pusher (गिटहब प्रोजेक्ट पुशर)
          </h2>
          <p className="text-zinc-400 text-xs leading-relaxed">
            आसानी से अपने किसी भी GitHub रिपोजिटरी में फ़ाइलें, फ़ोल्डर या <strong>ZIP आर्काइव (.zip)</strong> सीधे अपलोड करें। 
            ज़िप फ़ाइलों के अंदर छुपे हुए अनावश्यक बाहरी फ़ोल्डर्स को टूल अपने-आप पहचानकर ख़त्म कर देता है और फ़ाइलों को मुख्य रूट पर बिल्कुल सही तरीके से पुश करता है।
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3 z-10">
          {username ? (
            <div className="flex items-center gap-2.5 bg-zinc-950 border border-zinc-850 p-1.5 pr-3 rounded-full">
              <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full border border-zinc-800" referrerPolicy="no-referrer" />
              <div className="text-left">
                <p className="text-white text-xs font-bold font-mono">@{username}</p>
                <button onClick={handleDisconnect} className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-wider hover:underline block text-left">Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-1.5 bg-zinc-950 border border-zinc-900 rounded-lg text-zinc-500 font-mono text-[10px]">
              Offline Sandbox
            </div>
          )}
        </div>
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-[50px] pointer-events-none"></div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
          <AlertTriangle className="shrink-0 mt-0.5 text-rose-400" size={16} />
          <div>
            <span className="font-bold underline">त्रुटि / Issue:</span> {errorMessage}
          </div>
        </div>
      )}

      {/* GitHub Authentication Gate */}
      {!isTokenSaved && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 bg-[#0c0c12] border border-zinc-900 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-white font-medium text-sm">GitHub Personal Access Token (PAT)</h3>
                <p className="text-zinc-500 text-xs">कनेक्ट करने के लिए अपने गिटहब टोकन का उपयोग करें।</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-zinc-400 text-xs font-medium block">Personal Access Token (with 'repo' scope)</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="github_pat_..."
                  className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                >
                  {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveToken}
              disabled={isVerifying || !token.trim()}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 active:scale-95 disabled:opacity-50 disabled:scale-100 text-black font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isVerifying ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Verifying Scope...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>टोकन सेव करें और कनेक्ट करें (Save & Connect)</span>
                </>
              )}
            </button>
          </div>

          <div className="md:col-span-5 bg-[#0c0c12] border border-zinc-900 p-6 rounded-2xl relative flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-white font-medium text-xs flex items-center gap-1.5 uppercase tracking-wider">
                <Info size={14} className="text-zinc-400" />
                टोकन कैसे बनाएं? (How to generate)
              </h3>
              <ol className="text-zinc-400 text-xs space-y-2 list-decimal pl-4 leading-normal">
                <li>अपने गिटहब अकाउंट पर जाएं।</li>
                <li><strong className="text-zinc-300">Settings &gt; Developer settings &gt; Personal access tokens &gt; Tokens (classic)</strong> पर जाएं।</li>
                <li><strong className="text-zinc-200">Generate new token (classic)</strong> पर क्लिक करें।</li>
                <li>Note में 'Texly Builder' लिखें और <strong className="text-zinc-200">repo</strong> स्कोप पर टिक करें (यह फ़ाइलें पुश करने के लिए अनिवार्य है)।</li>
                <li>टोकन जनरेट करके कॉपी करें और यहाँ पेस्ट करें!</li>
              </ol>
            </div>
            
            <a 
              href="https://github.com/settings/tokens" 
              target="_blank" 
              rel="noreferrer" 
              className="mt-4 border border-zinc-850 hover:border-zinc-800 bg-zinc-950 px-4 py-2.5 rounded-xl text-center text-xs text-zinc-300 hover:text-white font-medium flex items-center justify-center gap-1.5 transition"
            >
              <span>गिटहब टोकन पेज खोलें (Open GitHub Tokens Page)</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      {/* Logged in Area Options and configuration setting */}
      {isTokenSaved && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Configuration and settings of where to push */}
          <div className="lg:col-span-5 bg-[#0c0c12] border border-zinc-900 p-5 rounded-2xl space-y-5">
            <h3 className="text-white font-medium text-xs uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-3">
              <FolderSync size={14} className="text-cyan-400" />
              1. Deployment Details (अपलोड लक्ष्य चुनें)
            </h3>

            {/* Selector modes */}
            {!createRepoMode ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-zinc-400 text-xs font-semibold">गिटहब रिपोजिटरी (Choose Repository)</label>
                    <button 
                      onClick={() => setCreateRepoMode(true)}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold tracking-tight hover:underline cursor-pointer"
                    >
                      + नया रिपॉजिटरी बनाएं
                    </button>
                  </div>
                  {userRepos.length > 0 ? (
                    <select
                      value={targetRepo}
                      onChange={(e) => {
                        setTargetRepo(e.target.value);
                        const found = userRepos.find(r => r.full_name === e.target.value);
                        if (found) setTargetBranch(found.default_branch);
                      }}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                    >
                      {userRepos.map((r) => (
                        <option key={r.full_name} value={r.full_name}>
                          {r.full_name} {r.private ? "(Private / प्राइवेट)" : "(Public / पब्लिक)"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={customRepoPath}
                        onChange={(e) => setCustomRepoPath(e.target.value)}
                        placeholder="e.g. username/repository-name"
                        className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-mono text-white focus:outline-none"
                      />
                      <p className="text-zinc-500 text-[10px]">Your dynamic repositories list is empty, type custom path above.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <h4 className="text-white text-xs font-bold">नया रिपोजिटरी बनाएं (Create Repository)</h4>
                  <button 
                    onClick={() => setCreateRepoMode(false)}
                    className="text-zinc-500 hover:text-zinc-300 text-[10px] font-bold"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 text-[10px] font-medium block">Repository Name</label>
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))}
                      placeholder="e.g. my-awesome-project"
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-lg text-xs font-mono text-white focus:outline-none"
                    />
                  </div>

                  {/* Private vs Public Toggle option */}
                  <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded-lg border border-zinc-900">
                    <span className="text-zinc-400 text-xs">Private Repository (सलाह)</span>
                    <button
                      type="button"
                      onClick={() => setIsNewRepoPrivate(!isNewRepoPrivate)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isNewRepoPrivate ? 'bg-cyan-500' : 'bg-zinc-805'}`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${isNewRepoPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <button
                    onClick={handleCreateNewRepo}
                    disabled={isCreatingRepo || !newRepoName.trim()}
                    className="w-full py-2 bg-cyan-400 hover:bg-cyan-500 disabled:opacity-50 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition"
                  >
                    {isCreatingRepo ? <RefreshCw size={12} className="animate-spin" /> : null}
                    <span>क्रिएट करें और आगे बढ़ें (Create & Select)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Target Branch selection */}
            <div className="space-y-2">
              <label className="text-zinc-400 text-xs font-semibold flex items-center gap-1">
                <GitBranch size={13} className="text-zinc-500" />
                शाखा चुनें (Target Branch)
              </label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="e.g. main"
                className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
              <p className="text-zinc-500 text-[10px]">यदि यह शाखा मौजूद नहीं है, तो टूल इसे आपके लिए स्वयं बना देगा।</p>
            </div>

            {/* Commit Message details option */}
            <div className="space-y-2">
              <label className="text-zinc-400 text-xs font-semibold">कमेंट संदेश (Custom Commit Message)</label>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Describe your commit details"
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400 resize-none"
              />
            </div>
          </div>

          {/* DRAG AND DROP FILE UPLOADER & EXTRACTED VIEW PANEL */}
          <div className="lg:col-span-7 bg-[#0c0c12] border border-zinc-900 p-5 rounded-2xl flex flex-col justify-between space-y-4">
            <h3 className="text-white font-medium text-xs uppercase tracking-wider flex items-center justify-between gap-1.5 border-b border-zinc-900 pb-3">
              <span className="flex items-center gap-1.5">
                <FolderUp size={14} className="text-indigo-400" />
                2. Sourced Files Panel (फ़ाइलें और ज़िप जोड़ें)
              </span>
              {parsedFiles.length > 0 && (
                <button 
                  onClick={clearAllFiles}
                  className="text-rose-400 hover:text-rose-350 text-[10px] font-bold uppercase hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </h3>

            {/* Loading Extraction Indicator */}
            {isExtracting && (
              <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-medium flex items-center justify-center gap-2">
                <RefreshCw size={15} className="animate-spin" />
                <span>Extacking compressed ZIP files... Nesting analysis in progress...</span>
              </div>
            )}

            {/* Zip status notice tags */}
            {zipMessage && !isExtracting && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                <Check size={14} className="shrink-0 text-emerald-500" />
                <span><strong className="underline">Optimize details:</strong> {zipMessage}</span>
              </div>
            )}

            {/* Direct Drag & Drop Interface container */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition ${dragActive ? 'border-cyan-400 bg-cyan-950/5' : 'border-zinc-850 hover:border-zinc-700 bg-zinc-950/40'}`}
            >
              <input
                type="file"
                ref={fileInputRef}
                multiple
                onChange={async (e) => {
                  if (e.target.files) await handleUploadedFiles(e.target.files);
                }}
                className="hidden"
                accept=".zip,image/*,text/*,application/json,application/javascript,application/x-typescript"
              />
              <div className="p-3 bg-zinc-900 rounded-full border border-zinc-800 text-zinc-400">
                <Upload size={22} className="animate-pulse" />
              </div>
              <p className="text-white text-xs font-medium text-center">
                ज़िप फ़ाइल, या अन्य फाइलें यहाँ ड्रैग करके ड्रॉप करें या ब्राउज़ करें
              </p>
              <p className="text-zinc-500 text-[10px] text-center max-w-sm leading-relaxed">
                Supports Standard files & <strong>.zip archives</strong> recursively. Redundant sub-directory structures inside ZIPs are auto-flattened!
              </p>
            </div>

            {/* Loaded files collection scroll list tree */}
            {parsedFiles.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-zinc-550 text-[10px] font-mono px-1">
                  <span>FILES READY FOR COMMIT ({parsedFiles.length} items)</span>
                  <span>SIZE</span>
                </div>
                <div className="max-h-[190px] overflow-y-auto scrollbar-thin border border-zinc-900 rounded-xl divide-y divide-zinc-900 bg-zinc-950/60">
                  {parsedFiles.map((file, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-zinc-900/40 transition gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode size={14} className="text-cyan-500 shrink-0" />
                        <span className="text-zinc-300 font-mono text-[11px] truncate" title={file.path}>
                          {file.path}
                        </span>
                        <span className="px-1.5 py-0.5 bg-zinc-900 text-zinc-500 text-[8px] rounded font-bold uppercase shrink-0">
                          {file.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-zinc-500 font-mono text-[10px]">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                        <button 
                          onClick={() => removeFile(idx)}
                          className="text-zinc-500 hover:text-rose-400 p-0.5 transition"
                          title="Remove file"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border border-zinc-900/60 rounded-xl p-8 text-center text-zinc-500 text-xs">
                कोई फ़ाइल नहीं चुनी गई है। कृपया ऊपर .zip या स्थानीय फाइलें अपलोड करें।
              </div>
            )}

            {/* Execute Deploy Button trigger */}
            <div className="border-t border-zinc-900/60 pt-4">
              <button
                onClick={handlePushToGitHub}
                disabled={parsedFiles.length === 0 || pushStatus === "loading"}
                className="w-full py-3 bg-gradient-to-r from-cyan-400 to-indigo-500 text-black hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:scale-100 font-extrabold text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-lg shadow-cyan-950/20"
              >
                {pushStatus === "loading" ? (
                  <RefreshCw size={15} className="animate-spin text-black" />
                ) : (
                  <ArrowRight size={15} />
                )}
                <span>गिटहब पर कमिट और पुश करें (Commit & Push to GitHub)</span>
              </button>
            </div>

          </div>

        </div>
      )}

      {/* DETAILED PUSHER LIVE CONSOLE LOGS TAB */}
      {pushStatus !== "idle" && (
        <div className="bg-black/90 p-5 rounded-2xl border border-zinc-850 font-mono text-xs text-zinc-300 relative overflow-hidden space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <h3 className="text-zinc-400 font-bold flex items-center gap-2">
              <Terminal size={15} className="text-cyan-500" />
              Live Deployment Shell & Progress Logs
            </h3>
            <span className="text-xs text-cyan-400 font-bold">{currentProgress}%</span>
          </div>

          {/* Active progress tracking bar */}
          <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
            <input 
              type="range"
              disabled
              value={currentProgress}
              className="w-full h-full accent-cyan-400 pointer-events-none appearance-none"
              style={{
                background: `linear-gradient(to right, #22d3ee ${currentProgress}%, #09090e ${currentProgress}%)`
              }}
            />
          </div>

          <div className="h-[180px] overflow-y-auto space-y-1.5 p-3 rounded-lg bg-zinc-950/80 border border-zinc-900 scrollbar-thin scroll-smooth select-text">
            {pushLogs.map((log, i) => (
              <div key={i} className="text-[11px] leading-relaxed break-all">
                {log}
              </div>
            ))}
          </div>

          {/* POSITIVE DEPLOYMENT SUCCESS SCREEN */}
          {pushStatus === "success" && (
            <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-emerald-400 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <CheckCircle size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                <div className="text-xs">
                  <p className="font-bold">बधाई हो, पुश सफल रहा! (GitHub Push Successful!)</p>
                  <p className="text-zinc-400 leading-normal mt-0.5">आपके द्वारा दिए गए सभी कोड फ़ाइलें सफलतापूर्वक रिपोजिटरी में कमिट व अपडेट कर दी गई हैं।</p>
                </div>
              </div>
              
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition whitespace-nowrap decoration-transparent scale-95 hover:scale-100"
              >
                <span>Live Commit देखें (View on GitHub)</span>
                <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
