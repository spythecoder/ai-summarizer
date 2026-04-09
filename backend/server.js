const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 5000;
const frontendPath = path.join(__dirname, "../frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "condensr.html"));
});

function buildPrompt(text, tone, language) {
  return `
Tone: ${tone}
Language: ${language}

Summarize the following text accordingly:
${text}
`.trim();
}

function generateSummary(text, tone, language, mode, length) {
  const summaryText = buildSummaryText(text, tone, language, length);
  const safeSummaryText = escapeHtml(summaryText);

  let summaryBody = `<p>${safeSummaryText}</p>`;
  if (mode === "bullet_points") {
    summaryBody = `<ul>${summaryText.split(/(?<=[.!?])\s+/).filter(Boolean).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
  } else if (mode === "tldr") {
    const firstSentence = summaryText.split(/(?<=[.!?])\s+/).filter(Boolean)[0] || summaryText;
    summaryBody = `<p>${escapeHtml(firstSentence)}</p>`;
  }

  return [
    `<div class="summary ${escapeHtml(tone || "professional")}">`,
    summaryBody,
    "</div>"
  ].join("");
}

app.post("/summarize", (req, res) => {
  try {
    const { text, tone, language, mode, length } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    const normalizedTone = tone === "casual" ? "casual" : "professional";
    const normalizedLanguage = ["english", "hindi", "kannada"].includes(String(language).toLowerCase())
      ? String(language).toLowerCase()
      : "english";
    const normalizedMode = ["bullet_points", "short_paragraph", "tldr"].includes(String(mode))
      ? String(mode)
      : "short_paragraph";
    const normalizedLength = ["short", "medium", "detailed"].includes(String(length))
      ? String(length)
      : "medium";

    const pureSummaryText = buildSummaryText(text, normalizedTone, normalizedLanguage, normalizedLength);
    const summary = generateSummary(text, normalizedTone, normalizedLanguage, normalizedMode, normalizedLength);
    const originalWordCount = countWords(text);
    const summaryWordCount = countWords(pureSummaryText);

    res.json({
      summary,
      summaryText: pureSummaryText,
      originalWordCount,
      summaryWordCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/extract-url", async (req, res) => {
  try {
    const { url } = req.body;

    if (!isValidUrl(url)) {
      return res.status(400).json({ error: "Enter a valid URL" });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 Condensr/1.0",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    if (!response.ok) {
      return res.status(400).json({ error: "Unable to read the article from that URL" });
    }

    const html = await response.text();
    const text = extractReadableText(html);

    if (!text) {
      return res.status(400).json({ error: "Unable to read the article from that URL" });
    }

    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractReadableText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6)>/gi, "$& ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryText(text, tone, language, length) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]*/g) || [cleaned];
  const count = length === "short" ? 1 : length === "detailed" ? 4 : 2;
  const selected = sentences.map((sentence) => sentence.trim()).filter(Boolean).slice(0, count);
  return selected.join(" ").trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return 0;
  return normalized.split(/\s+/).length;
}
