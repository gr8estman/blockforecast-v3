import { create } from "zustand";
import { Trade, OHLCBar, OrderBook, NewToken } from "@/types";

interface TradingStore {
  // Active token
  activeToken: string | null;
  activeTokenMeta: NewToken | null;
  setActiveToken: (address: string | null, meta?: NewToken | null) => void;

  // Live trades feed
  trades: Trade[];
  addTrade: (trade: Trade) => void;
  clearTrades: () => void;

  // Live price
  livePrice: number;
  priceChange: number;
  setLivePrice: (price: number) => void;

  // OHLC bars
  bars: OHLCBar[];
  setBars: (bars: OHLCBar[]) => void;
  upsertBar: (bar: OHLCBar) => void;

  // Order book (simulated from trades)
  orderBook: OrderBook | null;
  setOrderBook: (ob: OrderBook) => void;

  // Chart interval
  interval: number; // seconds
  setInterval: (seconds: number) => void;
}

export const useTradingStore = create<TradingStore>((set, get) => ({
  activeToken: null,
  activeTokenMeta: null,
  setActiveToken: (address, meta = null) =>
    set({ activeToken: address, activeTokenMeta: meta }),

  trades: [],
  addTrade: (trade) =>
    set((s) => {
      if (s.trades.some((t) => t.id === trade.id)) return s;
      return { trades: [trade, ...s.trades].slice(0, 200) };
    }),
  clearTrades: () => set({ trades: [] }),

  livePrice: 0,
  priceChange: 0,
  setLivePrice: (price) =>
    set((s) => ({
      priceChange: s.livePrice > 0 ? ((price - s.livePrice) / s.livePrice) * 100 : 0,
      livePrice: price,
    })),

  bars: [],
  setBars: (bars) => set({ bars }),
  upsertBar: (bar) =>
    set((s) => {
      const bars = [...s.bars];
      const idx = bars.findIndex((b) => b.time === bar.time);
      if (idx >= 0) {
        // Merge: preserve open, update high/low/close, accumulate volume
        const e = bars[idx];
        bars[idx] = {
          time:   bar.time,
          open:   e.open,
          high:   Math.max(e.high, bar.high),
          low:    Math.min(e.low,  bar.low),
          close:  bar.close,
          volume: e.volume + bar.volume,
        };
      } else {
        bars.push(bar);
      }
      return { bars: bars.sort((a, b) => a.time - b.time).slice(-2000) };
    }),

  orderBook: null,
  setOrderBook: (ob) => set({ orderBook: ob }),

  interval: 60,
  setInterval: (seconds) => set({ interval: seconds }),
}));
