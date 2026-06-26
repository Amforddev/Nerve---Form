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
    // Attempt to read from file first for local development updates
    try {
      const data = await fs.readFile(CONFIG_PATH, "utf-8");
      res.json(JSON.parse(data));
    } catch {
      // Fallback to static import for deployed environments
      const staticConfig = await import("./form_config.json");
      res.json(staticConfig.default || staticConfig);
    }
  } catch (err) {
    res.json({ configured: false });
  }
});

// Submit proxy
app.post("/api/submit", async (req, res) => {
  try {
    let config;
    try {
      const data = await fs.readFile(CONFIG_PATH, "utf-8");
      config = JSON.parse(data);
    } catch {
      const staticConfig = await import("./form_config.json");
      config = staticConfig.default || staticConfig;
    }

    if (!config || !config.configured) {
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
      return res.status(500).json({ error: `Google Forms Error: ${googleRes.status} - ${txt.substring(0, 200)}` });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Submit error:", err);
    res.status(500).json({ error: "Failed to submit: " + err.message });
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
