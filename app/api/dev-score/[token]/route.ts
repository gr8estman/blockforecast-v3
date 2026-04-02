import { NextRequest, NextResponse } from "next/server";
import { fetchTokenCreationInfo, fetchDevWalletStats } from "@/lib/bitquery/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const creation = await fetchTokenCreationInfo(token);
    if (!creation) {
      return NextResponse.json({ error: "Token creation info not found" }, { status: 404 });
    }
    const devAddress = creation.Transaction.DevAddress;
    if (!devAddress) {
      return NextResponse.json({ error: "Dev address not found" }, { status: 404 });
    }
    const stats = await fetchDevWalletStats(devAddress);
    return NextResponse.json({ devAddress, ...stats });
  } catch (err) {
    console.error("[dev-score]", err);
    return NextResponse.json(
      { score: 50, tokensCreated: 0, rugRatio: 0, walletAge: "Unknown", flags: [] },
      { status: 500 }
    );
  }
}
