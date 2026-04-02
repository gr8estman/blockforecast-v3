export type MarketStatus = "open" | "resolved" | "cancelled";
export type Outcome      = "yes" | "no";
export type Category     = "price" | "rug" | "graduation" | "custom";

export interface Market {
  id:           string;
  question:     string;
  description?: string;
  token?:       string;        // associated token mint address (optional)
  tokenSymbol?: string;
  creator:      string;        // wallet address
  yesPool:      number;        // total SOL bet on YES
  noPool:       number;        // total SOL bet on NO
  totalBets:    number;
  status:       MarketStatus;
  outcome?:     Outcome;
  endTime:      string;        // ISO — bets close after this
  resolveTime?: string;
  category:     Category;
  feePct:       number;        // 0.02 = 2% platform fee
  createdAt:    string;
}

export interface Bet {
  id:        string;
  marketId:  string;
  bettor:    string;           // wallet address
  outcome:   Outcome;
  amount:    number;           // SOL
  timestamp: string;
  claimed:   boolean;
  payout?:   number;           // set after resolution
}
