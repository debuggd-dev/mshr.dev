"use client";

import { useState, useEffect, FormEvent } from "react";
import { Copy, Check, Loader2, Link as LinkIcon, AlertCircle, Moon, Sun, ArrowLeft } from "lucide-react";

const GithubIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="currentColor" 
    viewBox="0 0 16 16"
    className={className}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8"/>
  </svg>
);

export default function Home() {
  const [url, setUrl] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ shortUrl: string; expiryLabel: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mountTime, setMountTime] = useState<number>(Date.now());
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    setMountTime(Date.now());
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (honeypot || Date.now() - mountTime < 2000) {
      setError("An error occurred during submission. Please try again.");
      return;
    }

    if (!url) {
      setError("Please enter a valid URL.");
      return;
    }

    let processedUrl = url.trim();
    if (!/^https?:\/\//i.test(processedUrl)) {
      processedUrl = `https://${processedUrl}`;
    }

    try {
      setLoading(true);

      const response = await fetch("https://l.mshr.dev/api/shorten", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: processedUrl, expiry, honeypot }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to shorten link.");
      }

      const data = await response.json();
      const expiryLabels: Record<string, string> = { "30m": "30m", "2h": "2h", "24h": "24h", "1w": "1w" };
      
      setResult({
        shortUrl: `l.mshr.dev/${data.shortCode}`,
        expiryLabel: expiry !== "never" ? expiryLabels[expiry] : "",
      });
      
    } catch (err: any) {
      console.error("Link shortening error:", err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(`https://${result.shortUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-200">
      {/* Boston Mesh Top Header */}
      <header className="bg-white dark:bg-[#161b22] border-b border-[#d0d7de] dark:border-[#30363d] py-3 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <a 
            href="https://bostonme.sh" 
            className="flex items-center gap-3 group hover:opacity-80 transition-opacity"
          >
            <img 
              src="https://bostonme.sh/img/logo.png" 
              alt="Greater Boston Mesh" 
              className="h-8 w-8 object-contain"
            />
            <span className="text-[#1a1c1e] dark:text-white font-bold text-sm tracking-tight hidden sm:inline">Greater Boston Mesh</span>
          </a>
          <div className="flex items-center gap-4">
            <a 
              href="https://bostonme.sh" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#22c55e] hover:text-[#4ade80] transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Main Site
            </a>
            <a
              href="https://github.com/debuggd-dev/mhsr.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#1a1c1e] dark:text-white transition-colors"
              aria-label="GitHub Repository"
            >
              <GithubIcon className="h-4 w-4" />
            </a>
            <button 
              onClick={toggleTheme} 
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[#1a1c1e] dark:text-white transition-colors"
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="mb-10 text-center sm:text-left sm:border-l-4 border-l-0 border-[#22c55e] sm:pl-6 pl-0">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-[#22c55e]">mshr.dev</h1>
            <p className="opacity-70 text-sm font-medium uppercase tracking-widest">Link Shortener Service</p>
          </div>

          <div className="bg-white dark:bg-[#161b22] border border-[#d0d7de] dark:border-[#30363d] rounded-xl p-6 shadow-xl relative overflow-hidden group">
            {/* Subtle accent line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[#22c55e] opacity-50"></div>
            
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <input 
                type="text" 
                name="website_url_catch" 
                value={honeypot} 
                onChange={(e) => setHoneypot(e.target.value)} 
                className="opacity-0 absolute -z-10 w-0 h-0" 
                tabIndex={-1} aria-hidden="true" autoComplete="off" 
              />

              <div className="space-y-2 group/input">
                <label htmlFor="url" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#22c55e] opacity-90 group-focus-within/input:opacity-100 transition-opacity">Destination URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none opacity-40 group-focus-within/input:opacity-100 transition-opacity">
                    <LinkIcon className="h-4 w-4" />
                  </div>
                  <input
                    id="url"
                    type="text"
                    placeholder="https://example.com/long/link"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-3 bg-transparent border border-[#d0d7de] dark:border-[#30363d] rounded-md focus:outline-none focus:border-[#22c55e] dark:focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]/20 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 group/input">
                <label htmlFor="expiry" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#22c55e] opacity-90 group-focus-within/input:opacity-100 transition-opacity">Expiration</label>
                <div className="relative">
                  <select
                    id="expiry"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full px-3 py-3 bg-transparent border border-[#d0d7de] dark:border-[#30363d] rounded-md focus:outline-none focus:border-[#22c55e] dark:focus:border-[#22c55e] focus:ring-1 focus:ring-[#22c55e]/20 transition-all appearance-none cursor-pointer text-sm"
                  >
                    <option value="never" className="dark:bg-[#161b22]">Never</option>
                    <option value="30m" className="dark:bg-[#161b22]">30 Minutes</option>
                    <option value="2h" className="dark:bg-[#161b22]">2 Hours</option>
                    <option value="24h" className="dark:bg-[#161b22]">24 Hours</option>
                    <option value="1w" className="dark:bg-[#161b22]">1 Week</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none opacity-40 group-focus-within/input:opacity-100 transition-opacity">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm mt-1 bg-red-50 dark:bg-red-950/20 p-2.5 rounded border border-red-200 dark:border-red-900/40 animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-2 bg-[#2ea043] text-white hover:bg-[#2c974b] font-bold rounded-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] shadow-lg shadow-[#2ea043]/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Shorten Link</span>
                )}
              </button>
            </form>

            {result && (
              <div className="mt-10 pt-8 border-t border-[#d0d7de] dark:border-[#30363d] animate-fade-in-up" style={{ animationDuration: '0.3s' }}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#22c55e]">Shortened Link</span>
                  {result.expiryLabel && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20">
                      Exp: {result.expiryLabel}
                    </span>
                  )}
                </div>
                
                <div 
                  onClick={copyToClipboard}
                  className="flex items-center justify-between border border-[#d0d7de] dark:border-[#30363d] rounded-md p-1.5 pl-4 bg-[#f6f8fa] dark:bg-[#0d1117] transition-all hover:border-[#22c55e]/50 group/result cursor-pointer active:scale-[0.99] shadow-sm"
                >
                  <span className="font-mono text-sm truncate pr-2 select-all font-bold text-[#22c55e]">
                    {result.shortUrl}
                  </span>
                  <button
                    className="flex items-center gap-2 px-3 py-2 bg-[#22c55e] text-white hover:bg-[#1eb355] rounded-md transition-all text-[10px] font-bold uppercase tracking-widest"
                    aria-label="Copy to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      
      <footer className="p-10 text-center text-[10px] font-bold uppercase tracking-[0.25em] opacity-40">
        Built for resilient communications.
      </footer>
    </div>
  );
}
