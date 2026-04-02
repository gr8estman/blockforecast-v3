import { create } from "zustand";
import { WalletMode, GeneratedWallet } from "@/types";

interface WalletStore {
  mode: WalletMode;
  isPaperTrading: boolean;
  phantomConnected: boolean;
  phantomAddress: string | null;
  generated: GeneratedWallet | null;
  solBalance: number;

  setMode: (mode: WalletMode) => void;
  togglePaperTrading: () => void;
  setPhantomConnected: (connected: boolean, address: string | null) => void;
  setGeneratedWallet: (wallet: GeneratedWallet | null) => void;
  setSolBalance: (balance: number) => void;
  getActiveAddress: () => string | null;
}

export const useWalletStore = create<WalletStore>((set, get) => ({
  mode: "phantom",
  isPaperTrading: false,
  phantomConnected: false,
  phantomAddress: null,
  generated: null,
  solBalance: 0,

  setMode: (mode) => set({ mode }),
  togglePaperTrading: () => set((s) => ({ isPaperTrading: !s.isPaperTrading })),
  setPhantomConnected: (connected, address) =>
    set({ phantomConnected: connected, phantomAddress: address }),
  setGeneratedWallet: (wallet) => set({ generated: wallet }),
  setSolBalance: (balance) => set({ solBalance: balance }),
  getActiveAddress: () => {
    const { mode, phantomAddress, generated } = get();
    return mode === "phantom" ? phantomAddress : generated?.publicKey ?? null;
  },
}));
