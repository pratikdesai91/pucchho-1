import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { chatId, title } = await req.json();

  const client = await clientPromise;
  const db = client.db("chats");

  await db.collection("chats").updateOne(
    { chatId },
    {
      $set: {
        title,
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ success: true });
}