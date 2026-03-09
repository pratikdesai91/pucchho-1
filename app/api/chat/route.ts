/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import clientPromise from "@/lib/mongodb";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ObjectId } from "mongodb";
import axios from "axios";
import { chromium } from "playwright";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: {
    title: string;
    link: string;
    snippet: string;
  }[];
};

type ChatDocument = {
  _id?: ObjectId;
  chatId: string;
  userEmail: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
};

type FileChunk = {
  _id: ObjectId;
  chatId: string;
  userEmail: string;
  filename: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
  createdAt: Date;
};

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function googleImageSearch(query: string) {
  try {
    const res = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: process.env.GOOGLE_CSE_KEY,
        cx: process.env.GOOGLE_CSE_CX,
        q: query,
        searchType: "image",
        num: 3,
        imgSize: "large",
        safe: "active",
      },
    });

    return (res.data.items || []).map((item: any) => ({
      link: item.link,
      title: item.title,
    }));
  } catch (error) {
    console.error("Image Search Error:", error);
    return [];
  }
}

function detectIntent(input: string) {
  if (
    /node|express|nextjs|tailwind|css|html|sql|database|backend|frontend|code|javascript|react|bug|error|api|function|typescript/i.test(
      input,
    )
  ) {
    return "coding";
  }

  if (
    /write|article|blog|seo|linkedin post|essay|tell me about|who is|history of/i.test(
      input,
    )
  ) {
    return "article";
  }

  if (/story|fiction|fantasy|poem|novel/i.test(input)) {
    return "story";
  }

  if (/explain|what is|how does|why/i.test(input)) {
    return "explanation";
  }

  return "general";
}

function buildSystemPrompt(type: string, firstName: string) {
  switch (type) {
    case "coding":
      return `

  The user's first name is ${firstName}.

IMPORTANT:
- Address the user as ${firstName} when greeting them.
- Never introduce yourself as ${firstName}.

Communication Style:

- Use emojis where helpful (💡 🚀 ⚠️ ✅ 🧠).
- Use section dividers with five dashes:

-----

- Use **Markdown headings** for important sections.

Formatting guidelines:

## Major sections (H2)
Use for important sections like:
- Problem
- Solution
- Updated Code
- Explanation

### Sub sections (H3)
Use for smaller explanations or tips.

Example style:

## 🔍 Problem
Explain the issue.

-----

## ✅ Solution
Explain the fix.

-----

## 💻 Code

\`\`\`ts
code here
\`\`\`

-----

### 💡 Tip
Helpful suggestion.

Use headings naturally when they improve readability.
Do NOT force headings in every response.`;

    case "article":
      return `

The user's first name is ${firstName}.

IMPORTANT:
- The user is named ${firstName}.
- You are NOT ${firstName}.
- Address the user as ${firstName} when greeting them.
- Never introduce yourself as ${firstName}.
You are a professional content writer.
use emoji and Medium size and semi bold font for subheaders.
Write engaging, modern, readable content.
create tables if needed or compare.
Avoid textbook tone. choose proper format (list, sections with headers, etc) based on context. chat with human behave, try to understand user emotion and reply with same emosion. use emojis for for attractive readable. use --- for all sections.
`;

    default:
      return `The user's first name is ${firstName}.

IMPORTANT:
- The user is named ${firstName}.
- You are NOT ${firstName}.
- Address the user as ${firstName} when greeting them.
- Never introduce yourself as ${firstName}. chat with human behave, try to understand user emotion and reply with same emosion. use emojis for attractive read. use --- for all sections. Bold important points.
use emoji and Medium size and semi bold font for subheaders.
create tables if needed or compare.`;
  }
}

async function googleWebSearch(query: string) {
  try {
    const res = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: process.env.GOOGLE_CSE_KEY,
        cx: process.env.GOOGLE_CSE_CX,
        q: query,
        num: 5,
      },
    });

    const items = res.data.items || [];

    return items.map((item: any) => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    }));
  } catch (error) {
    console.error("Google Search Error:", error);
    return [];
  }
}

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

