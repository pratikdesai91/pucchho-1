import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  const email = body.email;

  console.log("Login email:", email);

  return NextResponse.json({
    success: true,
    message: "Email login received",
  });
}