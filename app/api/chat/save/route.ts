import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { userEmail, chatId, title, messages } = body;

    const client = await clientPromise;
    const db = client.db("chats");

    // update existing OR create new
    await db.collection("chats").updateOne(
      { _id: chatId },
      {
        $set: {
          chatId,
          userEmail,
          title,
          messages,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
