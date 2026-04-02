import { NextRequest, NextResponse } from "next/server";
import { fetchSmartMoneyForToken } from "@/lib/bitquery/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const wallets = await fetchSmartMoneyForToken(token);
    return NextResponse.json({ wallets });
  } catch (err) {
    console.error("[smart-money]", err);
    return NextResponse.json({ wallets: [] }, { status: 500 });
  }
}
