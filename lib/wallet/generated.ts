import { Keypair, Connection, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";
import { GeneratedWallet } from "@/types";

const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("mainnet-beta");

export function generateWallet(): GeneratedWallet {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey),
    balance: 0,
  };
}

export function restoreWallet(secretKeyBase58: string): GeneratedWallet {
  const secretKey = bs58.decode(secretKeyBase58);
  const keypair = Keypair.fromSecretKey(secretKey);
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: secretKeyBase58,
    balance: 0,
  };
}

export async function getSOLBalance(publicKey: string): Promise<number> {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
    const { PublicKey } = await import("@solana/web3.js");
    const pk = new PublicKey(publicKey);
    const lamports = await connection.getBalance(pk);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
}

export function saveWalletToStorage(wallet: GeneratedWallet) {
  if (typeof window === "undefined") return;
  localStorage.setItem("bf_generated_wallet", wallet.secretKey);
}

export function loadWalletFromStorage(): GeneratedWallet | null {
  if (typeof window === "undefined") return null;
  const sk = localStorage.getItem("bf_generated_wallet");
  if (!sk) return null;
  try {
    return restoreWallet(sk);
  } catch {
    return null;
  }
}

export function clearWalletFromStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("bf_generated_wallet");
}
