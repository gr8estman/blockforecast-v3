import { NextRequest, NextResponse } from "next/server";
import { performRugCheck } from "@/lib/rug-detector";
import { analyzeTokenRisk } from "@/lib/ai/deepseek";
import { sendRugAlert } from "@/lib/alerts/webhook";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const rugResult = await performRugCheck(token);

    // AI analysis via DeepSeek (non-blocking — failure is silent)
    const aiAnalysis = await analyzeTokenRisk(rugResult).catch(() => null);

    // Fire Make.com alert for high-risk / rug tokens
    if (rugResult.overallScore < 40) {
      sendRugAlert(rugResult).catch(() => null); // fire-and-forget
    }

    return NextResponse.json({ ...rugResult, aiAnalysis });
  } catch (err) {
    console.error("[rug-check]", err);
    return NextResponse.json(
      { error: "Rug check failed", details: String(err) },
      { status: 500 }
    );
  }
}
