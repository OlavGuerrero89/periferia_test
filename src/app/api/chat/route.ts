import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({ error: "Chat pendiente de especificación del PRD" }, { status: 501 }); }
