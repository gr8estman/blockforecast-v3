/**
 * Helius-powered pump.fun sniper
 * Uses @solana/web3.js + @solana/spl-token to build and submit
 * buy/sell transactions via Helius RPC for fast confirmation.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";

// ─── Constants ────────────────────────────────────────────────────────────────

const PUMPFUN_PROGRAM   = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");
const PUMPFUN_GLOBAL    = new PublicKey("4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5SKy2uB4Jjaxnjf");
const PUMPFUN_FEE_ACCT  = new PublicKey("CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM");
const PUMPFUN_EVENT_AUT = new PublicKey("Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1");

// Jito MEV bundle submission
const JITO_TIP_ACCOUNTS = [
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLk",
  "ADaUMid9sMokze4zvDbFM3x2BoqqCxXCoeKwGg5s5Kp",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6cv",
];
const JITO_BUNDLE_ENDPOINT = "https://mainnet.block-engine.jito.labs.io/api/v1/bundles";

// Instruction discriminators (Anchor global:<method>)
const BUY_DISCRIMINATOR  = Buffer.from([102,  6, 61, 18,  1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

// ─── Helius connection ────────────────────────────────────────────────────────

function getConnection(): Connection {
  const rpc =
    process.env.HELIUS_RPC_URL          ||
    process.env.NEXT_PUBLIC_SOLANA_RPC  ||
    "https://api.mainnet-beta.solana.com";
  return new Connection(rpc, "confirmed");
}

// ─── Bonding curve PDAs ───────────────────────────────────────────────────────

function getBondingCurvePDA(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("bonding-curve"), mint.toBuffer()],
    PUMPFUN_PROGRAM
  );
  return pda;
}

function getAssocBondingCurve(bondingCurve: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, bondingCurve, true);
}

// ─── Encode u64 little-endian ─────────────────────────────────────────────────

function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

// ─── Buy instruction ──────────────────────────────────────────────────────────

function buildBuyInstruction(
  mint: PublicKey,
  bondingCurve: PublicKey,
  assocBondingCurve: PublicKey,
  userTokenAccount: PublicKey,
  user: PublicKey,
  tokenAmount: bigint,
  maxSolCost: bigint
): TransactionInstruction {
  const data = Buffer.concat([BUY_DISCRIMINATOR, encodeU64(tokenAmount), encodeU64(maxSolCost)]);

  return new TransactionInstruction({
    programId: PUMPFUN_PROGRAM,
    data,
    keys: [
      { pubkey: PUMPFUN_GLOBAL,             isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_FEE_ACCT,           isSigner: false, isWritable: true  },
      { pubkey: mint,                        isSigner: false, isWritable: false },
      { pubkey: bondingCurve,               isSigner: false, isWritable: true  },
      { pubkey: assocBondingCurve,          isSigner: false, isWritable: true  },
      { pubkey: userTokenAccount,           isSigner: false, isWritable: true  },
      { pubkey: user,                        isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,         isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_EVENT_AUT,          isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_PROGRAM,            isSigner: false, isWritable: false },
    ],
  });
}

// ─── Sell instruction ─────────────────────────────────────────────────────────

function buildSellInstruction(
  mint: PublicKey,
  bondingCurve: PublicKey,
  assocBondingCurve: PublicKey,
  userTokenAccount: PublicKey,
  user: PublicKey,
  tokenAmount: bigint,
  minSolOutput: bigint
): TransactionInstruction {
  const data = Buffer.concat([SELL_DISCRIMINATOR, encodeU64(tokenAmount), encodeU64(minSolOutput)]);

  return new TransactionInstruction({
    programId: PUMPFUN_PROGRAM,
    data,
    keys: [
      { pubkey: PUMPFUN_GLOBAL,             isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_FEE_ACCT,           isSigner: false, isWritable: true  },
      { pubkey: mint,                        isSigner: false, isWritable: false },
      { pubkey: bondingCurve,               isSigner: false, isWritable: true  },
      { pubkey: assocBondingCurve,          isSigner: false, isWritable: true  },
      { pubkey: userTokenAccount,           isSigner: false, isWritable: true  },
      { pubkey: user,                        isSigner: true,  isWritable: true  },
      { pubkey: SystemProgram.programId,    isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,           isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_EVENT_AUT,          isSigner: false, isWritable: false },
      { pubkey: PUMPFUN_PROGRAM,            isSigner: false, isWritable: false },
    ],
  });
}

// ─── Priority fee via Helius ──────────────────────────────────────────────────

async function getPriorityFee(
  rpcEndpoint: string,
  level: "low" | "medium" | "high" | "veryHigh" = "high"
): Promise<number> {
  try {
    const res = await fetch(rpcEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getPriorityFeeEstimate",
        params: [{ accountKeys: [PUMPFUN_PROGRAM.toBase58()], options: { priorityLevel: level } }],
      }),
    });
    const json = await res.json();
    return Math.ceil(json.result?.priorityFeeEstimate ?? 100_000);
  } catch {
    return 100_000;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SnipeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  solSpent?: number;
}

export interface SellResult {
  success: boolean;
  txHash?: string;
  error?: string;
  tokensSold?: number;
}

export interface PumpQuote {
  solIn: number;
  estimatedTokens: number;
  pricePerToken: number;
  bondingCurveAddress: string;
}

// ─── Quote (bonding curve math) ───────────────────────────────────────────────

export async function getPumpQuote(
  tokenAddress: string,
  solAmount: number
): Promise<PumpQuote | null> {
  try {
    const connection = getConnection();
    const mint = new PublicKey(tokenAddress);
    const bondingCurve = getBondingCurvePDA(mint);
    const info = await connection.getAccountInfo(bondingCurve);
    if (!info) return null;

    // Bonding curve layout (skip 8-byte discriminator):
    // offset  8: virtualTokenReserves u64
    // offset 16: virtualSolReserves   u64
    const vTokenReserves = Number(info.data.readBigUInt64LE(8));
    const vSolReserves   = Number(info.data.readBigUInt64LE(16));

    const solInLamports = solAmount * LAMPORTS_PER_SOL;
    const tokensOut     = (vTokenReserves * solInLamports) / (vSolReserves + solInLamports);
    const tokensOutUi   = tokensOut / 1_000_000; // 6 decimals

    return {
      solIn: solAmount,
      estimatedTokens: tokensOutUi,
      pricePerToken: tokensOutUi > 0 ? solAmount / tokensOutUi : 0,
      bondingCurveAddress: bondingCurve.toBase58(),
    };
  } catch {
    return null;
  }
}

// ─── Buy ─────────────────────────────────────────────────────────────────────

export async function snipePumpToken(
  tokenAddress: string,
  solAmountToSpend: number,
  slippagePct = 10,
  secretKeyBase58: string,
  priorityLevel: "low" | "medium" | "high" | "veryHigh" = "high"
): Promise<SnipeResult> {
  try {
    const connection = getConnection();
    const mint        = new PublicKey(tokenAddress);
    const keypair     = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
    const user        = keypair.publicKey;

    const bondingCurve      = getBondingCurvePDA(mint);
    const assocBondingCurve = getAssocBondingCurve(bondingCurve, mint);
    const userTokenAccount  = getAssociatedTokenAddressSync(mint, user);

    const solLamports = BigInt(Math.floor(solAmountToSpend * LAMPORTS_PER_SOL));
    const maxSolCost  = BigInt(Math.floor(Number(solLamports) * (1 + slippagePct / 100)));
    const tokenAmount = BigInt(0); // 0 = spend exact SOL, pump.fun calculates tokens

    const microLamports = await getPriorityFee(connection.rpcEndpoint, priorityLevel);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));

    const ataInfo = await connection.getAccountInfo(userTokenAccount);
    if (!ataInfo) {
      tx.add(createAssociatedTokenAccountInstruction(user, userTokenAccount, user, mint));
    }

    tx.add(buildBuyInstruction(mint, bondingCurve, assocBondingCurve, userTokenAccount, user, tokenAmount, maxSolCost));

    const sig = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    return { success: true, txHash: sig, solSpent: solAmountToSpend };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sniper] buy failed:", message);
    return { success: false, error: message };
  }
}

// ─── Sell ─────────────────────────────────────────────────────────────────────

export async function sellPumpToken(
  tokenAddress: string,
  tokenAmountUi: number,
  slippagePct = 10,
  secretKeyBase58: string,
  priorityLevel: "low" | "medium" | "high" | "veryHigh" = "high"
): Promise<SellResult> {
  try {
    const connection = getConnection();
    const mint        = new PublicKey(tokenAddress);
    const keypair     = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
    const user        = keypair.publicKey;

    const bondingCurve      = getBondingCurvePDA(mint);
    const assocBondingCurve = getAssocBondingCurve(bondingCurve, mint);
    const userTokenAccount  = getAssociatedTokenAddressSync(mint, user);

    const tokenAmount  = BigInt(Math.floor(tokenAmountUi * 1_000_000));
    const minSolOutput = BigInt(Math.floor(Number(tokenAmount) * (1 - slippagePct / 100))); // min SOL out

    const microLamports = await getPriorityFee(connection.rpcEndpoint, priorityLevel);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
    tx.add(buildSellInstruction(mint, bondingCurve, assocBondingCurve, userTokenAccount, user, tokenAmount, minSolOutput));

    const sig = await sendAndConfirmTransaction(connection, tx, [keypair], {
      commitment: "confirmed",
      maxRetries: 3,
    });

    return { success: true, txHash: sig, tokensSold: tokenAmountUi };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sniper] sell failed:", message);
    return { success: false, error: message };
  }
}

// ─── Jito MEV-Protected Buy ────────────────────────────────────────────────────
//
// Submits a buy transaction as a Jito bundle — the tip instruction ensures
// Jito validators include the bundle atomically, preventing sandwich attacks.

export async function snipePumpTokenJito(
  tokenAddress: string,
  solAmountToSpend: number,
  slippagePct = 10,
  secretKeyBase58: string,
  tipLamports = 1_000_000 // 0.001 SOL default tip
): Promise<SnipeResult> {
  try {
    const connection = getConnection();
    const mint        = new PublicKey(tokenAddress);
    const keypair     = Keypair.fromSecretKey(bs58.decode(secretKeyBase58));
    const user        = keypair.publicKey;

    const bondingCurve      = getBondingCurvePDA(mint);
    const assocBondingCurve = getAssocBondingCurve(bondingCurve, mint);
    const userTokenAccount  = getAssociatedTokenAddressSync(mint, user);

    const solLamports = BigInt(Math.floor(solAmountToSpend * LAMPORTS_PER_SOL));
    const maxSolCost  = BigInt(Math.floor(Number(solLamports) * (1 + slippagePct / 100)));
    const tokenAmount = BigInt(0); // spend exact SOL

    // Get fresh blockhash for the bundle
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    // Pick a random Jito tip account to avoid predictable routing
    const tipAccount = new PublicKey(
      JITO_TIP_ACCOUNTS[Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length)]
    );

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.feePayer = user;

    // Moderate priority fee — Jito handles MEV protection, no need for extreme fees
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));

    // Create ATA if needed
    const ataInfo = await connection.getAccountInfo(userTokenAccount);
    if (!ataInfo) {
      tx.add(createAssociatedTokenAccountInstruction(user, userTokenAccount, user, mint));
    }

    // Buy instruction
    tx.add(buildBuyInstruction(mint, bondingCurve, assocBondingCurve, userTokenAccount, user, tokenAmount, maxSolCost));

    // Jito tip — must be in same tx so bundle is atomic
    tx.add(SystemProgram.transfer({ fromPubkey: user, toPubkey: tipAccount, lamports: tipLamports }));

    tx.sign(keypair);
    const sig       = bs58.encode(tx.signatures[0].signature!);
    const serialized = tx.serialize();
    const base58Tx   = bs58.encode(serialized);

    // Submit bundle to Jito block engine
    const jitoRes = await fetch(JITO_BUNDLE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sendBundle", params: [[base58Tx]] }),
    });
    const jitoData = await jitoRes.json() as { error?: { message: string } };
    if (jitoData.error) throw new Error(`Jito bundle error: ${jitoData.error.message}`);

    // Wait for on-chain confirmation
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

    return { success: true, txHash: sig, solSpent: solAmountToSpend };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sniper/jito] buy failed:", message);
    return { success: false, error: message };
  }
}
