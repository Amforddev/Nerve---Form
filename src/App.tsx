import React, { useState, useEffect, FormEvent } from "react";
import confetti from "canvas-confetti";
import { googleSignIn } from "./firebase";
import { Loader2 } from "lucide-react";

export default function App() {
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [pulse, setPulse] = useState(false);
  const TOTAL_STEPS = 4;
  const STEP_NAMES = ["You & your stack", "The problem", "The solution", "Pricing & you"];

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
      .then((res) => res.json())
      .then((data) => {
        if (data.configured) setConfig(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingConfig(false));
  }, []);

  const handleSetup = async () => {
    setSetupLoading(true);
    setSetupError("");
    try {
      const authRes = await googleSignIn();
      if (!authRes) throw new Error("Failed to sign in");

      const res = await fetch("/api/setup-form", {
        method: "POST",
        headers: { Authorization: `Bearer ${authRes.accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to setup form");

      setConfig(data);
    } catch (err: any) {
      setSetupError(err.message || "An error occurred");
    } finally {
      setSetupLoading(false);
    }
  };

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

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to submit");
      setDone(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ff2e97', '#15e0e6', '#ffffff']
      });
    } catch (err) {
      console.error(err);
      alert("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!loadingConfig && !config) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold mb-4 font-[Space Grotesk]">Admin Setup</h1>
        <p className="text-muted mb-8 max-w-md">
          The Nerve Google Form needs to be created in your Google Drive. 
          Sign in with your Google account to automatically provision the form and link it to this app.
        </p>
        
        <button
          onClick={handleSetup}
          disabled={setupLoading}
          className="flex items-center gap-3 bg-white text-black px-6 py-3 rounded-full font-medium hover:bg-gray-100 transition shadow-lg disabled:opacity-50"
        >
          {setupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
          )}
          Sign in with Google
        </button>
        {setupError && <p className="text-sig-magenta mt-4">{setupError}</p>}
      </div>
    );
  }

  return (
    <>
      <div className="field-bg"></div>
      <div className="wrap">
        <header>
          <div className="badge">Project Camry · Notification-as-a-Service</div>
          <h1>One nerve for<br /><span className="grad">every signal you send</span></h1>
          <p className="sub">Nerve is a single API that routes notifications across SMS, WhatsApp, push and email — built to ingest a million requests a second and survive the markets where everyone else drops the packet.</p>
          <div className="signal-line"></div>
        </header>

        <section className="story">
          <div className="card problem">
            <p className="eyebrow">▲ The friction</p>
            <h3>A provider degrades at 2am —<br/>and you hear it from users, not<br/>your dashboards</h3>
            <p>The worst night in notification infra: a provider silently fails in one region. OTPs stop landing. Nothing in your monitoring fires — because every provider reports delivery in its own format — so you find out from a pile of "I never got my code" tickets.</p>
            <div className="scenario">
              <p className="tag">▸ The 2am page</p>
              <p>Logins are failing across a whole country.<br/>Your provider's status page is green,<br/>your delivery-report parser quietly<br/>swallowed the error, and there's no<br/>automatic fallback to a second provider.<br/>So an engineer wakes up, reroutes traffic<br/>by hand, and writes the post-mortem —<br/>while signups churn in real time.</p>
            </div>
            <ul>
              <li>No automatic failover — someone gets<br/>paged to reroute by hand</li>
              <li>Every provider's delivery report is a<br/>different schema you parse, then re-parse<br/>when they change it</li>
              <li>One burst — a flash sale, a breaking alert<br/>— locks your synchronous send path</li>
              <li>The idempotency you rolled yourself still<br/>double-fires OTPs during retry storms</li>
              <li>"Did this user actually get the message?"<br/>takes four dashboards to answer</li>
            </ul>
            <div className="stats">
              <div className="stat"><div className="num">4-6</div><div className="lbl">provider SDKs<br/>one team<br/>stitches together<br/>and maintains by<br/>hand</div></div>
              <div className="stat"><div className="num">0 alerts</div><div className="lbl">fire before your<br/>users do when a<br/>provider silently<br/>degrades</div></div>
              <div className="stat"><div className="num">hours</div><div className="lbl">to trace a single<br/>failed message<br/>across separate<br/>dashboards</div></div>
            </div>
            <p className="impact"><b>What it means for you:</b> your most senior<br/>engineers are permanently on-call for<br/>plumbing, and your worst outages land<br/>on the exact flows that gate revenue —<br/>login, checkout, OTP — while you debug<br/>them blind.</p>
          </div>
          <div className="card solution">
            <p className="eyebrow">◆ The signal</p>
            <h3>The plumbing fails over before<br/>you ever get paged</h3>
            <p>Nerve sits in front of every provider, watches delivery in real time, and reroutes automatically — so the 2am page never gets sent and you get one honest answer to "did it deliver?"</p>
            <ul>
              <li>Automatic failover — provider returns 5xx,<br/>the next one in line takes the send</li>
              <li>One normalized delivery stream across<br/>every provider, in real time</li>
              <li>Exactly-once API — idempotency keys<br/>absorb retry storms, no double OTPs</li>
              <li>1M RPS ingestion on a cell-based<br/>backbone — async by default, no locked<br/>send path</li>
              <li>Pre-flight DND checks + AI send-time<br/>optimization, built in</li>
            </ul>
            <div className="stats">
              <div className="stat"><div className="num">1M/sec</div><div className="lbl">requests<br/>ingested with<br/>zero data loss</div></div>
              <div className="stat"><div className="num">99.99%</div><div className="lbl">uptime, backed<br/>by an SLA</div></div>
              <div className="stat"><div className="num">99.5%+</div><div className="lbl">transactional<br/>messages<br/>delivered</div></div>
            </div>
            <p className="impact"><b>What it means for you:</b> your senior<br/>engineers ship product instead of<br/>babysitting providers, the revenue-<br/>critical flows stay up when traffic spikes,<br/>and "did it deliver?" is one dashboard —<br/>not a 2am investigation.</p>
          </div>
        </section>

        <p className="statnote">Friction figures are illustrative of what teams typically run into; signal figures are Nerve's engineering targets.</p>

        <div className="leadin">
          <p>We're building Nerve now — and we want to build it around <span className="k">your</span> reality, not a slide deck. Five minutes of honest answers shapes what ships first. <span className="k">No sales follow-up unless you ask for it.</span></p>
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
                    <label className="qlabel">If Nerve existed today, how likely would you be to try it?<span className="req">*</span></label>
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
                    <label className="qlabel">What would stop you from adopting something like Nerve?</label>
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
                    <label className="qlabel">At what per-1,000-requests price would Nerve feel too expensive to justify?<span className="req">*</span></label>
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

        <footer>NERVE · PROJECT CAMRY — built for the signals that can't drop</footer>
      </div>
    </>
  );
}
