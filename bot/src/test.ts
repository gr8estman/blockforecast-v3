/**
 * Quick test — runs the analyzer + Claude generator without Twitter.
 * Usage:
 *   npm run test <solana_ca>
 *   npm run test 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 */
import "dotenv/config";
import { analyzeToken } from "./analyzer.js";
import { generateTokenReply, generateCryptoReply } from "./generator.js";

const ca = process.argv[2];

if (!ca) {
  // No CA passed → test the general crypto reply path
  console.log("No CA provided — testing general crypto reply...\n");
  const replies = await generateCryptoReply(
    "@BlockForecastBot any alpha on solana right now? what should i ape into?",
  );
  console.log("─────────────────────────────────────");
  console.log("TWEET REPLY:");
  console.log("─────────────────────────────────────");
  replies.forEach((t, i) => console.log(`[Tweet ${i + 1}]\n${t}\n`));
  process.exit(0);
}

console.log(`\n🔍 Analyzing CA: ${ca}`);
console.log(`   BlockForecast URL: ${process.env.BLOCKFORECAST_URL ?? "http://localhost:3000"}\n`);

const analysis = await analyzeToken(ca);

if (!analysis) {
  console.log("❌ Could not fetch token data. Is your Next.js app running?\n");
  console.log("   Start it with: npm run dev  (in the project root)\n");
  process.exit(1);
}

console.log("✅ Token data:");
console.log(`   Symbol    : $${analysis.symbol}`);
console.log(`   Name      : ${analysis.name}`);
console.log(`   Price     : $${analysis.price}`);
console.log(`   Mkt Cap   : $${analysis.marketCap.toLocaleString()}`);
console.log(`   Rug Score : ${analysis.rugScore}/100 (${analysis.riskLevel})`);
console.log(`   Holders   : ${analysis.holders}`);
console.log(`   Flags     : ${analysis.flags.join(", ") || "None"}`);
console.log(`   Smart $   : ${analysis.smartMoney.length} wallets\n`);

console.log("🤖 Generating Claude reply thread...\n");
const replies = await generateTokenReply(analysis);

console.log("─────────────────────────────────────");
console.log("WHAT THE BOT WOULD POST:");
console.log("─────────────────────────────────────");
replies.forEach((t, i) => {
  console.log(`[Tweet ${i + 1}] (${t.length} chars)`);
  console.log(t);
  console.log();
});
