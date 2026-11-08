import { safeFetchWithSsrfCheck } from "../server/ssrfValidator.ts";
import { handleSeoAudit } from "../server/auditRunner.ts";

async function main() {
  const sites = [
    "https://example.com",
    "https://www.smileaustin.com",
    "https://www.cbac.com",
    "https://www.daylightdental.com",
    "https://trainwithmob.com",
  ];

  for (const s of sites) {
    console.log("\n=======================================================");
    console.log("TRUTH TABLE AUDIT FOR:", s);
    console.log("=======================================================");
    const { response } = await safeFetchWithSsrfCheck(s);
    const rawHtml = await response.text();

    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const h1Matches = Array.from(rawHtml.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)).map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim()
    );
    const metaDescMatch =
      rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ||
      rawHtml.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
    const canonicalMatch =
      rawHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i) ||
      rawHtml.match(/<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["']/i);
    const schemaMatches = Array.from(
      rawHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    );

    const res = await handleSeoAudit({ url: s, mode: "single" });

    console.log("1. TITLE TAG:");
    console.log("   Raw HTML:   ", titleMatch ? titleMatch[0].trim() : "(none)");
    console.log("   TD Parsed:  ", res.title || "(none)");

    console.log("2. H1 HEADING TAGS:");
    console.log("   Raw HTML:   ", h1Matches.length > 0 ? JSON.stringify(h1Matches) : "(none)");
    console.log(
      "   TD Parsed:  ",
      JSON.stringify(res.headings?.filter((h) => h.level === 1).map((h) => h.text))
    );

    console.log("3. META DESCRIPTION:");
    console.log("   Raw HTML:   ", metaDescMatch ? metaDescMatch[0].slice(0, 110) + "..." : "(none)");
    console.log("   TD Parsed:  ", res.description ? res.description.slice(0, 110) + "..." : "(none)");

    console.log("4. CANONICAL LINK:");
    console.log("   Raw HTML:   ", canonicalMatch ? canonicalMatch[0] : "(none)");
    console.log("   TD Parsed:  ", res.canonicalUrl || "(none)");

    console.log("5. JSON-LD SCHEMAS:");
    console.log("   Raw <script> tags count:", schemaMatches.length);
    console.log("   TD Parsed Types:", res.schema?.map((sc) => sc.type));
  }
}

main().catch(console.error);
