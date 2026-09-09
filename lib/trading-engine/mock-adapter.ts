import { prisma } from "@/lib/prisma";
import type {
  AccountSnapshot,
  TradeOrderRequest,
  TradeResult,
  TradingEngineAdapter,
} from "./types";

/**
 * Simulated trading engine adapter. Reads/writes Trade rows directly in the
 * database rather than talking to a real broker — used for the MVP so the
 * dashboard has real, queryable data without a live market connection.
 * A production broker adapter (MetaTrader/cTrader/FIX) would implement the
 * same TradingEngineAdapter interface and could be swapped in without
 * touching any calling code.
 */
export class MockTradingEngineAdapter implements TradingEngineAdapter {
  async getAccountSnapshot(accountId: string): Promise<AccountSnapshot> {
    const account = await prisma.account.findUniqueOrThrow({ where: { id: accountId } });
    return { balanceCents: account.currentBalanceCents, equityCents: account.currentEquityCents };
  }

  async placeOrder(order: TradeOrderRequest): Promise<TradeResult> {
    const trade = await prisma.trade.create({
      data: {
        accountId: order.accountId,
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        openPrice: 1,
        openedAt: new Date(),
      },
    });
    return toTradeResult(trade);
  }

  async closeTrade(tradeId: string): Promise<TradeResult> {
    const trade = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } });
    const closePrice = Number(trade.openPrice) * (1 + (Math.random() - 0.5) * 0.02);
    const pnlCents = Math.round((closePrice - Number(trade.openPrice)) * Number(trade.volume) * 10000);

    const updated = await prisma.trade.update({
      where: { id: tradeId },
      data: { closePrice, closedAt: new Date(), pnlCents },
    });
    return toTradeResult(updated);
  }

  async listTrades(accountId: string): Promise<TradeResult[]> {
    const trades = await prisma.trade.findMany({ where: { accountId }, orderBy: { openedAt: "desc" } });
    return trades.map(toTradeResult);
  }
}

function toTradeResult(trade: {
  id: string;
  symbol: string;
  side: string;
  volume: unknown;
  openPrice: unknown;
  closePrice: unknown;
  openedAt: Date;
  closedAt: Date | null;
  pnlCents: number | null;
}): TradeResult {
  return {
    id: trade.id,
    symbol: trade.symbol,
    side: trade.side as "LONG" | "SHORT",
    volume: Number(trade.volume),
    openPrice: Number(trade.openPrice),
    closePrice: trade.closePrice != null ? Number(trade.closePrice) : null,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    pnlCents: trade.pnlCents,
  };
}

export const tradingEngine = new MockTradingEngineAdapter();
