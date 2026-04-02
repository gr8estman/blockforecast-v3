import { NextRequest, NextResponse } from "next/server";
import { bitqueryFetch } from "@/lib/bitquery/client";

const UNIVERSAL_SEARCH = `
  query UniversalSearch($address: String!) {
    eth_token: EVM(network: eth) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    eth_pool: EVM(network: eth) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          PoolId
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName SmartContract Pair { SmartContract } }
        }
      }
    }
    eth_trader: EVM(network: eth) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    bsc_token: EVM(network: bsc) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    bsc_pool: EVM(network: bsc) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          PoolId
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    bsc_trader: EVM(network: bsc) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    base_token: EVM(network: base) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    base_pool: EVM(network: base) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          PoolId
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    base_trader: EVM(network: base) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    arbitrum_token: EVM(network: arbitrum) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    arbitrum_pool: EVM(network: arbitrum) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          PoolId
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    arbitrum_trader: EVM(network: arbitrum) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    matic_token: EVM(network: matic) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    matic_pool: EVM(network: matic) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          PoolId
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    matic_trader: EVM(network: matic) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    optimism_token: EVM(network: optimism) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    optimism_pool: EVM(network: eth) {
      DEXTradeByTokens(
        where: {any: [{Trade: {Dex: {SmartContract: {is: $address}}}}, {Trade: {Dex: {Pair: {SmartContract: {is: $address}}}}}, {Trade: {PoolId: {is: $address}}}]}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          PoolId
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    optimism_trader: EVM(network: eth) {
      DEXTradeByTokens(
        where: {Transaction: {From: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    solana_token: Solana(network: solana) {
      DEXTradeByTokens(
        where: {Trade: {Currency: {MintAddress: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name MintAddress }
          Dex { ProtocolName ProtocolFamily ProgramAddress }
          Market { MarketAddress }
        }
      }
    }
    solana_pool: Solana(network: solana) {
      DEXTradeByTokens(
        where: {Trade: {Market: {MarketAddress: {is: $address, not: ""}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name MintAddress }
          Side { Currency { Symbol Name MintAddress } }
          Dex { ProtocolName ProtocolFamily ProgramAddress }
          Market { MarketAddress }
        }
      }
    }
    solana_trader: Solana(network: solana) {
      DEXTradeByTokens(
        where: {Trade: {Account: {Owner: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
    tron_token: Tron {
      DEXTradeByTokens(
        where: {Trade: {Currency: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    tron_pool: Tron {
      DEXTradeByTokens(
        where: {Trade: {Dex: {SmartContract: {is: $address}}}}
        limit: {count: 1}
      ) {
        Trade {
          Currency { Symbol Name SmartContract }
          Side { Currency { Symbol Name SmartContract } }
          Dex { ProtocolName ProtocolFamily SmartContract }
        }
      }
    }
    tron_trader: Tron {
      DEXTradeByTokens(
        where: {Transaction: {FeePayer: {is: $address}}}
        limit: {count: 1}
      ) {
        Trade { Currency { Symbol Name } }
      }
    }
  }
`;

export interface SearchResult {
  network: string;
  type: "token" | "pool" | "trader";
  symbol: string;
  name: string;
  address: string;  // token mint / contract address (for terminal navigation)
  dex?: string;
  navigable: boolean; // Solana tokens/pools → can open in terminal
}

const NETWORKS = ["eth", "bsc", "base", "arbitrum", "matic", "optimism", "solana", "tron"] as const;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  if (address.length < 10) {
    return NextResponse.json({ results: [] });
  }

  try {
    const data = await bitqueryFetch<Record<string, unknown>>(
      UNIVERSAL_SEARCH,
      { address },
      false,
      20_000
    );

    const results: SearchResult[] = [];

    for (const net of NETWORKS) {
      const isSolana = net === "solana";

      // ── Token ──────────────────────────────────────────────────────────────
      const tokenTrade = (data[`${net}_token`] as any)?.DEXTradeByTokens?.[0]?.Trade;
      if (tokenTrade) {
        const tokenAddr = isSolana
          ? tokenTrade.Currency?.MintAddress
          : tokenTrade.Currency?.SmartContract;
        results.push({
          network: net,
          type: "token",
          symbol: tokenTrade.Currency?.Symbol ?? "UNKNOWN",
          name:   tokenTrade.Currency?.Name   ?? "",
          address: tokenAddr ?? address,
          dex:    tokenTrade.Dex?.ProtocolName,
          navigable: isSolana,
        });
      }

      // ── Pool ───────────────────────────────────────────────────────────────
      const poolTrade = (data[`${net}_pool`] as any)?.DEXTradeByTokens?.[0]?.Trade;
      if (poolTrade) {
        const baseSymbol = poolTrade.Currency?.Symbol ?? "?";
        const quoteSymbol = poolTrade.Side?.Currency?.Symbol ?? "?";
        const tokenAddr = isSolana
          ? poolTrade.Currency?.MintAddress
          : poolTrade.Currency?.SmartContract;
        results.push({
          network: net,
          type: "pool",
          symbol: `${baseSymbol}/${quoteSymbol}`,
          name:   poolTrade.Currency?.Name ?? "",
          address: tokenAddr ?? address,
          dex:    poolTrade.Dex?.ProtocolName,
          navigable: isSolana,
        });
      }

      // ── Trader ─────────────────────────────────────────────────────────────
      const traderTrade = (data[`${net}_trader`] as any)?.DEXTradeByTokens?.[0]?.Trade;
      if (traderTrade) {
        results.push({
          network: net,
          type: "trader",
          symbol: traderTrade.Currency?.Symbol ?? "?",
          name:   traderTrade.Currency?.Name   ?? "",
          address, // keep original wallet address
          dex: undefined,
          navigable: false,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[search]", err);
    return NextResponse.json({ results: [], error: "Search failed" }, { status: 500 });
  }
}
