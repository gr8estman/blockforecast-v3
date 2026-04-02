/**
 * Bitquery Kafka Protobuf consumer — Solana DEX trades (solana.dextrades.proto)
 *
 * Streams DexParsedBlockMessage frames from Bitquery's Kafka cluster.
 * Detects NEW pump.fun token launches (first-ever trade for a mint address)
 * and emits `new_token` events on `sniperEmitter`.
 *
 * Env vars:
 *   KAFKA_BROKER           — default: rpk0.bitquery.io:9093
 *   KAFKA_USERNAME         — your Bitquery Kafka username  (e.g. solana_130)
 *   KAFKA_PASSWORD         — your Bitquery Kafka password
 *   KAFKA_TOPIC            — default: solana.dextrades.proto
 *   KAFKA_SASL_MECHANISM   — scram-sha-512 (default) | scram-sha-256 | plain
 */

import { Kafka, logLevel } from "kafkajs";
import { EventEmitter } from "events";
import bs58 from "bs58";
import path from "path";
import fs from "fs";

// ─── LZ4 codec registration ───────────────────────────────────────────────────
// Use require() (not ESM import) to guarantee we mutate the exact same
// CompressionCodecs singleton that kafkajs's internal compression lookup uses.
// The native `lz4` package has no WASM so it loads fine at module-eval time.
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { CompressionTypes, CompressionCodecs } = require("kafkajs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lz4Lib = require("lz4");

  CompressionCodecs[CompressionTypes.LZ4] = () => ({
    compress: (encoder: { buffer: Buffer }) =>
      new Promise<Buffer>((resolve, reject) => {
        const enc    = lz4Lib.createEncoderStream();
        const chunks: Buffer[] = [];
        enc.on("data",  (c: Buffer) => chunks.push(c));
        enc.on("end",   () => resolve(Buffer.concat(chunks)));
        enc.on("error", reject);
        enc.end(encoder.buffer);
      }),
    decompress: (buffer: Buffer) =>
      new Promise<Buffer>((resolve, reject) => {
        const dec    = lz4Lib.createDecoderStream();
        const chunks: Buffer[] = [];
        dec.on("data",  (c: Buffer) => chunks.push(c));
        dec.on("end",   () => resolve(Buffer.concat(chunks)));
        dec.on("error", reject);
        dec.end(buffer);
      }),
  });
}

// ─── Public event types ───────────────────────────────────────────────────────

export interface KafkaSniperEvent {
  mint:          string;
  symbol:        string;
  name:          string;
  uri:           string;
  dex:           string;
  traderWallet:  string;
  buyAmountRaw:  number;
  sellAmountRaw: number;
  timestamp:     number; // ms
  slot:          number;
  txSignature:   string;
}

export type KafkaStatus = "connected" | "connecting" | "disconnected" | "error";

// ─── Singleton state ──────────────────────────────────────────────────────────

export const sniperEmitter = new EventEmitter();
sniperEmitter.setMaxListeners(500);

const seenMints = new Set<string>();

let _status: KafkaStatus = "disconnected";
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Status helper — emits immediately on change ──────────────────────────────

function setStatus(s: KafkaStatus) {
  if (_status === s) return;
  _status = s;
  sniperEmitter.emit("status_change", s);
  console.log(`[kafka] status → ${s}`);
}

