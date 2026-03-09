import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userEmail } = await req.json();

  const client = await clientPromise;
  const db = client.db("chats");

  const chats = await db
  .collection("chats")
  .find({ userEmail })
  .toArray();

const formattedChats = chats.map((chat) => ({
  ...chat,
  id: chat.chatId || chat._id.toString(), // ⭐ FIX
}));

  return NextResponse.json({ chats: formattedChats });
}