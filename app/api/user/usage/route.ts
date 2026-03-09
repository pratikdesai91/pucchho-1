import { getServerSession } from "next-auth";
import { checkUserLimit } from "@/lib/checkUserLimit";
import clientPromise from "@/lib/mongodb";

const FREE_LIMIT = 15;

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const email = session.user.email;

  // 🔥 reuse your existing logic
  const limit = await checkUserLimit(email);

  const client = await clientPromise;
  const db = client.db("chats");

  const user = await db.collection("users").findOne({ email });

  return new Response(
    JSON.stringify({
      plan: user?.plan || "FREE",
      usage: FREE_LIMIT - (limit.remaining ?? FREE_LIMIT),
      limit: FREE_LIMIT,
    })
  );
}