import { Order, Position, PortfolioSummary, TradeSide, OrderType } from "@/types";

const STORAGE_KEY = "bf_paper_trades";
const POSITIONS_KEY = "bf_paper_positions";
const BALANCE_KEY = "bf_paper_balance";

const DEFAULT_PAPER_BALANCE = 1000; // $1000 virtual USD

// ─── Storage Helpers ──────────────────────────────────────────────────────────

function loadOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function loadPositions(): Record<string, Position> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(POSITIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function savePositions(positions: Record<string, Position>) {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

export function getPaperBalance(): number {
  if (typeof window === "undefined") return DEFAULT_PAPER_BALANCE;
  const stored = localStorage.getItem(BALANCE_KEY);
  return stored ? parseFloat(stored) : DEFAULT_PAPER_BALANCE;
}

export function setPaperBalance(amount: number) {
  localStorage.setItem(BALANCE_KEY, amount.toString());
}

export function resetPaperTrading() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(POSITIONS_KEY);
  localStorage.setItem(BALANCE_KEY, DEFAULT_PAPER_BALANCE.toString());
}

// ─── Order Execution ──────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  side: TradeSide;
  type: OrderType;
  amountUsd: number;
  currentPriceUsd: number;
  limitPrice?: number;
}

export function placePaperOrder(params: PlaceOrderParams): {
  success: boolean;
  order?: Order;
  error?: string;
} {
  const balance = getPaperBalance();
  const price = params.type === "limit" ? (params.limitPrice ?? params.currentPriceUsd) : params.currentPriceUsd;

  if (params.side === "buy" && params.amountUsd > balance) {
    return { success: false, error: "Insufficient paper balance" };
  }

  const tokenAmount = params.amountUsd / price;

  // Check sell: need enough tokens
  if (params.side === "sell") {
    const positions = loadPositions();
    const pos = positions[params.tokenAddress];
    if (!pos || pos.amount < tokenAmount) {
      return { success: false, error: "Insufficient token balance" };
    }
  }

  const order: Order = {
    id: `paper_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    tokenAddress: params.tokenAddress,
    tokenSymbol: params.tokenSymbol,
    side: params.side,
    type: params.type,
    amount: tokenAmount,
    price: price,
    status: "filled",
    isPaper: true,
    createdAt: new Date().toISOString(),
    filledAt: new Date().toISOString(),
  };

  // Update balance
  if (params.side === "buy") {
    setPaperBalance(balance - params.amountUsd);
  } else {
    setPaperBalance(balance + params.amountUsd);
  }

  // Update positions
  const positions = loadPositions();
  const existing = positions[params.tokenAddress];

  if (params.side === "buy") {
    if (existing) {
      // Average down/up
      const totalCost = existing.entryPrice * existing.amount + price * tokenAmount;
      const totalAmount = existing.amount + tokenAmount;
      positions[params.tokenAddress] = {
        ...existing,
        amount: totalAmount,
        entryPrice: totalCost / totalAmount,
        currentPrice: price,
        valueUsd: totalAmount * price,
        pnl: 0,
        pnlPct: 0,
      };
    } else {
      positions[params.tokenAddress] = {
        tokenAddress: params.tokenAddress,
        tokenSymbol: params.tokenSymbol,
        tokenName: params.tokenName,
        amount: tokenAmount,
        entryPrice: price,
        currentPrice: price,
        pnl: 0,
        pnlPct: 0,
        valueUsd: params.amountUsd,
        isPaper: true,
      };
    }
  } else {
    if (existing) {
      const remaining = existing.amount - tokenAmount;
      if (remaining <= 0.0001) {
        delete positions[params.tokenAddress];
      } else {
        positions[params.tokenAddress] = { ...existing, amount: remaining, valueUsd: remaining * price };
      }
    }
  }

  savePositions(positions);

  // Save order
  const orders = loadOrders();
  orders.unshift(order);
  saveOrders(orders.slice(0, 500)); // Keep last 500

  return { success: true, order };
}

// ─── Portfolio Getters ────────────────────────────────────────────────────────

export function getPaperPositions(): Position[] {
  return Object.values(loadPositions());
}

export function getPaperOrders(): Order[] {
  return loadOrders();
}

export function updatePositionPrices(prices: Record<string, number>) {
  const positions = loadPositions();
  for (const [addr, price] of Object.entries(prices)) {
    if (positions[addr]) {
      const pos = positions[addr];
      pos.currentPrice = price;
      pos.valueUsd = pos.amount * price;
      pos.pnl = (price - pos.entryPrice) * pos.amount;
      pos.pnlPct = ((price - pos.entryPrice) / pos.entryPrice) * 100;
    }
  }
  savePositions(positions);
}
