const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function calculateStructure(wordCount: number) {
  // SEO standard: 1 H1, proportional H2/H3 based on word count
  let h2Count = 3;
  let h3Count = 4;

  if (wordCount >= 2500) { h2Count = 6; h3Count = 12; }
  else if (wordCount >= 1500) { h2Count = 5; h3Count = 10; }
  else if (wordCount >= 800) { h2Count = 5; h3Count = 8; }
  else if (wordCount >= 400) { h2Count = 4; h3Count = 6; }
  else { h2Count = 3; h3Count = 4; }

  return { h2Count, h3Count };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { contentType, subType, topic, wordCount, keywords, tone } = await req.json();

    if (!topic) {
      return new Response(JSON.stringify({ error: "Topic is required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    // For meta-title and meta-description, use Gemini if available, otherwise fallback
    if (subType === "meta-title") {
      let content = "";
      if (geminiApiKey) {
        const prompt = `Generate a single SEO-optimized meta title (max 60 characters) for a ${contentType} about "${topic}". ${keywords ? `Target keywords: ${keywords}.` : ""} Tone: ${tone}. Return ONLY the title text, no quotes, no explanation.`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 100 } }),
        });
        if (res.ok) {
          const data = await res.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        }
      }
      if (!content) {
        content = `${topic} | Complete Guide ${new Date().getFullYear()}`;
        if (contentType === "blog") content = `${topic} - Expert Tips & Insights | Blog`;
        if (content.length > 60) content = content.slice(0, 57) + "...";
      }
      return new Response(JSON.stringify({ content, topic, contentType, subType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subType === "meta-description") {
      let content = "";
      if (geminiApiKey) {
        const prompt = `Generate a single SEO-optimized meta description (120-160 characters) for a ${contentType} about "${topic}". ${keywords ? `Target keywords: ${keywords}.` : ""} Tone: ${tone}. Include a compelling call-to-action. Return ONLY the description text, no quotes, no explanation.`;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 200 } }),
        });
        if (res.ok) {
          const data = await res.json();
          content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        }
      }
      if (!content) {
        content = `Discover ${topic.toLowerCase()} with our comprehensive guide. Expert insights, practical tips, and actionable advice. ${keywords ? `Keywords: ${keywords}.` : ""} Read more now!`;
        if (content.length > 160) content = content.slice(0, 157) + "...";
      }
      return new Response(JSON.stringify({ content, topic, contentType, subType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Full content generation
    const targetWords = wordCount || 500;
    const { h2Count, h3Count } = calculateStructure(targetWords);

    if (geminiApiKey) {
      const kwLine = keywords ? `\n- Naturally incorporate these target keywords: ${keywords}` : "";
      const structureLine = `Structure: Exactly 1 H1 tag (the main title), ${h2Count} H2 subheadings, and ${h3Count} H3 sub-subheadings. Use markdown format with # for H1, ## for H2, ### for H3.`;
      const wordLine = `Write approximately ${targetWords} words of unique, original, non-repetitive content.`;
      const toneLine = `Tone: ${tone}.`;
      const uniqueness = `IMPORTANT: Every paragraph must be unique. Do not repeat phrases, sentences, or paragraphs. Each section must cover a distinct aspect of the topic.`;

      const prompt = `Write a complete, SEO-optimized ${contentType} about "${topic}".\n\n${structureLine}\n${wordLine}\n${toneLine}\n${uniqueness}${kwLine}\n\nFormat the output in markdown:\n- Start with a single # H1 heading (the title)\n- Write an engaging introduction paragraph after the H1\n- Use ## for H2 section headings\n- Use ### for H3 sub-section headings under relevant H2s\n- Include practical examples, actionable advice, and specific details\n- End with a conclusion section (## Conclusion)\n- Do NOT include any meta commentary, word count, or explanation outside the content itself\n- Output ONLY the markdown content`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.95,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 8192,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (content) {
          return new Response(JSON.stringify({ content, topic, contentType, subType }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Fallback: generate structured content without Gemini
    const kwLine = keywords ? `\n\nTarget keywords: ${keywords}` : "";
    const typeLabel = contentType === "blog" ? "Blog Post" : "Page";

    let content = `# ${topic}\n\n${topic} is an important topic that deserves careful consideration. Whether you're new to this subject or looking to deepen your knowledge, this ${typeLabel.toLowerCase()} will provide you with valuable insights and practical guidance.${kwLine}`;

    const sectionTopics = [
      { h2: "Introduction", h3s: ["Understanding the Basics", "Why This Matters", "Key Terminology"] },
      { h2: "Key Benefits", h3s: ["Primary Advantages", "Long-term Impact", "Real-world Applications"] },
      { h2: "Best Practices", h3s: ["Getting Started", "Common Strategies", "Advanced Techniques"] },
      { h2: "Common Mistakes to Avoid", h3s: ["Frequent Pitfalls", "How to Recover", "Prevention Tips"] },
      { h2: "Tips for Success", h3s: ["Expert Recommendations", "Tools and Resources", "Measuring Progress"] },
      { h2: "Conclusion", h3s: ["Key Takeaways", "Next Steps"] },
    ];

    const wordsPerSection = Math.floor(targetWords / (h2Count + 1));
    let usedSections = 0;

    for (let i = 0; i < h2Count && i < sectionTopics.length; i++) {
      const section = sectionTopics[i];
      content += `\n\n## ${section.h2}\n\n`;
      content += `When exploring ${topic.toLowerCase()}, the ${section.h2.toLowerCase()} section covers essential aspects that every practitioner should understand. This part of the ${typeLabel.toLowerCase()} delves into specific strategies and considerations that make a meaningful difference in your results.`;

      const h3sForThis = Math.min(h3Count, section.h3s.length);
      const h3PerSection = Math.ceil(h3Count / h2Count);
      for (let j = 0; j < Math.min(h3PerSection, h3sForThis); j++) {
        content += `\n\n### ${section.h3s[j]}\n\n`;
        content += `Understanding ${section.h3s[j].toLowerCase()} in the context of ${topic.toLowerCase()} requires attention to detail and a systematic approach. Consider how each element fits into the broader picture, and don't hesitate to experiment with different methods to find what works best for your specific situation. The most successful outcomes come from combining theoretical knowledge with hands-on practice.`;
        // Add more words if needed
        if (wordsPerSection > 80) {
          content += ` By focusing on quality, consistency, and continuous improvement, you can achieve remarkable results over time. Remember that progress is rarely linear, and setbacks are opportunities to learn and refine your approach.`;
        }
      }
      usedSections++;
    }

    // Add extra sections if we need more words
    while (content.split(/\s+/).length < targetWords && usedSections < 10) {
      content += `\n\n## Additional Insights ${usedSections > 5 ? `(${usedSections - 4})` : ""}\n\n`;
      content += `Another important dimension of ${topic.toLowerCase()} involves examining the interplay between different factors. Real-world examples and case studies demonstrate how theoretical principles translate into practical outcomes. Consider the unique circumstances of your situation and adapt these insights accordingly.`;
      content += `\n\n### Practical Applications\n\n`;
      content += `The practical applications of ${topic.toLowerCase()} span multiple contexts and use cases. From small-scale implementations to enterprise-level deployments, the core principles remain consistent while the execution details vary. Focus on understanding the fundamentals deeply, then adapt your approach to fit your specific requirements and constraints.`;
      usedSections++;
    }

    return new Response(JSON.stringify({ content, topic, contentType, subType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Something went wrong." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
