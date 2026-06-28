import React, { useState, useEffect, FormEvent } from "react";
import confetti from "canvas-confetti";
import { Loader2, ShieldCheck, Link, ExternalLink, FileJson, CheckCircle, Download, Copy, Check } from "lucide-react";
import { googleSignIn } from "./firebase";
import formConfigFallback from "../form_config.json";

function SetupPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [apiConsoleUrl, setApiConsoleUrl] = useState<string | null>(null);
  const [configResult, setConfigResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
  }, []);

  const handleCopy = () => {
    if (!configResult) return;
    navigator.clipboard.writeText(JSON.stringify(configResult, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!configResult) return;
    const blob = new Blob([JSON.stringify(configResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "form_config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSetup = async () => {
    setLoading(true);
    setMessage("");
    setApiConsoleUrl(null);
    setIsSuccess(false);
    try {
      const result = await googleSignIn();
      if (!result?.accessToken) throw new Error("No access token received from Google sign in");

      const res = await fetch("/api/setup-form", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${result.accessToken}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        // Attempt to extract the developer console URL if Forms API is disabled
        const errorText = data.error || "Failed to setup";
        const urlMatch = errorText.match(/https:\/\/console\.developers\.google\.com\/[^\s]*/);
        if (urlMatch) {
          setApiConsoleUrl(urlMatch[0]);
        }
        throw new Error(errorText);
      }
      
      setConfigResult(data);
      setIsSuccess(true);
      setMessage("Google Form successfully created and permanently linked to your account! The app is now configured.");
      localStorage.setItem("nerve_form_config", JSON.stringify(data));
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#ff2e97', '#15e0e6', '#ffffff']
      });
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || "An unexpected error occurred during setup.";
      if (err.code === "auth/popup-closed-by-user" || err.message?.includes("popup-closed-by-user")) {
        errorMsg = "Google Sign-In popup was closed before completion. If you are inside the AI Studio preview, please click the 'Open Setup in New Tab' button above to avoid iframe cookie restrictions.";
      } else if (err.code === "auth/network-request-failed" || err.message?.includes("network-request-failed") || err.message?.includes("auth/iframe")) {
        errorMsg = "Google Sign-In failed due to browser iframe security limits (third-party cookies are blocked). Please click the 'Open Setup in New Tab' button above to complete setup successfully in a top-level browser tab!";
      } else if (err.message?.includes("Assertion failed") || err.message?.includes("Pending promise")) {
        errorMsg = "Firebase Authentication iframe handshake failed because third-party storage is disabled in this iframe. Clicking 'Open Setup in New Tab' above will bypass this and work instantly!";
      }
      setMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0D13] flex items-center justify-center p-6 text-[#A0A5B5] font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#151821_1px,transparent_1px),linear-gradient(to_bottom,#151821_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>
      
      <div className="relative max-w-xl w-full bg-[#12151D] border border-white/5 rounded-2xl p-8 shadow-2xl overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[#ff2e97]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative">
          {inIframe && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 text-xs leading-relaxed space-y-3 shadow-md">
              <div className="flex items-start space-x-2.5">
                <span className="text-base leading-none">⚠️</span>
                <p>
                  <b>Running inside Preview Frame:</b> Standard Google Sign-In is restricted by modern browser cookie privacy rules inside cross-origin iframes.
                </p>
              </div>
              <div className="pl-6">
                <button
                  type="button"
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/35 text-amber-200 rounded-lg font-semibold border border-amber-500/30 transition-all text-[11px] cursor-pointer flex items-center space-x-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Setup in New Tab</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Neupo Control Plane</div>
              <h1 className="text-xl font-bold text-white tracking-tight">Admin & Form Setup</h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-8 text-white/60">
            Link this feedback platform permanently to your Google Forms account. 
            When users submit responses, they will go directly to your personal Google Form client-side, 
            which operates completely without server dependencies when deployed to production.
          </p>

          {isSuccess ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start space-x-3 text-emerald-400">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-white">Setup Succeeded!</h3>
                  <p className="text-xs mt-1 text-emerald-400/80">{message}</p>
                </div>
              </div>

              {configResult && (
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 font-mono text-xs space-y-4">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-white/40">Form ID:</span>
                    <span className="text-cyan-400 select-all">{configResult.formId}</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-white/40">Form Responder URL:</span>
                    <a 
                      href={configResult.actionUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-white/80 hover:text-white underline truncate flex items-center"
                    >
                      {configResult.actionUrl}
                      <ExternalLink className="w-3 h-3 ml-1 shrink-0" />
                    </a>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all text-white border border-white/10 rounded-lg font-medium text-xs flex items-center justify-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download form_config.json</span>
                    </button>
                    <button
                      onClick={handleCopy}
                      className="py-2 px-3 bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all text-white border border-white/10 rounded-lg font-medium text-xs flex items-center justify-center space-x-1.5 w-24"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-white/5">
                    <div className="text-white/40 mb-1 flex items-center">
                      <FileJson className="w-3.5 h-3.5 mr-1" />
                      Status:
                    </div>
                    <p className="text-white/70 text-[11px] leading-relaxed">
                      This setup wrote the configuration locally and saved it to this browser's <code className="text-cyan-300">localStorage</code>. This browser can submit responses instantly!
                    </p>
                    <p className="text-white/50 text-[10px] mt-2 leading-relaxed">
                      👉 <b>Deploying to Vercel/Production?</b> Click "Download form_config.json" above, place it in your project's root folder (replacing the empty config), commit, and push to GitHub. Vercel will work perfectly with zero backend servers!
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={() => window.location.href = "/"}
                className="w-full py-3 bg-white text-black hover:bg-white/95 transition-all rounded-lg font-medium text-sm shadow-lg flex items-center justify-center space-x-2"
              >
                <span>Go to Form Application</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={handleSetup}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 bg-white hover:bg-white/95 active:bg-white/90 disabled:opacity-50 transition-all text-black py-3 px-4 rounded-xl font-medium text-sm shadow-md cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Configuring Neupo Connection...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>Sign in with Google & Link Form</span>
                  </>
                )}
              </button>

              {message && (
                <div className={`p-4 rounded-xl text-xs border ${apiConsoleUrl ? 'bg-[#ff2e97]/10 border-[#ff2e97]/20 text-[#ff2e97]' : 'bg-white/5 border-white/5 text-white/80'}`}>
                  <p className="font-mono leading-relaxed">{message}</p>
                  
                  {apiConsoleUrl && (
                    <div className="mt-4 pt-4 border-t border-[#ff2e97]/10 space-y-2">
                      <p className="text-white/90 font-sans font-semibold">Action required:</p>
                      <p className="text-white/60 font-sans leading-relaxed">
                        To automatically generate forms on your Google Drive, you must enable the Google Forms API in your Google Cloud Project. 
                        Click the button below to open Google Cloud Console and enable it with one click, then retry:
                      </p>
                      <a
                        href={apiConsoleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 bg-[#ff2e97] hover:bg-[#ff2e97]/90 text-white font-sans font-medium px-4 py-2.5 rounded-lg transition-all shadow-md mt-2 text-xs"
                      >
                        <span>Enable Google Forms API</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="mt-12 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/30">
              Neupo · Project Camry · Secure Auth Loop
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [search, setSearch] = useState(window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Hidden admin setup path / search parameter
  if (path === "/setup-admin" || search === "?setup=admin") {
    return <SetupPage />;
  }

  return <MainForm />;
}

function MainForm() {
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [pulse, setPulse] = useState(false);
  const TOTAL_STEPS = 4;
  const STEP_NAMES = ["You & your stack", "The problem", "The solution", "Pricing & you"];
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(window.self !== window.top);
  }, []);

  // Add playSuccessChime
  const playSuccessChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.error("Audio API not supported", e);
    }
  };

  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.target.type === 'text' || e.target.type === 'email' || e.target.tagName === 'TEXTAREA') {
          return;
        }
      }

      if (e.key === "ArrowLeft") {
        if (step > 1 && step <= TOTAL_STEPS && !submitting) {
          setStep(s => s - 1);
        }
      } else if (e.key === "ArrowRight") {
        if (step < TOTAL_STEPS && !submitting) {
          const btn = document.querySelector(".btn-go") as HTMLButtonElement;
          if (btn) btn.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step, submitting]);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && data.configured) {
          setConfig(data);
        } else {
          // Check localStorage fallback
          const localConfig = localStorage.getItem("nerve_form_config");
          if (localConfig) {
            try {
              const parsed = JSON.parse(localConfig);
              if (parsed && parsed.configured) {
                setConfig(parsed);
                return;
              }
            } catch {}
          }
          if (formConfigFallback && formConfigFallback.configured) {
            setConfig(formConfigFallback);
          }
        }
      })
      .catch((err) => {
        console.warn("Dynamic config fetch failed, checking local fallbacks:", err);
        const localConfig = localStorage.getItem("nerve_form_config");
        if (localConfig) {
          try {
            const parsed = JSON.parse(localConfig);
            if (parsed && parsed.configured) {
              setConfig(parsed);
              return;
            }
          } catch {}
        }
        if (formConfigFallback && formConfigFallback.configured) {
          setConfig(formConfigFallback);
        }
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  // Restore form state
  useEffect(() => {
    if (!loadingConfig && config) {
      const savedStep = localStorage.getItem("nerve_form_step");
      if (savedStep) {
        setStep(parseInt(savedStep, 10));
      }
      const savedData = localStorage.getItem("nerve_form_data");
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          const form = document.getElementById("nerveForm") as HTMLFormElement;
          if (form) {
            Object.entries(parsed).forEach(([key, val]) => {
              const inputs = form.querySelectorAll(`[name="${key}"]`);
              if (inputs.length === 0) return;
              const firstInput = inputs[0] as HTMLInputElement;
              if (firstInput.type === "radio" || firstInput.type === "checkbox") {
                const values = Array.isArray(val) ? val : [val];
                inputs.forEach((input: any) => {
                  if (values.includes(input.value)) {
                    input.checked = true;
                  }
                });
              } else {
                (inputs[0] as HTMLInputElement).value = val as string;
              }
            });
          }
        } catch (e) {
          console.error("Failed to restore form data", e);
        }
      }
    }
  }, [loadingConfig, config]);

  // Persist step
  useEffect(() => {
    localStorage.setItem("nerve_form_step", step.toString());
  }, [step]);

  const handleFormChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    const target = e.target as HTMLInputElement;
    if (target.type === "checkbox") {
      const q = target.closest(".q") as HTMLElement;
      if (q && q.dataset.max) {
        const max = parseInt(q.dataset.max, 10);
        const name = target.name;
        const checkedCount = q.querySelectorAll(`input[name="${name}"]:checked`).length;
        if (checkedCount > max) {
          target.checked = false;
        }
      }
    }

    // Persist data
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data: Record<string, string | string[]> = {};
    formData.forEach((val, key) => {
      if (data[key]) {
        if (Array.isArray(data[key])) {
          (data[key] as string[]).push(val as string);
        } else {
          data[key] = [data[key] as string, val as string];
        }
      } else {
        data[key] = val as string;
      }
    });
    localStorage.setItem("nerve_form_data", JSON.stringify(data));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;

    if (step < TOTAL_STEPS) {
      const stepEl = form.querySelector(`.step[data-step="${step}"]`);
      if (stepEl) {
        let valid = true;

        stepEl.querySelectorAll(".q[data-required]").forEach((q: any) => {
          q.classList.remove("invalid");
          const key = q.dataset.key;
          const inputs = q.querySelectorAll(`input[name="${key}"]`);
          const type = inputs[0]?.type;
          
          let qValid = false;
          if (type === "radio") {
            qValid = Array.from(inputs).some((i: any) => i.checked);
          } else if (type === "checkbox") {
            const min = parseInt(q.dataset.min || "1", 10);
            qValid = Array.from(inputs).filter((i: any) => i.checked).length >= min;
          } else {
            qValid = Array.from(inputs).some((i: any) => i.value.trim() !== "");
          }
          
          if (!qValid) {
            q.classList.add("invalid");
            valid = false;
          }
        });

        // enforce max checked checkboxes logic across all `.q[data-max]` elements
        stepEl.querySelectorAll(".q[data-max]").forEach((q: any) => {
          const max = parseInt(q.dataset.max, 10);
          const key = q.dataset.key;
          const inputs = q.querySelectorAll(`input[name="${key}"]`);
          if (inputs[0]?.type === "checkbox") {
            const checkedCount = Array.from(inputs).filter((i: any) => i.checked).length;
            if (checkedCount > max) {
              q.classList.add("invalid");
              valid = false;
            } else if (q.dataset.required) {
               // Only remove invalid if it passed the required min check too
               const min = parseInt(q.dataset.min || "1", 10);
               if (checkedCount >= min) {
                 q.classList.remove("invalid");
               }
            } else {
              q.classList.remove("invalid");
            }
          }
        });

        const emailInput = stepEl.querySelector('input[type="email"]') as HTMLInputElement;
        if (emailInput && emailInput.value.trim() !== "") {
          const q = emailInput.closest(".q");
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInput.value.trim())) {
            q?.classList.add("invalid");
            valid = false;
          } else if (!q?.hasAttribute("data-required") || emailInput.value.trim() !== "") {
            q?.classList.remove("invalid");
          }
        }

        if (!valid) {
          const firstInvalid = stepEl.querySelector(".q.invalid");
          if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      }
      setStep((s) => s + 1);
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const data: Record<string, string | string[]> = {};
      formData.forEach((val, key) => {
        if (data[key]) {
          if (Array.isArray(data[key])) {
            (data[key] as string[]).push(val as string);
          } else {
            data[key] = [data[key] as string, val as string];
          }
        } else {
          data[key] = val as string;
        }
      });

      if (config && config.actionUrl) {
        // Construct standard URL-encoded parameters for Google Forms
        const params = new URLSearchParams();
        for (const [key, val] of Object.entries(data)) {
          const entryId = config.entryMapping[key];
          if (!entryId) continue;

          if (Array.isArray(val)) {
            val.forEach((v) => {
              if (v) params.append(entryId, String(v));
            });
          } else {
            if (val !== undefined && val !== null && val !== "") {
              params.append(entryId, String(val));
            }
          }
        }

        // Submit directly client-side. We use 'no-cors' mode because Google Forms 
        // does not set CORS headers, but will successfully record the submission.
        await fetch(config.actionUrl, {
          method: "POST",
          body: params,
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      } else {
        // Fallback to local server proxy in dev environments
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          let errorMessage = "Failed to submit";
          try {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          } catch (parseErr) {
            errorMessage = `Server Error (${res.status}). The form is not connected.`;
          }
          throw new Error(errorMessage);
        }
      }
      setDone(true);
      playSuccessChime();
      localStorage.removeItem("nerve_form_data");
      localStorage.removeItem("nerve_form_step");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff2e97', '#15e0e6', '#ffffff']
      });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="field-bg"></div>
      <div className="wrap">
        <header>
          <h1>One API for<br /><span className="grad">every notification<br/>you send</span></h1>
          <p className="sub">Neupo is the single API your product calls to deliver <b>OTPs,<br/>alerts and campaigns</b> across SMS, WhatsApp, push and email<br/>— every provider, every market, behind one integration.</p>
          
          <div className="flex flex-col sm:flex-row items-stretch justify-center gap-6 mt-12 mb-4 max-w-4xl mx-auto">
            <div className="card !m-0 !p-6 text-left relative z-10 flex-1">
              <p className="eyebrow !text-[var(--muted-2)] !mb-4 tracking-widest text-[11px]">TODAY</p>
              <p className="text-[13.5px] leading-[1.6] text-[var(--muted)] m-0">Twilio for SMS, SendGrid for email, FCM for push, a regional provider for Africa — plus the routing, failover & compliance you build between them.</p>
            </div>
            
            <div className="text-[var(--sig-violet)] hidden sm:flex items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
            <div className="text-[var(--sig-violet)] sm:hidden rotate-90 flex justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>

            <div className="card solution !m-0 !p-6 text-left relative z-10 flex-1">
              <p className="eyebrow !text-[var(--sig-cyan)] !mb-4 tracking-widest text-[11px]">WITH NEUPO</p>
              <p className="text-[13.5px] leading-[1.6] text-[var(--text)] m-0">One <code className="bg-white/5 px-1.5 py-0.5 rounded text-[13px] font-mono text-[var(--sig-magenta)]">POST /send</code>. Every channel, provider and market behind a single integration.</p>
            </div>
          </div>
          
          <div className="signal-line mt-12"></div>
        </header>

        <section className="story">
          <div className="card problem">
            <p className="eyebrow">▲ THE FRICTION</p>
            <h3>You're not in the notifications<br/>business — but you maintain its<br/>whole stack</h3>
            <ul>
              <li>A separate provider & SDK per channel<br/>and region — plus the routing and failover<br/>glue you own forever</li>
              <li>A provider degrades overnight, OTPs stop<br/>landing, and someone gets paged to<br/>reroute by hand</li>
              <li>Compliance stitched into app code, and<br/>no single answer to "did it deliver?"</li>
            </ul>
            <div className="stats">
              <div className="stat"><div className="num">4-6</div><div className="lbl">provider<br/>integrations<br/>stitched together<br/>for coverage</div></div>
              <div className="stat"><div className="num">weeks</div><div className="lbl">to add each new<br/>channel or<br/>region, by hand</div></div>
              <div className="stat"><div className="num">hours</div><div className="lbl">to trace one<br/>failed message<br/>across<br/>dashboards</div></div>
            </div>
            <p className="impact"><b>For you:</b> senior engineers stuck on<br/>plumbing — and the cracks land on login,<br/>checkout and OTP.</p>
          </div>
          <div className="card solution">
            <p className="eyebrow">◆ THE FIX</p>
            <h3>One call sends it everywhere —<br/>Neupo handles the rest</h3>
            <ul>
              <li>One endpoint for SMS, WhatsApp, push &<br/>email — every provider behind it</li>
              <li>Automatic failover, cost-based routing &<br/>exactly-once delivery, built in</li>
              <li>Pre-flight compliance, data residency &<br/>one delivery dashboard — not your code</li>
            </ul>
            <div className="stats">
              <div className="stat"><div className="num">1M/sec</div><div className="lbl">requests<br/>ingested with<br/>zero data loss</div></div>
              <div className="stat"><div className="num">99.99%</div><div className="lbl">uptime, backed<br/>by an SLA</div></div>
              <div className="stat"><div className="num">99.5%+</div><div className="lbl">transactional<br/>messages<br/>delivered</div></div>
            </div>
            <p className="impact"><b>For you:</b> delete the integration layer —<br/>reaching any user on any channel<br/>becomes one call you can trust.</p>
          </div>
        </section>

        <div className="leadin">
          <p>We're building Neupo now and want it shaped around <span className="k">your</span> reality. Five<br/>minutes of honest answers decides what ships first. <span className="k">No sales follow-up<br/>unless you ask.</span></p>
        </div>

        <div className="form-shell">
          {loadingConfig ? (
            <div className="animate-pulse px-6 py-8">
              <div className="flex justify-between items-end mb-4">
                <div className="h-4 w-32 bg-white/10 rounded"></div>
                <div className="h-4 w-16 bg-white/10 rounded"></div>
              </div>
              <div className="h-1 w-full bg-white/5 rounded mb-8"></div>
              <div className="space-y-6">
                <div>
                  <div className="h-5 w-48 bg-white/10 rounded mb-2"></div>
                  <div className="h-3 w-64 bg-white/5 rounded mb-4"></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="h-14 bg-white/5 rounded border border-white/5"></div>
                    <div className="h-14 bg-white/5 rounded border border-white/5"></div>
                    <div className="h-14 bg-white/5 rounded border border-white/5"></div>
                    <div className="h-14 bg-white/5 rounded border border-white/5"></div>
                  </div>
                </div>
              </div>
            </div>
          ) : !config || !config.configured ? (
            <div className="p-8 text-center text-[#A0A5B5] space-y-6">
              <div className="w-12 h-12 rounded-full bg-[#ff2e97]/10 border border-[#ff2e97]/20 flex items-center justify-center mx-auto text-[#ff2e97]">
                <Link className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white">Google Form Connection Required</h3>
                <p className="text-sm text-white/60 max-w-md mx-auto leading-relaxed">
                  Neupo is designed to submit feedback directly to your Google Form. 
                  Please run the administrator setup to link a Google Form.
                </p>
              </div>
              
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    if (inIframe) {
                      window.open(window.location.origin + "/?setup=admin", "_blank");
                    } else {
                      window.location.search = "?setup=admin";
                    }
                  }}
                  className="px-6 py-2.5 bg-white text-black hover:bg-white/95 active:bg-white/90 transition-all rounded-xl font-medium text-sm shadow flex items-center space-x-2 cursor-pointer"
                >
                  <span>Connect Google Form</span>
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>

              <div className="pt-6 border-t border-white/5 text-left max-w-md mx-auto space-y-2">
                <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Already completed setup elsewhere?</h4>
                <p className="text-xs text-white/50 leading-relaxed">
                  If you set up the form on another device or the local preview, please click "Connect Google Form" above, 
                  sign in with Google to fetch/restore the setup instantly in this browser, OR place the downloaded <code className="text-cyan-400">form_config.json</code> in your project's root and redeploy to Vercel!
                </p>
              </div>
            </div>
          ) : !done ? (
            <>
              <div className="progress-head">
                <div className="steps-meta">
                  <span className="stepname">{STEP_NAMES[step - 1]}</span>
                  <span className="count">0{step} / 0{TOTAL_STEPS}</span>
                </div>
                <div className="bar"><i className={pulse ? "pulse-anim" : ""} style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}></i></div>
              </div>

              <form id="nerveForm" onSubmit={handleSubmit} onChange={handleFormChange} noValidate>
                {/* STEP 1 */}
                <div className={`step ${step === 1 ? "active" : ""}`} data-step="1">
                  <div className="q" data-key="role" data-required>
                    <label className="qlabel">What's your role?<span className="req">*</span></label>
                    <p className="hint">Helps us read your answers in context.</p>
                    <div className="opts grid">
                      {["CEO / Founder", "CTO / VP Engineering", "Engineering / Dev Manager", "Software Engineer", "Product Manager", "Other"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="role" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick the closest one.</p>
                  </div>

                  <div className="q" data-key="company_size" data-required>
                    <label className="qlabel">How big is your engineering org?<span className="req">*</span></label>
                    <div className="opts grid">
                      {["1–10 engineers", "11–50 engineers", "51–200 engineers", "200+ engineers"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="company_size" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick a range.</p>
                  </div>

                  <div className="q" data-key="regions">
                    <label className="qlabel">Which regions do you send notifications to?</label>
                    <p className="hint">Select all that apply.</p>
                    <div className="opts grid">
                      {["Africa", "Latin America", "Southeast Asia", "India", "US / Canada", "Europe / UK"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="regions" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="q" data-key="volume" data-required>
                    <label className="qlabel">Roughly how many notifications do you send per month?<span className="req">*</span></label>
                    <div className="opts">
                      {["Under 100K", "100K – 1M", "1M – 50M", "50M+", "Not sending yet / planning to"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="volume" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Best guess is fine.</p>
                  </div>

                  <div className="q" data-key="channels">
                    <label className="qlabel">Which channels do you use today?</label>
                    <div className="opts grid">
                      {["SMS", "WhatsApp", "Email", "Push (mobile/web)", "In-app", "Voice"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="channels" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STEP 2 */}
                <div className={`step ${step === 2 ? "active" : ""}`} data-step="2">
                  <div className="q" data-key="problems" data-required data-min="1">
                    <label className="qlabel">Which of these actually bite you today?<span className="req">*</span></label>
                    <p className="hint">Select every one you've felt. Be honest — none is a valid answer too.</p>
                    <div className="opts">
                      {["Maintaining separate provider integrations", "Throughput collapse under burst load", "Regulatory / DND compliance risk", "Overpaying on routing / no cost arbitrage", "Poor deliverability in emerging markets", "Notification fatigue / opt-outs", "No unified delivery analytics", "None of these are real problems for us"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="problems" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Tick at least one — including "none of these".</p>
                  </div>

                  <div className="q" data-key="severity" data-required>
                    <label className="qlabel">How much pain does notification infrastructure cause your team?<span className="req">*</span></label>
                    <p className="hint">1 = a non-issue · 5 = a recurring fire we'd pay to put out.</p>
                    <div className="scale">
                      {[1, 2, 3, 4, 5].map(v => (
                        <label key={v}>
                          <input type="radio" name="severity" value={v} />
                          <span className="cell">{v}</span>
                        </label>
                      ))}
                    </div>
                    <div className="scale-ends"><span>Non-issue</span><span>Recurring fire</span></div>
                    <p className="err">Drag a number.</p>
                  </div>

                  <div className="q" data-key="cost">
                    <label className="qlabel">Where does that pain show up as real cost?</label>
                    <div className="opts grid">
                      {["Engineering hours / maintenance", "Lost revenue from failed/late messages", "Overspend on message routing", "Compliance fines / legal exposure", "User churn from notification fatigue", "Doesn't really cost us much"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="cost" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="q" data-key="current_stack">
                    <label className="qlabel">What are you using today to solve this?</label>
                    <input type="text" name="current_stack" placeholder="e.g. Twilio + SendGrid, custom Kafka pipeline, Termii…" />
                  </div>
                </div>

                {/* STEP 3 */}
                <div className={`step ${step === 3 ? "active" : ""}`} data-step="3">
                  <div className="q" data-key="likelihood" data-required>
                    <label className="qlabel">If Neupo existed today, how likely would you be to try it?<span className="req">*</span></label>
                    <p className="hint">0 = wouldn't touch it · 10 = take my integration now.</p>
                    <div className="scale ten">
                      {[0,1,2,3,4,5,6,7,8,9,10].map(v => (
                        <label key={v}>
                          <input type="radio" name="likelihood" value={v} />
                          <span className="cell">{v}</span>
                        </label>
                      ))}
                    </div>
                    <div className="scale-ends"><span>Not interested</span><span>Take my money</span></div>
                    <p className="err">Pick a number.</p>
                  </div>

                  <div className="q" data-key="top_features" data-required data-min="1" data-max="3">
                    <label className="qlabel">Which capabilities would actually move the needle for you?<span className="req">*</span></label>
                    <p className="hint">Choose up to 3 — what you'd switch for.</p>
                    <div className="opts">
                      {["Single unified API across all channels", "Smart failover & cost-based routing", "1M RPS hyperscale ingestion", "Built-in compliance & DND checks", "AI send-time optimization & dedup", "Unified analytics & delivery tracking", "MCP / AI-agent developer integration"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="top_features" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick 1–3.</p>
                  </div>

                  <div className="q" data-key="barriers">
                    <label className="qlabel">What would stop you from adopting something like Neupo?</label>
                    <div className="opts grid">
                      {["Migration effort", "Vendor lock-in concern", "Trust / reliability of a new vendor", "Price", "Security / data privacy", "Nothing major — we'd try it"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="barriers" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STEP 4 */}
                <div className={`step ${step === 4 ? "active" : ""}`} data-step="4">
                  <div className="q" data-key="budget" data-required>
                    <label className="qlabel">What monthly platform budget would this realistically sit in?<span className="req">*</span></label>
                    <div className="opts">
                      {["Free tier only", "Under $200 / mo", "$200 – $1,000 / mo", "$1,000 – $5,000 / mo", "$5,000+ / mo (enterprise)"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="budget" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick the band that fits.</p>
                  </div>

                  <div className="q" data-key="price_too_high" data-required>
                    <label className="qlabel">At what per-1,000-requests price would Neupo feel too expensive to justify?<span className="req">*</span></label>
                    <div className="opts grid">
                      {["Over $0.10 / 1K", "Over $0.50 / 1K", "Over $1 / 1K", "Over $5 / 1K"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="price_too_high" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick a ceiling.</p>
                  </div>

                  <div className="q" data-key="price_too_low" data-required>
                    <label className="qlabel">And at what price would it feel too cheap to trust at scale?<span className="req">*</span></label>
                    <p className="hint">The classic "if it's that cheap, can it really be reliable?" line.</p>
                    <div className="opts grid">
                      {["Under $0.01 / 1K", "Under $0.05 / 1K", "Under $0.10 / 1K", "Price doesn't signal trust to me"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="price_too_low" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Pick one.</p>
                  </div>

                  <div className="q" data-key="addons">
                    <label className="qlabel">Which premium add-ons would you actually pay extra for?</label>
                    <div className="opts grid">
                      {["AI send-time optimization", "Vaultless tokenization / compliance suite", "Multi-region data residency", "Visual workflow / journey builder", "Priority support / custom SLA", "None — base platform is enough"].map(v => (
                        <label className="opt" key={v}>
                          <input type="checkbox" name="addons" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="q" data-key="early_access" data-required>
                    <label className="qlabel">Want early access &amp; a say in the roadmap?<span className="req">*</span></label>
                    <div className="opts">
                      {["Yes — count me in for early access", "Maybe — keep me posted", "No thanks — just sharing input"].map(v => (
                        <label className="opt" data-type="radio" key={v}>
                          <input type="radio" name="early_access" value={v} />
                          <span className="mark"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
                          <span className="otext">{v}</span>
                        </label>
                      ))}
                    </div>
                    <p className="err">Let us know.</p>
                  </div>

                  <div className="q" data-key="email">
                    <label className="qlabel">Email <span className="em" style={{ color: "var(--muted-2)", fontWeight: 400 }}>(only if you want us to reach out)</span></label>
                    <input type="email" name="email" placeholder="you@company.com" />
                    <p className="err">That doesn't look like an email.</p>
                  </div>

                  <div className="q" data-key="comments">
                    <label className="qlabel">Anything we're missing? The thing we should've asked?</label>
                    <textarea name="comments" placeholder="The one feature, dealbreaker, or war story on your mind…"></textarea>
                  </div>
                </div>

                <div className="nav">
                  <button 
                    type="button" 
                    className="btn-ghost" 
                    disabled={step === 1 || submitting} 
                    onClick={() => setStep(s => s - 1)}
                  >
                    ← Back
                  </button>
                  <button type="submit" className="btn-go" disabled={submitting}>
                    {submitting ? "Sending…" : (step === TOTAL_STEPS ? "Submit →" : "Continue →")}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="done show">
              <div className="ring">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="url(#g)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="24" y2="24">
                      <stop stopColor="#FF2E97" />
                      <stop offset="1" stopColor="#15E0E6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2>Signal received.</h2>
              <p>Thank you — that genuinely shapes what we build next. If you left an email, you'll hear from us before launch.</p>
            </div>
          )}
        </div>

        <footer>NEUPO · PROJECT CAMRY — built for the signals that can't drop</footer>
      </div>
    </>
  );
}
