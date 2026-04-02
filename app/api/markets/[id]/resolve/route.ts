import { NextRequest, NextResponse }   from "next/server";
import { resolveMarket, cancelMarket } from "@/lib/prediction/store";
import { Outcome }                     from "@/lib/prediction/types";

// POST /api/markets/[id]/resolve  { outcome: "yes"|"no"|"cancel", adminKey }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { outcome, adminKey } = await req.json();

    // Simple admin key guard — replace with proper auth in production
    if (adminKey !== process.env.MARKETS_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (outcome === "cancel") {
      const market = cancelMarket(id);
      return NextResponse.json({ market });
    }

    if (outcome !== "yes" && outcome !== "no") {
      return NextResponse.json({ error: "outcome must be yes, no, or cancel" }, { status: 400 });
    }

    const market = resolveMarket(id, outcome as Outcome);
    return NextResponse.json({ market });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to resolve market";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
