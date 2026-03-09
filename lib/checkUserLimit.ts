import clientPromise from "@/lib/mongodb";

const FREE_LIMIT = 150;

export async function checkUserLimit(email: string) {
  const client = await clientPromise;
  const db = client.db("chats");

  const user = await db.collection("users").findOne({ email });

  if (!user) return { allowed: false };

  // PRO users unlimited
  if (user.plan === "PRO") {
    return { allowed: true };
  }

  const now = Date.now();
  const lastReset = new Date(user.lastReset).getTime();

  const HOURS_24 = 24 * 60 * 60 * 1000;

  // 🔥 reset every 24h
  if (now - lastReset > HOURS_24) {
    await db.collection("users").updateOne(
      { email },
      {
        $set: {
          dailyMessages: 0,
          lastReset: new Date(),
        },
      }
    );

    user.dailyMessages = 0;
  }

  if (user.dailyMessages >= FREE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: FREE_LIMIT - user.dailyMessages,
  };
}