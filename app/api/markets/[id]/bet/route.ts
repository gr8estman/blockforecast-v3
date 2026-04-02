import { NextRequest, NextResponse } from "next/server";
import { placeBet }                  from "@/lib/prediction/store";
import { Outcome }                   from "@/lib/prediction/types";

// POST /api/markets/[id]/bet  { bettor, outcome, amount }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { bettor, outcome, amount } = await req.json();

    if (!bettor)                           return NextResponse.json({ error: "Wallet required" },  { status: 400 });
    if (outcome !== "yes" && outcome !== "no") return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
    if (!amount || Number(amount) <= 0)    return NextResponse.json({ error: "Invalid amount" },   { status: 400 });

    const bet = placeBet(id, bettor, outcome as Outcome, Number(amount));
    return NextResponse.json({ bet }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to place bet";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
