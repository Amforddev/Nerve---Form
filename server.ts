import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";

const app = express();
app.use(express.json());
const PORT = 3000;

const CONFIG_PATH = path.join(process.cwd(), "form_config.json");

// Read config
app.get("/api/config", async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    res.json({ configured: false });
  }
});

// Create Google Form and save config
app.post("/api/setup-form", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const token = authHeader.split(" ")[1];

    // 1. Create the Form
    const createRes = await fetch("https://forms.googleapis.com/v1/forms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        info: {
          title: "Nerve Validations",
          documentTitle: "Nerve Form Responses",
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Failed to create form:", errText);
      return res.status(500).json({ error: "Failed to create Google Form" });
    }

    const formData = await createRes.json();
    const formId = formData.formId;
    const responderUri = formData.responderUri;

    // 2. Add Questions
    const questions = [
      { key: "role", title: "What's your role?", type: "RADIO", required: true, options: ["CEO / Founder", "CTO / VP Engineering", "Engineering / Dev Manager", "Software Engineer", "Product Manager", "Other"] },
      { key: "company_size", title: "How big is your engineering org?", type: "RADIO", required: true, options: ["1–10 engineers", "11–50 engineers", "51–200 engineers", "200+ engineers"] },
      { key: "regions", title: "Which regions do you send notifications to?", type: "CHECKBOX", required: false, options: ["Africa", "Latin America", "Southeast Asia", "India", "US / Canada", "Europe / UK"] },
      { key: "volume", title: "Roughly how many notifications do you send per month?", type: "RADIO", required: true, options: ["Under 100K", "100K – 1M", "1M – 50M", "50M+", "Not sending yet / planning to"] },
      { key: "channels", title: "Which channels do you use today?", type: "CHECKBOX", required: false, options: ["SMS", "WhatsApp", "Email", "Push (mobile/web)", "In-app", "Voice"] },
      { key: "problems", title: "Which of these actually bite you today?", type: "CHECKBOX", required: true, options: ["Maintaining separate provider integrations", "Throughput collapse under burst load", "Regulatory / DND compliance risk", "Overpaying on routing / no cost arbitrage", "Poor deliverability in emerging markets", "Notification fatigue / opt-outs", "No unified delivery analytics", "None of these are real problems for us"] },
      { key: "severity", title: "How much pain does notification infrastructure cause your team?", type: "SCALE", required: true, low: 1, high: 5, lowLabel: "Non-issue", highLabel: "Recurring fire" },
      { key: "cost", title: "Where does that pain show up as real cost?", type: "CHECKBOX", required: false, options: ["Engineering hours / maintenance", "Lost revenue from failed/late messages", "Overspend on message routing", "Compliance fines / legal exposure", "User churn from notification fatigue", "Doesn't really cost us much"] },
      { key: "current_stack", title: "What are you using today to solve this?", type: "TEXT", required: false, paragraph: false },
      { key: "likelihood", title: "If Nerve existed today, how likely would you be to try it?", type: "SCALE", required: true, low: 0, high: 10, lowLabel: "Not interested", highLabel: "Take my money" },
      { key: "top_features", title: "Which capabilities would actually move the needle for you?", type: "CHECKBOX", required: true, options: ["Single unified API across all channels", "Smart failover & cost-based routing", "1M RPS hyperscale ingestion", "Built-in compliance & DND checks", "AI send-time optimization & dedup", "Unified analytics & delivery tracking", "MCP / AI-agent developer integration"] },
      { key: "barriers", title: "What would stop you from adopting something like Nerve?", type: "CHECKBOX", required: false, options: ["Migration effort", "Vendor lock-in concern", "Trust / reliability of a new vendor", "Price", "Security / data privacy", "Nothing major — we'd try it"] },
      { key: "budget", title: "What monthly platform budget would this realistically sit in?", type: "RADIO", required: true, options: ["Free tier only", "Under $200 / mo", "$200 – $1,000 / mo", "$1,000 – $5,000 / mo", "$5,000+ / mo (enterprise)"] },
      { key: "price_too_high", title: "At what per-1,000-requests price would Nerve feel too expensive to justify?", type: "RADIO", required: true, options: ["Over $0.10 / 1K", "Over $0.50 / 1K", "Over $1 / 1K", "Over $5 / 1K"] },
      { key: "price_too_low", title: "And at what price would it feel too cheap to trust at scale?", type: "RADIO", required: true, options: ["Under $0.01 / 1K", "Under $0.05 / 1K", "Under $0.10 / 1K", "Price doesn't signal trust to me"] },
      { key: "addons", title: "Which premium add-ons would you actually pay extra for?", type: "CHECKBOX", required: false, options: ["AI send-time optimization", "Vaultless tokenization / compliance suite", "Multi-region data residency", "Visual workflow / journey builder", "Priority support / custom SLA", "None — base platform is enough"] },
      { key: "early_access", title: "Want early access & a say in the roadmap?", type: "RADIO", required: true, options: ["Yes — count me in for early access", "Maybe — keep me posted", "No thanks — just sharing input"] },
      { key: "email", title: "Email", type: "TEXT", required: false, paragraph: false },
      { key: "comments", title: "Anything we're missing? The thing we should've asked?", type: "TEXT", required: false, paragraph: true }
    ];

    const requests = questions.map((q, i) => {
      let questionDef: any = { required: q.required };
      if (q.type === "RADIO" || q.type === "CHECKBOX") {
        questionDef.choiceQuestion = {
          type: q.type,
          options: q.options!.map(v => ({ value: v }))
        };
      } else if (q.type === "TEXT") {
        questionDef.textQuestion = { paragraph: q.paragraph };
      } else if (q.type === "SCALE") {
        questionDef.scaleQuestion = { low: q.low, high: q.high, lowLabel: q.lowLabel, highLabel: q.highLabel };
      }

      return {
        createItem: {
          item: {
            title: q.title,
            questionItem: { question: questionDef }
          },
          location: { index: i }
        }
      };
    });

    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error("Failed to add questions:", errText);
      return res.status(500).json({ error: "Failed to add questions to form" });
    }

    // 3. Get the form again to extract questionIds
    const getRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const finalForm = await getRes.json();

    const entryMapping: Record<string, string> = {};
    if (finalForm.items) {
      for (let i = 0; i < questions.length; i++) {
        const item = finalForm.items.find((it: any) => it.title === questions[i].title);
        if (item && item.questionItem && item.questionItem.question) {
          const hexId = item.questionItem.question.questionId;
          const entryId = "entry." + parseInt(hexId, 16).toString();
          entryMapping[questions[i].key] = entryId;
        }
      }
    }

    // `formResponse` URL is the responderUri with `viewform` replaced by `formResponse`
    let actionUrl = responderUri.replace(/\/viewform.*/, "/formResponse");

    const configData = {
      configured: true,
      formId,
      actionUrl,
      entryMapping
    };

    await fs.writeFile(CONFIG_PATH, JSON.stringify(configData, null, 2));

    res.json(configData);
  } catch (err: any) {
    console.error("Error setting up form:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Submit proxy
app.post("/api/submit", async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_PATH, "utf-8");
    const config = JSON.parse(data);

    if (!config.configured) {
      return res.status(400).json({ error: "Form not configured" });
    }

    const formData = req.body; // Map of { [key]: value | value[] }
    const params = new URLSearchParams();

    for (const [key, val] of Object.entries(formData)) {
      const entryId = config.entryMapping[key];
      if (!entryId) continue;

      if (Array.isArray(val)) {
        val.forEach(v => {
          if (v) params.append(entryId, String(v));
        });
      } else {
        if (val !== undefined && val !== null && val !== "") {
          params.append(entryId, String(val));
        }
      }
    }

    const googleRes = await fetch(config.actionUrl, {
      method: "POST",
      body: params,
      // URL encoded
      headers: { "Content-Type": "application/x-www-form-urlencoded" }
    });

    if (!googleRes.ok) {
      const txt = await googleRes.text();
      console.error("Google Forms rejected submission:", txt);
      return res.status(500).json({ error: "Google Forms rejected the submission" });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Submit error:", err);
    res.status(500).json({ error: "Failed to submit" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
