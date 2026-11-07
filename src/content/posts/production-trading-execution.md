---
title: Production Trading Execution
date: 2026-11-10
summary: Order lifecycle management, position tracking, and reconciliation across CEX exchange APIs — partial fills, rate limits, and execution failure handling.
slug: production-trading-execution
---

# Production Trading Execution

Connecting to a centralized exchange is straightforward. Keeping positions correct when the API rate-limits you, a fill arrives out of order, or the WebSocket drops mid-trade is where most trading backends break.

I built backend services routing signals to Gate, OKX, and Hyperliquid through their exchange APIs. The system manages the full order lifecycle: entry, partial fills, take-profit exits, PnL settlement, and reconciliation. Here's what actually matters in production.

## Order lifecycle, not just order placement

Most examples show `POST /order` and stop there. In production, an order passes through states your backend must track:

```
new → partially_filled → filled → cancelled → rejected
```

A partial fill is not a failure — it's the normal path. The backend must:
- Track cumulative filled quantity vs. ordered quantity.
- Reconcile each fill event against the local order state.
- Only emit a take-profit exit once the full position is open.
- Handle a fill arriving after the order was already cancelled locally.

## Position tracking is source of truth

Exchange APIs are eventually consistent. Your local position ledger must be authoritative, with the exchange as a reconciliation target — not the reverse.

On every fill, the backend:
1. Writes the fill to the local position ledger (idempotent on fill ID).
2. Updates average entry price and position size.
3. Recomputes unrealized PnL.
4. Evaluates exit conditions against the local position, not the exchange's last-known state.

If the exchange disagrees with your ledger, the reconciliation job flags it — it doesn't silently overwrite.

## Reconciliation loop

Every N minutes, the system reconciles against each exchange:
- Open orders: local vs. exchange.
- Positions: local vs. exchange.
- Balances: local vs. exchange.

Mismatches are logged and alerted, not auto-corrected. Auto-correcting a balance discrepancy can mask a bug that drains the account. The reconciliation output feeds an alert queue; a human decides whether to intervene.

## Failure handling

| Failure | Mitigation |
|---------|------------|
| API rate limit | Exponential backoff with per-endpoint buckets; queue requests rather than drop them |
| WebSocket disconnect | Reconnect with heartbeat; replay missed events from the last known sequence |
| Partial fill at wrong price | Reject fills outside tolerance; alert for manual review |
| Payout/withdrawal retry | Idempotency keys on withdrawal requests; never retry blindly |

## The through-line

Trading systems fail in distributed ways. The backend's job isn't to send orders — it's to know, at every moment, exactly what position it holds and why. Reconciliation isn't an audit feature; it's the primary control.

