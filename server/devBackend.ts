import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleSeoAudit } from "./auditRunner";

function parseJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey");
  res.end(JSON.stringify(body));
}

export function devBackendPlugin(): Plugin {
  return {
    name: "vite-plugin-dev-backend",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";

        if (!url.startsWith("/functions/v1/")) {
          return next();
        }

        // Handle CORS preflight
        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Client-Info, Apikey");
          return res.end();
        }

        const endpoint = url.replace("/functions/v1/", "");

        try {
          // 1. IP Lookup
          if (endpoint === "get-ip") {
            const rawIp =
              (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
              req.socket.remoteAddress ||
              "127.0.0.1";
            return sendJson(res, 200, { ip: rawIp.replace(/^::ffff:/, "") });
          }

          // 2. SEO Audit & Sitemap Crawl
          if (endpoint === "seo-audit") {
            const body = await parseJsonBody(req);
            if (!body.url) {
              return sendJson(res, 400, { error: "URL is required" });
            }
            const result = await handleSeoAudit(body);
            return sendJson(res, 200, result);
          }

          // 3. Plagiarism Checker
          if (endpoint === "plagiarism-check") {
            const body = await parseJsonBody(req);
            const text = (typeof body.text === "string" ? body.text : "").trim();

            if (!text || text.length < 50) {
              return sendJson(res, 400, { error: "Please provide at least 50 characters of text." });
            }

            const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 20);
            const commonPhrases = [
              "in today's world", "it is important to note", "at the end of the day",
              "in conclusion", "it is worth noting", "as a matter of fact",
              "needless to say", "in order to", "when it comes to",
              "the bottom line", "at the forefront of", "plays a crucial role",
              "it goes without saying", "on the other hand", "in other words",
              "last but not least", "first and foremost", "step by step",
              "in the realm of", "a wide range of",
            ];

            let commonPhraseCount = 0;
            const lowerText = text.toLowerCase();
            for (const phrase of commonPhrases) {
              if (lowerText.includes(phrase)) commonPhraseCount++;
            }

            const words = text.toLowerCase().split(/\s+/);
            const bigrams: string[] = [];
            for (let i = 0; i < words.length - 1; i++) {
              bigrams.push(words[i] + " " + words[i + 1]);
            }

            const bigramCounts = new Map<string, number>();
            for (const bg of bigrams) {
              bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1);
            }
            const repeatedBigrams = [...bigramCounts.values()].filter((c) => c > 1).length;

            const phrasePenalty = Math.min(commonPhraseCount * 5, 30);
            const repetitionPenalty = Math.min(Math.round((repeatedBigrams / Math.max(bigrams.length, 1)) * 100), 20);
            const baseSimilarity = Math.min(phrasePenalty + repetitionPenalty, 60);

            const matchedSources: { url: string; snippet: string; similarity: number }[] = [];
            if (baseSimilarity > 10) {
              const sampleSentences = sentences.slice(0, 3);
              for (const sentence of sampleSentences) {
                const sim = Math.floor(Math.random() * 30) + 10;
                matchedSources.push({
                  url: `https://example-source-${matchedSources.length + 1}.com/article`,
                  snippet: sentence.slice(0, 150) + (sentence.length > 150 ? "..." : ""),
                  similarity: sim,
                });
              }
            }

            const similarityScore = Math.min(baseSimilarity, 100);
            const uniqueScore = Math.max(0, 100 - similarityScore);

            return sendJson(res, 200, { similarityScore, uniqueScore, matchedSources });
          }

          // 4. Content Generation
          if (endpoint === "content-generate") {
            const body = await parseJsonBody(req);
            const { contentType, subType } = body;
            const topic = typeof body.topic === "string" ? body.topic.trim() : "";
            const keywords = typeof body.keywords === "string" ? body.keywords.trim() : "";

            if (!topic) {
              return sendJson(res, 400, { error: "Topic is required." });
            }

            let content = "";
            const year = new Date().getFullYear();

            if (subType === "meta-title") {
              content = `${topic} | Complete Guide ${year}`;
              if (contentType === "blog") content = `${topic} - Expert Tips & Insights | Blog`;
              if (content.length > 60) content = content.slice(0, 57) + "...";
            } else if (subType === "meta-description") {
              content = `Looking for insights on ${topic}? Discover expert recommendations, actionable strategies, and everything you need to know about ${keywords || topic} in this complete ${year} guide.`;
              if (content.length > 160) content = content.slice(0, 157) + "...";
            } else if (subType === "blog-outline") {
              content = `# Ultimate Guide to ${topic}\n\n## 1. Introduction\n- Overview of ${topic}\n- Why it matters today\n\n## 2. Key Concepts & Fundamentals\n- Core principles\n- Essential definitions\n\n## 3. Best Practices & Strategies\n- Proven tactics\n- Common pitfalls to avoid\n\n## 4. Practical Implementation\n- Step-by-step tutorial\n- Tools & resources\n\n## 5. Conclusion\n- Summary of key takeaways\n- Next steps\n`;
            } else {
              content = `# Comprehensive Guide to ${topic}\n\n${topic} has become increasingly critical in the modern digital landscape. Understanding its core components and implementing best practices allows organizations and creators to maximize their impact.\n\n## Why ${topic} Matters\nIn today's competitive environment, staying ahead requires a proactive approach. Focusing on key factors such as relevance, efficiency, and clarity will ensure sustainable success.\n\n## Strategic Recommendations\n- Conduct regular audits to identify growth opportunities.\n- Prioritize user experience and high-value content.\n- Keep track of key performance indicators over time.\n\n## Final Thoughts\nBy applying these strategies, you can optimize your results and maintain a strong competitive edge.\n`;
            }

            return sendJson(res, 200, { content, topic, contentType, subType });
          }

          // 5. Contact Form Submission
          if (endpoint === "contact-submit") {
            const body = await parseJsonBody(req);
            if (!body.name || !body.email || !body.message) {
              return sendJson(res, 400, { error: "Name, email, and message are required." });
            }
            return sendJson(res, 200, { success: true, message: "Message sent successfully." });
          }

          // 6. Password Reset
          if (endpoint === "password-reset") {
            const body = await parseJsonBody(req);
            if (!body.email) {
              return sendJson(res, 400, { error: "Email is required." });
            }
            return sendJson(res, 200, {
              success: true,
              message: "Password reset email sent. Check your inbox.",
            });
          }

          return sendJson(res, 404, { error: `Endpoint ${endpoint} not found` });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Internal Server Error";
          console.error(`[DevBackend Error] ${endpoint}:`, err);
          return sendJson(res, 500, { error: message });
        }
      });
    },
  };
}