async function fetchWebsiteContent(
  url: string,
  intent?: { wantsContact?: boolean; wantsAbout?: boolean },
) {
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Extract raw href values
    const links = await page.$$eval("a", (as) =>
      as.map((a) => a.getAttribute("href")).filter(Boolean),
    );

    const base = new URL(url);

    // Convert relative links to absolute
    const absoluteLinks = links
      .map((link) => {
        if (!link) return null;
        try {
          return new URL(link, base).href;
        } catch {
          return null;
        }
      })
      .filter((link): link is string => Boolean(link));

    console.log("Total links found:", absoluteLinks.length);

    // Keep only internal links
    const internalLinks = [...new Set(absoluteLinks)].filter((link) => {
      try {
        const u = new URL(link);

        return (
          u.hostname === base.hostname &&
          u.pathname !== "/" &&
          !u.pathname.includes("#")
        );
      } catch {
        return false;
      }
    });

    console.log("Internal links:", internalLinks);
    let subPages = internalLinks;

    // prioritize contact page
    if (intent?.wantsContact) {
      subPages = internalLinks.filter(
        (link) =>
          link.includes("contact") ||
          link.includes("support") ||
          link.includes("help"),
      );
    }

    // prioritize about page
    if (intent?.wantsAbout) {
      subPages = internalLinks.filter((link) => link.includes("about"));
    }

    // fallback
    if (subPages.length === 0) {
      subPages = internalLinks.slice(0, 3);
    }

    subPages = subPages.slice(0, 3);

    console.log("Subpages to crawl:", subPages);

    let subPageContent = "";

    for (const link of subPages) {
      try {
        console.log("Crawling subpage:", link);
        const subPage = await browser.newPage();

        await subPage.goto(link, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });

        const text = await subPage.evaluate(() => document.body.innerText);

        // extract emails
        const emails =
          text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];

        // extract phone numbers
        const phones =
          text.match(
            /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
          ) || [];

        console.log("Emails found:", emails);
        console.log("Phones found:", phones);

        subPageContent += `
--- SUBPAGE: ${link} ---
${text.slice(0, 3000)}

Emails Found: ${emails.join(", ") || "None"}
Phones Found: ${phones.join(", ") || "None"}
`;

        subPageContent += `
--- SUBPAGE: ${link} ---
${text.slice(0, 3000)}
`;

        await subPage.close();
      } catch (err) {
        console.log("Subpage fetch failed:", link);
      }
    }

    // Extract visible text from real DOM
    let content = await page.evaluate(() => document.body.innerText);

    const html = await page.content();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (content.length < 2000 && article?.textContent) {
      content = article.textContent;
    }

    console.log("Homepage length:", content.length);
    console.log("Subpage content length:", subPageContent.length);

    const mainContent = content.replace(/\s+/g, " ").trim().slice(0, 10000);

    return `
--- MAIN PAGE ---
${mainContent}

${subPageContent}
`;
  } catch (err) {
    console.error("Website fetch error:", err);
    return "";
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export async function POST(req: Request) {
  try {
    const { messages, chatId, userEmail, webMode, forceWeb } = await req.json();
    const session = await getServerSession();
    const firstName = session?.user?.name?.split(" ")[0] || "there";
    const mongo = await clientPromise;
    const db = mongo.db("chats");

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content || "";

    const wantsContact = /contact|email|phone|address|support/i.test(
      lastUserMessage,
    );

    const wantsAbout = /about|company|who are you|who is/i.test(
      lastUserMessage,
    );

    // Detect URL in user message
    const urlMatches = lastUserMessage.match(/https?:\/\/[^\s]+/g) || [];

    let websiteContext = "";

    if (urlMatches.length > 0) {
      const contents = await Promise.all(
        urlMatches.map((url: string) =>
          fetchWebsiteContent(url, {
            wantsContact,
            wantsAbout,
          }),
        ),
      );

      websiteContext = contents
        .map((content, i) => `Website ${i + 1}:\n${content}`)
        .join("\n\n");
    }
    // 🔍 Decide if web search is needed (Smart Judge)

    const judge = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a web search decision engine.

Use web search when:
- The question is about a real person
- The question is about a real place or monument
- The question is about companies or organizations
- The question may require up-to-date or factual accuracy
- The question includes "who is", "what is", "latest", "current", "price", "today"

Do NOT use web search for:
- Fictional stories
- Coding help
- General explanations
- Purely conceptual topics

Return JSON:
{
  "needsSearch": boolean,
  "reason": string,
  "searchQuery": string,
  "confidence": number
}
`,
        },
        { role: "user", content: lastUserMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    // ✅ Safe parsing
    const judgeContent = judge.choices[0]?.message?.content || "{}";

    const judgeResult: {
      needsSearch?: boolean;
      searchQuery?: string;
      confidence?: number;
    } = JSON.parse(judgeContent);

    // ✅ Final decision
    let needsWebSearch = false;

    const factPattern =
      /tell me about|who is|who was|information about|info about|biography of|bio of/i.test(
        lastUserMessage,
      );

    if (urlMatches.length > 0 && !forceWeb) {
      needsWebSearch = false;
    } else if (forceWeb) {
      needsWebSearch = true;
    } else if (webMode === "on") {
      needsWebSearch = true;
    } else if (webMode === "off") {
      needsWebSearch = false;
    } else {
      needsWebSearch =
        judgeResult.needsSearch === true &&
        (judgeResult.confidence ?? 0) > 0.75;
    }

    const entityPattern =
      /who is|what is|where is|tell me about|about|history of|biography of/i.test(
        lastUserMessage,
      );

    let imageResults: any[] = [];

    if (needsWebSearch && entityPattern) {
      imageResults = await googleImageSearch(
        judgeResult.searchQuery || lastUserMessage,
      );
    }

    // 🔹 Intent Classification
    const classification = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Classify this into: coding, article, story, explanation, general. Only return the label.",
        },
        {
          role: "user",
          content: lastUserMessage,
        },
      ],
      temperature: 0,
    });

    if ((needsWebSearch && entityPattern) || forceWeb) {
      imageResults = await googleImageSearch(
        judgeResult.searchQuery || lastUserMessage,
      );
    }

    const intent =
      classification.choices[0]?.message?.content?.trim().toLowerCase() ||
      "general";

    let fileContext = "";

    let webResults: any[] = [];
    let webContext = "";

    if (needsWebSearch) {
      webResults = await googleWebSearch(
        judgeResult.searchQuery || lastUserMessage,
      );

      webContext = webResults
        .map(
          (item, i) =>
            `${i + 1}. ${item.title}\n${item.snippet}\nSource: ${item.link}`,
        )
        .join("\n\n");
    }

    console.log("NEEDS SEARCH:", needsWebSearch);
    console.log("WEB CONTEXT:", webContext);

    if (chatId && userEmail) {
      const questionEmbedding = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: lastUserMessage,
      });

      const questionVector = questionEmbedding.data[0].embedding;

      const allChunks = await db
        .collection<FileChunk>("fileChunks")
        .find({ chatId, userEmail })
        .toArray();

      function cosineSimilarity(a: number[], b: number[]) {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (normA * normB);
      }

      const scored: (FileChunk & { score: number })[] = allChunks.map(
        (chunk) => ({
          ...chunk,
          score: cosineSimilarity(questionVector, chunk.embedding),
        }),
      );

      const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);

      fileContext = topChunks.map((c) => c.text).join("\n\n");
    }

    const systemPrompt = buildSystemPrompt(intent, firstName);

    const enhancedMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },

      ...(websiteContext
        ? [
            {
              role: "system",
              content: `
The user provided a website URL.

You MUST analyze the website content and pages below to answer the user.

Rules:
- The text below is the real content of the webpage.
- Treat it as if you opened the page yourself.
- Use this content as the PRIMARY source of information.
- Do NOT say you cannot browse the internet.
- If emails or phone numbers are present in the content, list them clearly in the answer.

WEBSITE CONTENT:
${websiteContext}

Instructions:
If the user asks for contact details, look for phone numbers, emails, or addresses in the website content.
If the user asks about the company, prioritize About or company information.`,
            },
          ]
        : []),

      ...(webContext
        ? [
            {
              role: "system",
              content: `
You MUST use the following live web search results to answer.

Do NOT say you don't have real-time data.
Do NOT mention training cutoff.
Use the web results if relevant.
If results are insufficient, combine with your knowledge.
Always cite when using web information.

WEB RESULTS:
${webContext}

When using web info, mention the source naturally.
`,
            },
          ]
        : []),

      ...(fileContext
        ? [
            {
              role: "system",
              content: `
Use the following retrieved knowledge if relevant.
If not relevant, ignore it.

Retrieved Context:
${fileContext}
`,
            },
          ]
        : []),

      ...messages,
    ];

    // 🔹 session

    const GUEST_LIMIT = 5;

    // ----------------------
    // SERVER USAGE
    // ----------------------
    let usage = 0;

    if (session?.user?.email) {
      const mongo = await clientPromise;
      const db = mongo.db("chats");

      const user = await db.collection("users").findOne({
        email: session.user.email,
      });

      const now = new Date();
      const lastReset = new Date(user?.lastResetAt || 0);

      // compare calendar date (not time)
      const isNewDay =
        now.getFullYear() !== lastReset.getFullYear() ||
        now.getMonth() !== lastReset.getMonth() ||
        now.getDate() !== lastReset.getDate();

      if (!user?.lastResetAt || isNewDay) {
        await db.collection("users").updateOne(
          { email: session.user.email },
          {
            $set: {
              dailyMessages: 0,
              lastResetAt: now,
            },
          },
        );

        usage = 0;
      } else {
        usage = user?.dailyMessages || 0;
      }
    }

    if (!session && messages.length >= GUEST_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "LOGIN_REQUIRED",
          message: "Please login to continue chatting.",
        }),
        { status: 403 },
      );
    }

    // ----------------------
    // HARD LIMIT BLOCK
    // ----------------------
    const HARD_LIMIT = 300;

    if (session && usage >= HARD_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "LIMIT_REACHED",
          message:
            "You’ve hit your limit. Please wait for reset your daily limit, or upgrade your plan to continue.",
        }),
        { status: 403 },
      );
    }

    // ----------------------
    // MODEL DECISION (SERVER)
    // ----------------------
    const MODEL_SWITCH_LIMIT = 500;

    const safeModel = !session
      ? "gpt-4o-mini"
      : usage >= MODEL_SWITCH_LIMIT
        ? "gpt-5-nano"
        : "gpt-4o-mini";

    const showUpgrade =
      !!session &&
      usage >= MODEL_SWITCH_LIMIT &&
      (usage - MODEL_SWITCH_LIMIT) % 2 === 0;

    console.log("Using model:", safeModel);

    // 🔹 OpenAI call

    const stream = await client.chat.completions.create({
      model: safeModel,
      messages: enhancedMessages,
      temperature: intent === "coding" ? 0.4 : 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";

        if (imageResults.length > 0) {
          controller.enqueue(
            encoder.encode(
              `__IMAGES__${JSON.stringify(imageResults)}__END_IMAGES__`,
            ),
          );
        }

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content || "";
          fullText += text;
          controller.enqueue(encoder.encode(text));
        }

        if (webResults.length > 0) {
          controller.enqueue(
            encoder.encode(
              `\n__SOURCES__${JSON.stringify(webResults)}__END_SOURCES__`,
            ),
          );
        }

        if (imageResults.length > 0) {
          controller.enqueue(
            encoder.encode(
              `\n__IMAGES__${JSON.stringify(imageResults)}__END_IMAGES__`,
            ),
          );
        }

        controller.close();

        // AFTER STREAM ENDS — SAVE MESSAGE

        if (chatId && userEmail) {
          await db.collection<ChatDocument>("chats").updateOne(
            { chatId, userEmail },
            {
              $push: {
                messages: {
                  role: "assistant",
                  content: fullText,
                  sources: webResults.length > 0 ? webResults : undefined,
                },
              },
            },
          );
        }
      },
    });

    // 🔹 increment usage
    if (session?.user?.email) {
      const mongo = await clientPromise;
      const db = mongo.db("chats");

      await db
        .collection("users")
        .updateOne(
          { email: session.user.email },
          { $inc: { dailyMessages: 1 } },
        );
    }

    const canReact = !!session;
    const canRetry = !!session;
    const canShare = !!session;

    return new Response(readable, {
      headers: {
        "x-model-used": safeModel,
        "x-usage": String(usage),
        "x-show-upgrade": String(showUpgrade),
        "x-intent": needsWebSearch ? "web" : intent,
        "x-can-react": String(canReact),
        "x-can-retry": String(canRetry),
        "x-can-share": String(canShare),
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Server error", { status: 500 });
  }
}
