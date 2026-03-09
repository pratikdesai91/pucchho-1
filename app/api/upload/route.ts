import { NextRequest } from "next/server";
import { extractTextFromBuffer } from "@/lib/fileExtractor";
import { chunkText } from "@/lib/chunker";
import clientPromise from "@/lib/mongodb";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const userEmail = formData.get("userEmail") as string;
    const chatId = formData.get("chatId") as string;

    if (!file || !userEmail || !chatId) {
      return new Response("Missing required fields", { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 🔹 Extract text
    const extractedText = await extractTextFromBuffer(
      buffer,
      file.name,
      file.type
    );

    // 🔹 Chunk text
    const chunks = chunkText(extractedText);
    console.log("UPLOAD SAVING:", {
  chatId,
  userEmail,
  filename: file.name,
  chunksCount: chunks.length,
});

    // 🔹 Save to MongoDB
    const mongo = await clientPromise;
    const db = mongo.db("chats");

    const chunkDocs = [];

for (let i = 0; i < chunks.length; i++) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: chunks[i],
  });

  chunkDocs.push({
    userEmail,
    chatId,
    filename: file.name,
    chunkIndex: i,
    text: chunks[i],
    embedding: embedding.data[0].embedding,
    createdAt: new Date(),
  });
}

await db.collection("fileChunks").insertMany(chunkDocs);

    return Response.json({
      filename: file.name,
      length: extractedText.length,
      chunksCount: chunks.length,
      preview: chunks.slice(0, 2),
    });
  } catch (error) {
    console.error(error);
    return new Response("Server error", { status: 500 });
  }
}