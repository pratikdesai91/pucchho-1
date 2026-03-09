import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function GET() {
  const client = await clientPromise;
  const db = client.db("chats");

  const chats = await db.collection("chats").find().toArray();

  return NextResponse.json({ chats });
}