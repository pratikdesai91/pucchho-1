import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import clientPromise from "@/lib/mongodb";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      const client = await clientPromise;
      const db = client.db("chats");

      const existingUser = await db
        .collection("users")
        .findOne({ email: user.email });

      // create user if first login
      if (!existingUser) {
        await db.collection("users").insertOne({
          name: user.name,
          email: user.email,
          image: user.image,
          plan: "FREE",
          createdAt: new Date(),
        });
      }

      return true;
    },
  },
});

export { handler as GET, handler as POST };