export function kafkaStatus(): KafkaStatus { return _status; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toBase58(bytes: Uint8Array | null | undefined): string {
  if (!bytes || bytes.length === 0) return "";
  try { return bs58.encode(bytes); } catch { return ""; }
}

function isPumpFun(name: string): boolean {
  return (name ?? "").toLowerCase().includes("pump");
}

// ─── Consumer ─────────────────────────────────────────────────────────────────

async function connect(): Promise<void> {
  if (_status === "connecting" || _status === "connected") return;
  setStatus("connecting");

  const broker    = process.env.KAFKA_BROKER          ?? "rpk0.bitquery.io:9093";
  const username  = process.env.KAFKA_USERNAME         ?? "";
  const password  = process.env.KAFKA_PASSWORD         ?? "";
  const topicEnv  = process.env.KAFKA_TOPIC            ?? "solana.dextrades.proto";
  const mechanism = (process.env.KAFKA_SASL_MECHANISM  ?? "scram-sha-512") as
    "scram-sha-512" | "scram-sha-256" | "plain";

  if (!username || !password) {
    console.warn("[kafka] KAFKA_USERNAME / KAFKA_PASSWORD not set — stream disabled");
    setStatus("error");
    return;
  }

  // Use process.cwd() to locate the proto file — require.resolve() returns
  // a virtualised "[project]/..." path under Turbopack dev mode.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const protobuf  = require("protobufjs");
  const protoFile = path.join(
    process.cwd(),
    "node_modules",
    "bitquery-protobuf-schema",
    "solana",
    "dex_block_message.proto",
  );

  let MessageType: { decode: (buf: Buffer) => unknown };
  try {
    const pbRoot = await protobuf.load(protoFile);
    MessageType  = pbRoot.lookupType("solana_messages.DexParsedBlockMessage");
  } catch (err) {
    console.error("[kafka] failed to load proto schema:", err);
    setStatus("error");
    scheduleReconnect(30_000);
    return;
  }

  // The Kafka topic name literally includes ".proto" — do NOT strip it
  const kafkaTopic = topicEnv;

  // Port 9092 = SASL plaintext (no client certs needed)
  // Port 9093 = mTLS (requires client certs — group auth also restricted)
  const useSSL = broker.includes(":9093");
  const sslConfig = useSSL ? (() => {
    const certsDir = path.join(process.cwd(), "certs");
    try {
      return {
        rejectUnauthorized: false,
        ca:   [fs.readFileSync(path.join(certsDir, "server.cer.pem"), "utf-8")],
        key:  fs.readFileSync(path.join(certsDir, "client.key.pem"),  "utf-8"),
        cert: fs.readFileSync(path.join(certsDir, "client.cer.pem"),  "utf-8"),
      };
    } catch {
      return { rejectUnauthorized: false };
    }
  })() : false;

  const kafka = new Kafka({
    clientId: username,
    brokers:  broker.includes(",") ? broker.split(",") : [broker],
    ssl:  sslConfig,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sasl: { mechanism, username, password } as any,
    connectionTimeout: 20_000,
    requestTimeout:    30_000,
    retry: { retries: 5, initialRetryTime: 2_000, factor: 2 },
    logLevel: logLevel.WARN,
  });

  // Group ID must be prefixed with the username (Bitquery ACL requirement)
  const consumer = kafka.consumer({
    groupId:                     `${username}-bf-${process.pid}`,
    sessionTimeout:              30_000,
    heartbeatInterval:           3_000,
    maxWaitTimeInMs:             5_000,
    allowAutoTopicCreation:      false,
  });

  // ── Lifecycle events — register BEFORE connect/run ──
  consumer.on(consumer.events.CONNECT, () => {
    setStatus("connected");
  });

  consumer.on(consumer.events.DISCONNECT, () => {
    if (_status !== "error") setStatus("disconnected");
    scheduleReconnect();
  });

  consumer.on(consumer.events.CRASH, ({ payload }) => {
    console.error("[kafka] consumer crash:", (payload as { error?: Error })?.error?.message ?? payload);
    setStatus("error");
    scheduleReconnect(15_000);
  });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: kafkaTopic, fromBeginning: false });

    // Run in background — don't await so we can return immediately
    consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        try {
          const block = MessageType.decode(message.value) as {
            Header: { Slot: bigint; Timestamp: bigint };
            Transactions: Array<{
              Status:    { Success: boolean };
              Signature: Uint8Array;
              Trades: Array<{
                Dex:  { ProtocolName: string };
                Buy:  { Amount: bigint; Currency: { MintAddress: Uint8Array; Symbol: string; Name: string; Uri: string }; Account: { Address: Uint8Array } };
                Sell: { Amount: bigint };
              }>;
            }>;
          };

          const slot = Number(block?.Header?.Slot      ?? 0);
          const ts   = Number(block?.Header?.Timestamp ?? 0) * 1000 || Date.now();

          for (const tx of block?.Transactions ?? []) {
            if (!tx?.Status?.Success) continue;
            const sig = toBase58(tx.Signature);

            for (const trade of tx?.Trades ?? []) {
              if (!isPumpFun(trade?.Dex?.ProtocolName ?? "")) continue;

              const currency = trade?.Buy?.Currency;
              const mint     = toBase58(currency?.MintAddress);
              if (!mint) continue;

              if (!seenMints.has(mint)) {
                seenMints.add(mint);
                if (seenMints.size > 50_000) {
                  const first = seenMints.values().next().value;
                  if (first) seenMints.delete(first);
                }

                sniperEmitter.emit("new_token", {
                  mint,
                  symbol:        currency?.Symbol ?? "???",
                  name:          currency?.Name   ?? "",
                  uri:           currency?.Uri    ?? "",
                  dex:           trade?.Dex?.ProtocolName ?? "pump",
                  traderWallet:  toBase58(trade?.Buy?.Account?.Address),
                  buyAmountRaw:  Number(trade?.Buy?.Amount  ?? 0),
                  sellAmountRaw: Number(trade?.Sell?.Amount ?? 0),
                  timestamp: ts,
                  slot,
                  txSignature: sig,
                } satisfies KafkaSniperEvent);
              }
            }
          }
        } catch { /* corrupt frame — skip */ }
      },
    }).catch((err) => {
      console.error("[kafka] run() error:", err);
      setStatus("error");
      scheduleReconnect(15_000);
    });

  } catch (err) {
    console.error("[kafka] connect/subscribe failed:", err);
    setStatus("error");
    try { await consumer.disconnect(); } catch { /* ignore */ }
    scheduleReconnect(15_000);
  }
}

function scheduleReconnect(delay = 10_000): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

export function ensureKafkaConsumer(): void {
  if (_status === "disconnected") connect();
}
