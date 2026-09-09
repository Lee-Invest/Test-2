export type TradeSide = "LONG" | "SHORT";

export interface TradeOrderRequest {
  accountId: string;
  symbol: string;
  side: TradeSide;
  volume: number;
}

export interface TradeResult {
  id: string;
  symbol: string;
  side: TradeSide;
  volume: number;
  openPrice: number;
  closePrice: number | null;
  openedAt: Date;
  closedAt: Date | null;
  pnlCents: number | null;
}

export interface AccountSnapshot {
  balanceCents: number;
  equityCents: number;
}

/**
 * Broker/trading-engine abstraction. A real integration (e.g. MetaTrader,
 * cTrader, a prime broker's FIX/REST API) implements this same interface;
 * the rest of the app never needs to know which adapter is in use.
 */
export interface TradingEngineAdapter {
  getAccountSnapshot(accountId: string): Promise<AccountSnapshot>;
  placeOrder(order: TradeOrderRequest): Promise<TradeResult>;
  closeTrade(tradeId: string): Promise<TradeResult>;
  listTrades(accountId: string): Promise<TradeResult[]>;
}
