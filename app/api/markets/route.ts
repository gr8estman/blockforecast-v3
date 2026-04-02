import { NextRequest, NextResponse } from "next/server";
import { getMarkets, createMarket }  from "@/lib/prediction/store";

// GET /api/markets?token=&category=&status=
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token    = searchParams.get("token")    ?? "";
  const category = searchParams.get("category") ?? "";
  const status   = searchParams.get("status")   ?? "";

  let markets = getMarkets();
  if (token)    markets = markets.filter((m) => m.token === token);
  if (category) markets = markets.filter((m) => m.category === category);
  if (status)   markets = markets.filter((m) => m.status  === status);

  return NextResponse.json({ markets, count: markets.length });
}

// POST /api/markets  { question, description, token, tokenSymbol, creator, endTime, category }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, description, token, tokenSymbol, creator, endTime, category } = body;

    if (!question?.trim()) return NextResponse.json({ error: "Question required" }, { status: 400 });
    if (!creator?.trim())  return NextResponse.json({ error: "Creator wallet required" }, { status: 400 });
    if (!endTime)          return NextResponse.json({ error: "End time required" }, { status: 400 });
    if (new Date(endTime) <= new Date()) return NextResponse.json({ error: "End time must be in the future" }, { status: 400 });

    const market = createMarket({
      question: question.trim(),
      description: description?.trim(),
      token,
      tokenSymbol,
      creator,
      endTime,
      category: category ?? "custom",
    });

    return NextResponse.json({ market }, { status: 201 });
  } catch (err) {
    console.error("[markets POST]", err);
    return NextResponse.json({ error: "Failed to create market" }, { status: 500 });
  }
}
