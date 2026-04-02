const HELIUS_API_KEY = process.env.HELIUS_API_KEY!;
const HELIUS_RPC = process.env.HELIUS_RPC_URL || `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

// ─── RPC Helper ───────────────────────────────────────────────────────────────

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Helius RPC ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`);
  return json.result as T;
}

// ─── SOL Balance ──────────────────────────────────────────────────────────────

export async function getSolBalance(address: string): Promise<number> {
  try {
    const lamports = await rpcCall<number>("getBalance", [address]);
    return lamports / 1e9;
  } catch {
    return 0;
  }
}

// ─── Token Accounts (all SPL tokens for a wallet) ────────────────────────────

export interface HeliusTokenAccount {
  mint: string;
  owner: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export async function getTokenAccounts(walletAddress: string): Promise<HeliusTokenAccount[]> {
  try {
    const result = await rpcCall<{
      value: Array<{
        account: {
          data: { parsed: { info: { mint: string; owner: string; tokenAmount: { amount: string; decimals: number; uiAmount: number } } } };
        };
      }>;
    }>("getTokenAccountsByOwner", [
      walletAddress,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]);

    return result.value
      .map((item) => {
        const info = item.account.data.parsed.info;
        return {
          mint: info.mint,
          owner: info.owner,
          amount: parseInt(info.tokenAmount.amount),
          decimals: info.tokenAmount.decimals,
          uiAmount: info.tokenAmount.uiAmount,
        };
      })
      .filter((t) => t.uiAmount > 0);
  } catch {
    return [];
  }
}

// ─── DAS: Token Metadata (name, symbol, image) ────────────────────────────────

export interface HeliusAssetMetadata {
  id: string;
  content: {
    metadata: { name: string; symbol: string; description?: string };
    links?: { image?: string };
    json_uri?: string; // raw metadata URI (IPFS/Arweave/Pinata)
  };
  token_info?: {
    symbol: string;
    supply: number;
    decimals: number;
    price_info?: { price_per_token: number; total_price: number; currency: string };
  };
}

export async function getAssetMetadata(mintAddress: string): Promise<HeliusAssetMetadata | null> {
  try {
    return await rpcCall<HeliusAssetMetadata>("getAsset", [mintAddress]);
  } catch {
    return null;
  }
}

export async function getMultipleAssets(mintAddresses: string[]): Promise<HeliusAssetMetadata[]> {
  if (!mintAddresses.length) return [];
  try {
    return await rpcCall<HeliusAssetMetadata[]>("getAssetBatch", [mintAddresses]);
  } catch {
    return [];
  }
}

// ─── Enhanced Transactions (parsed, human-readable) ───────────────────────────

export interface HeliusParsedTx {
  description: string;
  type: string;
  source: string;
  fee: number;
  feePayer: string;
  signature: string;
  slot: number;
  timestamp: number;
  tokenTransfers: Array<{
    fromTokenAccount: string;
    toTokenAccount: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  events?: {
    swap?: {
      nativeInput?: { account: string; amount: string };
      nativeOutput?: { account: string; amount: string };
      tokenInputs: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
      tokenOutputs: Array<{ userAccount: string; tokenAccount: string; mint: string; rawTokenAmount: { tokenAmount: string; decimals: number } }>;
    };
  };
}

export async function getParsedTransactions(
  signatures: string[]
): Promise<HeliusParsedTx[]> {
  if (!signatures.length) return [];
  try {
    const res = await fetch(
      `${HELIUS_API}/transactions?api-key=${HELIUS_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: signatures }),
      }
    );
    if (!res.ok) throw new Error(`Helius txs ${res.status}`);
    return await res.json();
  } catch {
    return [];
  }
}

// ─── Webhooks: Register for real-time alerts ──────────────────────────────────

export async function createHeliusWebhook(
  webhookUrl: string,
  addresses: string[],
  transactionTypes: string[] = ["SWAP", "TRANSFER"]
) {
  try {
    const res = await fetch(`${HELIUS_API}/webhooks?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhookURL: webhookUrl,
        transactionTypes,
        accountAddresses: addresses,
        webhookType: "enhanced",
      }),
    });
    if (!res.ok) throw new Error(`Helius webhook ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error("[helius webhook]", err);
    return null;
  }
}
