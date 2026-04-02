/**
 * GET /api/sniper-feed
 *
 * SSE stream for the Kafka Protobuf sniper.
 *
 * Events:
 *   { type: "connected" }
 *   { type: "status",    status: "connected"|"connecting"|"disconnected"|"error" }
 *   { type: "new_token", ...KafkaSniperEvent }
 */

import { NextRequest } from "next/server";
import {
  ensureKafkaConsumer,
  kafkaStatus,
  sniperEmitter,
  type KafkaSniperEvent,
  type KafkaStatus,
} from "@/lib/kafka/solana-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  ensureKafkaConsumer();

  let cleanupFn: () => void;

  const stream = new ReadableStream({
    start(controller) {
      const enc = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

      // Immediately send current status
      controller.enqueue(enc({ type: "connected" }));
      controller.enqueue(enc({ type: "status", status: kafkaStatus() }));

      // Push new token events
      const tokenHandler = (event: KafkaSniperEvent) => {
        try { controller.enqueue(enc({ type: "new_token", ...event })); } catch { /* client gone */ }
      };

      // Push status changes immediately (emitted by solana-stream when state changes)
      const statusHandler = (status: KafkaStatus) => {
        try { controller.enqueue(enc({ type: "status", status })); } catch { /* client gone */ }
      };

      sniperEmitter.on("new_token",     tokenHandler);
      sniperEmitter.on("status_change", statusHandler);

      // Keepalive comment every 25s (browsers close SSE after 30–60s of silence)
      const hb = setInterval(() => {
        try { controller.enqueue(": hb\n\n"); } catch {
          clearInterval(hb);
          sniperEmitter.off("new_token",     tokenHandler);
          sniperEmitter.off("status_change", statusHandler);
        }
      }, 25_000);

      cleanupFn = () => {
        clearInterval(hb);
        sniperEmitter.off("new_token",     tokenHandler);
        sniperEmitter.off("status_change", statusHandler);
      };
    },

    cancel() { cleanupFn?.(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
