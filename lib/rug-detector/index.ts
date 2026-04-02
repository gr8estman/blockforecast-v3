import {
  fetchTokenHolders,
  fetchFirstTransfers,
  fetchFirstBuys,
  fetchTradesForWashDetection,
  checkTokenGraduation,
  fetchTokenCreationInfo,
  fetchPoolLiquidity,
  fetchDevWalletStats,
} from "@/lib/bitquery/client";
import { getAssetMetadata } from "@/lib/helius/client";
import {
  RugCheckResult,
  RugRiskLevel,
  HolderEntry,
  WashTradingResult,
} from "@/types";
import { Connection, PublicKey } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";

const HELIUS_RPC =
  process.env.HELIUS_RPC_URL ||
  `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

// ─── Holder Analysis (exact query from pumpfun-token-sniffer) ────────────────

async function analyzeHolders(tokenAddress: string): Promise<{
  holders: HolderEntry[];
  top10Pct: number;
  creatorPct: number;
  bondingCurveAddress: string;
}> {
  const raw = await fetchTokenHolders(tokenAddress);
  const totalBalance = raw.reduce((s, h) => s + Number(h.BalanceUpdate.Holding || 0), 0);

  // Identify bonding curve: typically a specific system address
  const BONDING_CURVE_PROGRAMS = new Set([
    "8psNvWTrdNTiVRNzAgsou9kETXNJm2SXZyaKuJraVRtf",
    "AkTgH1uW6J6j6QHmFNGzZuZwwXaHQsPCpHUriED28tRj",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  ]);

  let bondingCurveAddress = "";
  const holders: HolderEntry[] = raw.map((h, i) => {
    const owner = h.BalanceUpdate.Account.Token.Owner;
    const isBondingCurve = BONDING_CURVE_PROGRAMS.has(owner);
    if (isBondingCurve && !bondingCurveAddress) bondingCurveAddress = owner;

    const holding = Number(h.BalanceUpdate.Holding || 0);
    return {
      address: owner,
      balance: holding,
      percentage: totalBalance > 0 ? (holding / totalBalance) * 100 : 0,
      isCreator: i === 0 && !isBondingCurve,
      isBondingCurve,
    };
  });

  // Filter out bonding curve from concentration metrics
  const realHolders = holders.filter((h) => !h.isBondingCurve);
  const realTotal = realHolders.reduce((s, h) => s + h.balance, 0);
  if (realTotal > 0) {
    for (const h of realHolders) h.percentage = (h.balance / realTotal) * 100;
  }

  const top10Pct = realHolders.slice(0, 10).reduce((s, h) => s + h.percentage, 0);
  const creatorPct = realHolders[0]?.percentage ?? 0;

  return { holders, top10Pct, creatorPct, bondingCurveAddress };
}

// ─── Pre-distribution Check (exact logic from pumpfun-token-sniffer) ─────────

async function checkPreDistribution(
  tokenAddress: string,
  bondingCurve: string
): Promise<boolean> {
  if (!bondingCurve) return false;

  const transfers = await fetchFirstTransfers(tokenAddress, bondingCurve);
  if (transfers.length === 0) return false;

  const receiverOwners = transfers.map((t) => t.Transfer.Receiver.Token.Owner);

  // Get buyers for these specific addresses
  const buyers = await fetchFirstBuys(tokenAddress, receiverOwners);
  const buyerSet = new Set(buyers.map((b) => b.Trade.Account.Token.Owner));

  // Pre-distribution: received tokens before any buy
  const firstTransferTime = new Date(transfers[0].Block.first_transfer).getTime();
  let preDistribCount = 0;

  for (const t of transfers) {
    const owner = t.Transfer.Receiver.Token.Owner;
    const txTime = new Date(t.Block.first_transfer).getTime();
    // Got tokens early but never bought through DEX = insider
    if (!buyerSet.has(owner) && txTime <= firstTransferTime + 120_000) {
      preDistribCount++;
    }
  }

  return preDistribCount >= 3;
}

// ─── Wash Trading Detection (from wash-trading-detector) ─────────────────────

async function detectWashTrading(tokenAddress: string): Promise<WashTradingResult> {
  const trades = await fetchTradesForWashDetection(tokenAddress);

  const selfTrades: string[] = [];
  const walletTradeCounts = new Map<string, number>();
  // Loop detection: A→B→A within short window
  const recentTradePairs = new Map<string, number>(); // "buyerAddr:sellerAddr" -> lastTimestamp

  for (const trade of trades) {
    const buyer = trade.Trade.Buy.Account.Address;
    const seller = trade.Trade.Sell.Account.Address;
    const time = new Date(trade.Block.Time).getTime();

    // Self-trade (same address buys and sells)
    if (buyer === seller) selfTrades.push(buyer);

    // Count per wallet
    walletTradeCounts.set(buyer, (walletTradeCounts.get(buyer) || 0) + 1);
    walletTradeCounts.set(seller, (walletTradeCounts.get(seller) || 0) + 1);

    // Trade loop detection: A→B then B→A within 5 minutes
    const reverseKey = `${seller}:${buyer}`;
    const fwdKey = `${buyer}:${seller}`;
    const lastReverse = recentTradePairs.get(reverseKey);
    if (lastReverse && time - lastReverse < 300_000) {
      selfTrades.push(buyer); // Count as suspicious
    }
    recentTradePairs.set(fwdKey, time);
  }

  // High-frequency wallets — >10 for new tokens, >50 for graduated (market makers are expected)
  // We don't know graduation status here, so use a compromise threshold of 30
  const suspiciousWallets = Array.from(walletTradeCounts.entries())
    .filter(([, count]) => count > 30)
    .map(([addr]) => addr);

  const total = trades.length;
  const washVolumePct = total > 0 ? (selfTrades.length / total) * 100 : 0;

  // Score 0→100 (100 = definite wash)
  let score = 0;
  score += Math.min(selfTrades.length * 8, 40);
  score += Math.min(suspiciousWallets.length * 4, 40);
  score += Math.min(washVolumePct * 0.5, 20);
  score = Math.min(Math.round(score), 100);

  return {
    detected: score > 30,
    selfTradeCount: [...new Set(selfTrades)].length,
    suspiciousWallets: [...new Set(suspiciousWallets)],
    washVolumePct,
    score,
  };
}

// ─── Scam Word Detection (pure logic, no API) ────────────────────────────────

const SCAM_WORDS = [
  "guarantee", "guaranteed", "100x", "1000x",
  "elon", "trump", "melania", "musk",
];

function checkScamWords(name: string, symbol: string): string[] {
  const combined = `${name} ${symbol}`.toLowerCase();
  return SCAM_WORDS.filter((w) => combined.includes(w));
}

// ─── Metadata Completeness (Helius DAS) ───────────────────────────────────────

async function checkMetadataCompleteness(tokenAddress: string): Promise<{
  missingFields: string[];
  totalSupply: number;
  supplyRound: boolean;
  name: string;
  symbol: string;
}> {
  const asset = await getAssetMetadata(tokenAddress);
  if (!asset) return { missingFields: ["metadata unavailable"], totalSupply: 0, supplyRound: false, name: "", symbol: "" };

  const meta = asset.content?.metadata;
  const missingFields: string[] = [];
  if (!meta?.name?.trim()) missingFields.push("name");
  if (!meta?.symbol?.trim()) missingFields.push("symbol");
  if (!meta?.description?.trim() || meta.description.trim().length < 5) missingFields.push("description");
  if (!asset.content?.links?.image) missingFields.push("image");

  const totalSupply = asset.token_info?.supply ?? 0;
  const supplyRound = totalSupply > 0 && totalSupply % 1_000_000_000 === 0;

  return {
    missingFields,
    totalSupply,
    supplyRound,
    name: meta?.name?.trim() ?? "",
    symbol: meta?.symbol?.trim() ?? "",
  };
}

// ─── Mint / Freeze Authority Check (on-chain) ─────────────────────────────────

async function checkMintFreezeAuthority(tokenAddress: string): Promise<{
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
}> {
  try {
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const mintInfo = await getMint(conn, new PublicKey(tokenAddress));
    return {
      mintAuthorityRevoked: mintInfo.mintAuthority === null,
      freezeAuthorityRevoked: mintInfo.freezeAuthority === null,
    };
  } catch {
    // Can't verify — return false (safer: assume not revoked)
    return { mintAuthorityRevoked: false, freezeAuthorityRevoked: false };
  }
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function performRugCheck(
  tokenAddress: string,
  tokenName = "Unknown",
  tokenSymbol = "???"
): Promise<RugCheckResult> {
  // Step 1: get creation info so we have the bonding curve address
  const creationInfo = await fetchTokenCreationInfo(tokenAddress).catch(() => null);

  // Extract bonding curve: second account in pump.fun create instruction
  const bondingCurve = creationInfo?.Instruction.Accounts[2]?.Address ?? "";
  const devAddress = creationInfo?.Transaction.DevAddress ?? "";

  // Extract name/symbol from creation args
  if (creationInfo?.Instruction.Program.Arguments) {
    for (const arg of creationInfo.Instruction.Program.Arguments) {
      const v = arg.Value as Record<string, string>;
      if (arg.Name === "name" && v.string) tokenName = v.string;
      if (arg.Name === "symbol" && v.string) tokenSymbol = v.string;
    }
  }

  // Step 2: run all checks in parallel
  const [holderResult, preDistribResult, washResult, graduatedResult, liquidityResult,
         metaResult, mintAuthResult, devStatsResult] =
    await Promise.allSettled([
      analyzeHolders(tokenAddress),
      checkPreDistribution(tokenAddress, bondingCurve),
      detectWashTrading(tokenAddress),
      checkTokenGraduation(tokenAddress),
      fetchPoolLiquidity(bondingCurve),
      // New checks (additive — failures are gracefully ignored)
      checkMetadataCompleteness(tokenAddress),
      checkMintFreezeAuthority(tokenAddress),
      devAddress ? fetchDevWalletStats(devAddress) : Promise.resolve(null),
    ]);

  const rawHolderData =
    holderResult.status === "fulfilled"
      ? holderResult.value
      : { holders: [], top10Pct: 0, creatorPct: 0, bondingCurveAddress: "" };

  // Fix creator identification: use devAddress from creation info, not just the largest holder.
  // The largest holder is often an exchange wallet or LP pool, not the actual deployer.
  let correctedCreatorPct = rawHolderData.creatorPct;
  if (devAddress) {
    const devHolder = rawHolderData.holders.find((h) => h.address === devAddress);
    correctedCreatorPct = devHolder?.percentage ?? 0;
    // Mark the correct holder as creator
    for (const h of rawHolderData.holders) {
      h.isCreator = h.address === devAddress;
    }
  }
  const holderData = { ...rawHolderData, creatorPct: correctedCreatorPct };

  const isPreDistributed =
    preDistribResult.status === "fulfilled" ? preDistribResult.value : false;

  const wash: WashTradingResult =
    washResult.status === "fulfilled"
      ? washResult.value
      : { detected: false, selfTradeCount: 0, suspiciousWallets: [], washVolumePct: 0, score: 0 };

  let graduated = graduatedResult.status === "fulfilled" ? graduatedResult.value : false;
  // Fallback: pump.fun Migrate log only exists in Bitquery for recent tokens.
  // If fetchTokenCreationInfo returned null, the token predates the indexed range —
  // it's an established token and almost certainly graduated (new rugs always have creation info).
  if (!graduated && creationInfo === null) graduated = true;
  const liquidity = liquidityResult.status === "fulfilled" ? Number(liquidityResult.value ?? 0) : 0;

  const meta = metaResult.status === "fulfilled"
    ? metaResult.value
    : { missingFields: [], totalSupply: 0, supplyRound: false, name: "", symbol: "" };

  // Fallback name/symbol from Helius DAS when pump.fun creation info is unavailable (old tokens)
  if ((tokenName === "Unknown" || tokenName === "") && meta.name) tokenName = meta.name;
  if ((tokenSymbol === "???" || tokenSymbol === "") && meta.symbol) tokenSymbol = meta.symbol;

  const mintAuth = mintAuthResult.status === "fulfilled"
    ? mintAuthResult.value
    : { mintAuthorityRevoked: false, freezeAuthorityRevoked: false };

  const devStats = devStatsResult.status === "fulfilled" ? devStatsResult.value : null;

  const scamHits = checkScamWords(tokenName, tokenSymbol);

  // ─── Scoring (0→100, higher = safer) ─────────────────────────────────────
  let score = 100;
  const flags: string[] = [];

  // Creator concentration
  if (holderData.creatorPct > 20) {
    score -= 30;
    flags.push(`Creator holds ${holderData.creatorPct.toFixed(1)}% of supply`);
  } else if (holderData.creatorPct > 10) {
    score -= 15;
    flags.push(`Creator holds ${holderData.creatorPct.toFixed(1)}% of supply`);
  }

  // Top 10 concentration
  // Graduated tokens: LP pools legitimately hold large supply — use relaxed thresholds
  const top10HighThreshold  = graduated ? 95 : 80;
  const top10MedThreshold   = graduated ? 80 : 60;
  if (holderData.top10Pct > top10HighThreshold) {
    score -= 25;
    flags.push(`Top 10 wallets control ${holderData.top10Pct.toFixed(1)}% of supply`);
  } else if (holderData.top10Pct > top10MedThreshold) {
    score -= 10;
    flags.push(`Top 10 wallets control ${holderData.top10Pct.toFixed(1)}% of supply`);
  }

  // Holder data completely missing → can't verify distribution, penalise
  if (holderData.holders.length === 0) {
    score -= 15;
    flags.push("Holder data unavailable — supply distribution cannot be verified");
  }

  // Pre-distribution (insider seeding)
  if (isPreDistributed) {
    score -= 25;
    flags.push("Pre-distributed tokens detected — wallets received tokens before any DEX buy");
  }

  // Wash trading — scale penalty with severity (score + self-trade volume)
  if (wash.detected) {
    const scorePenalty   = Math.round((wash.score / 100) * 30);        // 0–30 based on wash score
    const selfTradePen   = Math.min(Math.floor(wash.selfTradeCount / 15) * 5, 20); // 5 per 15 self-trades, max 20
    const washPenalty    = Math.min(20 + scorePenalty + selfTradePen, 55);
    score -= washPenalty;
    flags.push(`Wash trading detected (score ${wash.score}/100, ${wash.selfTradeCount} self-trades)`);
  }
  if (wash.suspiciousWallets.length > 3) {
    score -= Math.min(wash.suspiciousWallets.length * 2, 10);
    flags.push(`${wash.suspiciousWallets.length} high-frequency trading wallets found`);
  }

  // Low liquidity
  if (liquidity > 0 && liquidity < 1) {
    score -= 20;
    flags.push(`Critically low liquidity: ${liquidity.toFixed(4)} SOL`);
  } else if (liquidity > 0 && liquidity < 5) {
    score -= 10;
    flags.push(`Low liquidity: ${liquidity.toFixed(2)} SOL`);
  }

  // Graduated tokens are generally safer (bonding curve complete)
  if (graduated) {
    score = Math.min(score + 10, 100);
    flags.unshift("Token graduated to Raydium ✓");
  }

  // ─── New checks ──────────────────────────────────────────────────────────

  // Mint authority not revoked → dev can mint unlimited supply
  if (!mintAuth.mintAuthorityRevoked) {
    score -= 20;
    flags.push("Mint authority not revoked — dev can inflate supply at any time");
  }

  // Freeze authority not revoked → dev can freeze holder wallets
  if (!mintAuth.freezeAuthorityRevoked) {
    score -= 10;
    flags.push("Freeze authority not revoked — dev can freeze token accounts");
  }

  // Metadata completeness — missing fields signal low-effort / throwaway launch
  const criticalMissing = meta.missingFields.filter((f) => ["name", "symbol", "image"].includes(f));
  if (criticalMissing.length >= 2) {
    score -= 15;
    flags.push(`Incomplete metadata: missing ${criticalMissing.join(", ")}`);
  } else if (criticalMissing.length === 1) {
    score -= 7;
    flags.push(`Incomplete metadata: missing ${criticalMissing[0]}`);
  }

  // Supply roundness (e.g. exactly 1,000,000,000) — common in pre-minted rug setups
  if (meta.supplyRound && meta.totalSupply > 0) {
    score -= 5;
    flags.push(`Supply is a suspiciously round number (${(meta.totalSupply / 1e9).toFixed(0)}B)`);
  }

  // Scam words in name/symbol
  if (scamHits.length > 0) {
    score -= 10;
    flags.push(`Deceptive keywords in name/symbol: ${scamHits.join(", ")}`);
  }

  // Dev wallet behavioral signals (serial deployer + wallet freshness)
  if (devStats) {
    for (const f of devStats.flags) flags.push(f);
    if (devStats.tokensCreated > 20) score -= 15;
    if (devStats.rugRatio > 0.5) score -= 25;
    else if (devStats.rugRatio > 0.3) score -= 10;
    // Wallet freshness: walletAge is "Xd" / "Xw" / "Xmo"
    if (devStats.walletAge.endsWith("d") && parseInt(devStats.walletAge) < 7) score -= 20;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const riskLevel: RugRiskLevel =
    score >= 80 ? "safe" :
    score >= 60 ? "low" :
    score >= 40 ? "medium" :
    score >= 20 ? "high" :
    "rug";

  return {
    tokenAddress,
    tokenName,
    tokenSymbol,
    overallScore: score,
    riskLevel,
    graduated,
    creatorHoldingPct: holderData.creatorPct,
    top10HoldersPct: holderData.top10Pct,
    holders: holderData.holders,
    washTrading: wash,
    liquidity: {
      riskLevel,
      currentLiquidity: liquidity,
      liquidityChange24h: 0,
      largestRemoval: 0,
      alerts: liquidity < 1 ? ["Critically low liquidity"] : [],
    },
    preDistributed: isPreDistributed,
    flags,
    timestamp: new Date().toISOString(),
  };
}
