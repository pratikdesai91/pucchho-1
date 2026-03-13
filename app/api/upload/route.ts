import OpenAI from "openai";
import clientPromise from "@/lib/mongodb";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function splitText(text: string, size = 500) {

  const words = text.split(" ");
  const chunks = [];

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }

  return chunks;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File;
    const chatId = formData.get("chatId") as string;
    const userEmail = formData.get("userEmail") as string;

    if (!file) {
      return new Response("No file uploaded", { status: 400 });
    }

    const allowedExtensions = [".txt",".md",".js",".ts",".jsx",".tsx",".json",".html",".css",".py",".java",".cpp",".c",".go",".rs",".php",".csv",".pdf"];

const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

if (!allowedExtensions.includes(ext)) {
  return new Response("File type not supported", { status: 400 });
}

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = buffer.toString("utf8");

    const chunks = splitText(text);

    const mongo = await clientPromise;
    const db = mongo.db("chats");

    await db.collection("fileChunks").deleteMany({
  chatId,
  filename: file.name
});

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: chunks[i],
      });

      await db.collection("fileChunks").insertOne({
        chatId,
        userEmail,
        filename: file.name,
        chunkIndex: i,
        text: chunks[i],
        embedding: embedding.data[0].embedding,
        createdAt: new Date(),
      });
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error("Upload error:", error);
    return new Response("Upload failed", { status: 500 });
  }
}