import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { chatId } = await req.json();

  const client = await clientPromise;
  const db = client.db("chats");

  await db.collection("chats").deleteOne({ chatId });

  return NextResponse.json({ success: true });
}