---
title: Stablecoin Deposit-to-Ledger Architecture
date: 2026-11-15
summary: How stablecoin deposits move from on-chain settlement to off-chain ledger credits, and the integrity boundaries between them.
slug: stablecoin-deposit-to-ledger-architecture
---

# Stablecoin Deposit-to-Ledger Architecture

A stablecoin deposit is not a credit. It's a blockchain transaction that your backend must observe, validate, and reflect in an internal ledger. The gap between "tokens arrived on-chain" and "user balance updated off-chain" is where funds disappear.

This note covers the integrity boundaries of a deposit pipeline: confirmation, idempotency, and reconciliation.

## The deposit flow

1. **User deposits USDC to a deposit address** monitored by the backend.
2. **Backend detects the on-chain transfer** via block polling or WebSocket subscription.
3. **Backend validates the transfer:** correct token, correct destination, sufficient confirmations.
4. **Backend credits the user's internal ledger** and marks the deposit as processed.

Each step is a potential failure point. The system must survive all of them without losing or duplicating funds.

## Confirmation boundaries

"Confirmed" means different things at each layer:

- **Mempool:** Transaction broadcast, not yet in a block. Do not credit.
- **First block:** Transaction included, but chain could reorganize. Do not credit for large amounts.
- **K confirmations:** Reorganization economically infeasible. Credit now.

The required confirmation depth depends on the chain and token. For Ethereum-mainnet USDC, 12 blocks (~2 minutes) is a common threshold. For faster chains, fewer blocks may suffice — but the principle is the same: wait for finality appropriate to the amount.

## Idempotency everywhere

A deposit can be detected more than once:
- The WebSocket fires and the block poll also sees it.
- The backend restarts and reprocesses a block range.
- The user deposits the same amount twice to the same address.

Every credit operation must be idempotent keyed by the on-chain transaction hash. If the same transaction hash is seen twice, the second credit is a no-op. The internal ledger records the transaction hash as a unique constraint.

## Reconciliation, not trust

The backend's view of "deposits received" must be reconciled against the blockchain directly:

1. Scan the deposit address for incoming transfers.
2. Compare against the internal ledger of processed deposits.
3. Flag unprocessed on-chain deposits for manual review.
4. Flag ledger credits with no matching on-chain transaction (should never happen; investigate immediately).

Reconciliation runs on a schedule and on startup. It never auto-credits — mismatches go to an alert queue.

## The integrity boundary

The most important rule: **the internal ledger is a cache of on-chain truth, not the source of truth.** If the backend database is corrupted or lost, the system must be able to rebuild the deposit ledger by scanning the blockchain from the deposit address's creation block.

## The through-line

Payments infrastructure fails silently. A deposit that's detected but never credited is as bad as a deposit that's credited twice. The pipeline only works when every step has a defined failure mode and a reconciliation path back to on-chain truth.

