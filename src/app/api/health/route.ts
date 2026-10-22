import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: "openai",
    model: process.env.OPENAI_MODEL || "gpt-6-luna",
    configured: Boolean(process.env.OPENAI_API_KEY),
    fallbackAvailable: true,
  });
}
