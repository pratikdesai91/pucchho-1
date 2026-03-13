/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import clientPromise from "../../../lib/mongodb";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ObjectId } from "mongodb";
import axios from "axios";
import * as cheerio from "cheerio";

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

function buildSystemPrompt(type: string, firstName: string) {
  switch (type) {
  case "coding":
  return `
The user's first name is ${firstName}.

IMPORTANT
- Address the user as ${firstName} when greeting them (when appropriate).
- Never introduce yourself as ${firstName}.
- Highlight important words using **bold markdown**.
- Example: **Important concept**, **Key step**, **Warning**, **Tip**.
- Use bold for:
  • key terms
  • important instructions
  • warnings
  • conclusions

1. First acknowledge the user's request in 1–2 natural sentences.
2. Mention what you saw in the uploaded file if a file exists.
3. Explain the issue briefly.
4. THEN show the code if necessary.

  note: When showing numbered steps ALWAYS format them like:

## 1. Step title
## 2. Step title
## 3. Step title

You are a senior software engineer helping with programming.

Your responses should adapt to the user's request.

Do NOT always follow the same structure.
Only use sections when they improve clarity.

-----

🧠 First understand the user's intent.

Common situations include:

1️⃣ NEW_CODE  
User asks to create or generate code.

2️⃣ CODE_REVIEW  
User provides code and asks to review or improve it.

3️⃣ CODE_PLACEMENT  
User asks where to paste or integrate code.

4️⃣ BUG_FIX  
User asks to fix an error or broken code.

5️⃣ EXPLANATION  
User asks how something works.

Choose the best response style for the situation.

Do NOT mention these categories in the response.

-----

At the end of your answer, suggest 2–3 helpful next questions the user might ask.

-----

🎯 Suggested response styles (use only when helpful):

NEW_CODE example sections:

## 🚀 Overview
Short explanation of what the code does.

-----

## 💻 Code
Provide working code.

-----

## 🧠 How it works
Explain briefly with bullet points.

-----

### 💡 Tip
Optional improvement.

-----

ask for next helpfull question with options.

-----

Ask for next steps with 

CODE_REVIEW example sections:

## 🔍 Code Review
Explain what the code does.

-----

## ⚠️ Issues Found
Problems or improvements.

-----

## ✅ Improved Version
Provide corrected code.

-----

CODE_PLACEMENT example sections:

Start with a short explanation of where the code belongs.

-----

ask for next helpfull question with options.

-----

## 📍 Where To Add This Code
Explain the correct file or location.

-----

## 1️⃣ Find This Part In Your File
Show the existing code snippet.

-----

## 2️⃣ Replace It With This
Provide updated code.

-----

If useful:

## 3️⃣ Final Result
Show the final code block.

-----

### 💡 Tip
Optional suggestion.

-----

ask for next helpfull question with options.

-----

BUG_FIX example sections:

## 🔍 Problem
Explain the bug.

-----

## ✅ Fix
Explain the solution.

-----

## 💻 Updated Code
Provide the corrected code.

-----

EXPLANATION example sections:

## 🧠 Concept
Explain the idea.

-----

## 💻 Example
Provide code example.

-----

ask for next helpfull question with options.

-----

Formatting guidelines:

- Use emojis when helpful (🚀 💡 ⚠️ 🧠).
- Always produce valid markdown.
- Leave a blank line before lists.
- Use headings when useful.
- Avoid unnecessary sections.
- Only show code that matters.
- Avoid repeating the same structure every response.
- Respond naturally like an experienced engineer helping a teammate.
`;

    case "article":
      return `

The user's first name is ${firstName}.

IMPORTANT:
- The user is named ${firstName}.
- You are NOT ${firstName}.
- Address the user as ${firstName} when greeting them.
- Never introduce yourself as ${firstName}.
- Highlight important words using **bold markdown**.
- Example: **Important concept**, **Key step**, **Warning**, **Tip**.
- Use bold for:
  • key terms
  • important instructions
  • warnings
  • conclusions

  note: When showing numbered steps ALWAYS format them like:

## 1. Step title
## 2. Step title
## 3. Step title

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
- Never introduce yourself as ${firstName}. 
- Highlight important words using **bold markdown**.
- Example: **Important concept**, **Key step**, **Warning**, **Tip**.
- Use bold for:
  • key terms
  • important instructions
  • warnings
  • conclusions

  note: When showing numbered steps ALWAYS format them like:

## 1. Step title
## 2. Step title
## 3. Step title

chat with human behave, try to understand user emotion and reply with same emosion. use emojis for attractive read. use --- for all sections. Bold important points.
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
      snippet: item.snippet.slice(0, 300),
      link: item.link,
    }));
  } catch (error) {
    console.error("Google Search Error:", error);
    return [];
  }
}

async function fetchWebsiteContent(url: string) {
  try {
    const { data } = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    const $ = cheerio.load(data);

    const text = $("body").text();

    return text
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

  } catch (error) {
    console.error("Website fetch error:", error);
    return "";
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

  
    // Detect URL in user message
    const urlMatches = lastUserMessage.match(/https?:\/\/[^\s]+/g) || [];

    let websiteContext = "";

    if (urlMatches.length > 0) {
      const contents = await Promise.all(
        urlMatches.map((url: string) => fetchWebsiteContent(url))
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

    let judgeResult: any = {};

try {
  judgeResult = JSON.parse(judgeContent);
} catch {
  judgeResult = {
    needsSearch: false,
    confidence: 0,
    searchQuery: lastUserMessage,
  };
}

    // ✅ Final decision
    let needsWebSearch = false;

    
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
            "Classify this into: coding, article, story, explanation, file, general. Only return the label.",
        },
        {
          role: "user",
          content: lastUserMessage,
        },
      ],
      temperature: 0,
    });

    let intent =
      classification.choices[0]?.message?.content?.trim().toLowerCase() ||
      "general";

      if (
  lastUserMessage.toLowerCase().includes("file") ||
  lastUserMessage.toLowerCase().includes("attached") ||
  lastUserMessage.toLowerCase().includes("document") ||
  lastUserMessage.toLowerCase().includes("pdf")
) {
  intent = "file";
}

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

        console.log("FILE CHUNKS FOUND:", allChunks.length);

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

      // Get best matching chunks
const topChunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);

fileContext = topChunks.map((c) => c.text).join("\n\n");

// If files exist in this chat, always attach more context
if (allChunks.length > 0) {
  const moreChunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);

  fileContext = moreChunks
    .map((c) => `File: ${c.filename}\n${c.text}`)
    .join("\n\n");
}

// If user explicitly asks about file, include more context
if (
  lastUserMessage.toLowerCase().includes("file") ||
  lastUserMessage.toLowerCase().includes("attached")
) {
  const moreChunks = scored.sort((a, b) => b.score - a.score).slice(0, 5);
  fileContext = moreChunks.map((c) => c.text).join("\n\n");
}
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
The user uploaded a file.

You MUST answer using the uploaded file content.

Rules:
- If the user asks about the file, ONLY use the file content.
- Do not invent information not present in the file.
- If the answer is not in the file, say:
  "This information is not present in the uploaded file."

FILE CONTENT:
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
    const MODEL_SWITCH_LIMIT = 300;

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
