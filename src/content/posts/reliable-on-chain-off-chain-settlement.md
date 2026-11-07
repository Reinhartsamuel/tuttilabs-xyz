---
title: Reliable On-Chain/Off-Chain Settlement
date: 2026-11-05
summary: How keeper automation and VRF request/fulfillment bridge on-chain randomness with off-chain execution, and where the failure modes live.
slug: reliable-on-chain-off-chain-settlement
---

# Reliable On-Chain/Off-Chain Settlement

The hardest part of a verifiable-randomness application isn't picking a winner. It's making sure the winner actually gets paid, even when the keeper goes down, the RPC node lags, or the transaction reverts mid-settlement.

In the raffle protocol I built, the settlement flow spans two trust boundaries:

1. **On-chain:** The escrow contract holds the prize, the VRF request is submitted, and the randomness is fulfilled back to the contract.
2. **Off-chain:** A keeper service watches for the fulfillment, computes the winner, and triggers the payout.

If either side fails silently, user funds are stuck. Here's how I designed around that.

## The failure modes

| Failure | Symptom | Risk |
|---------|---------|------|
| VRF request submitted, never fulfilled | Prize escrowed, no winner drawn | Funds locked indefinitely |
| VRF fulfilled, keeper misses the event | Winner determined on-chain, never paid | User trusts contract, gets nothing |
| Keeper pays wrong user | Payout goes to incorrect address | Irrecoverable loss of funds |
| Payout transaction reverts | Keeper retries, double-pays | Escrow drained twice |

## The design

### Deterministic winner selection

The contract computes the winner from the VRF randomness modulo the ticket count. This is on-chain, so anyone can verify the result without trusting the keeper. The keeper is only a delivery mechanism, not an authority.

### Keeper as a retrying state machine

The keeper doesn't "decide" anything. It observes the chain and attempts idempotent actions:

1. Poll for fulfilled VRF requests that haven't been paid yet.
2. Compute the winner from on-chain state.
3. Submit the payout transaction.
4. Mark the raffle as paid in a single atomic state transition.

If the payout reverts (insufficient balance, nonce gap), the keeper backs off exponentially and retries. The "paid" flag is only set after the transaction confirms, so a retry never double-pays.

### Invariants the contract enforces

- A raffle can only be paid once (state machine: `open` → `paid` → terminal).
- The payout amount equals the escrowed balance; the keeper cannot skim.
- The winner address is derived solely from VRF output and on-chain ticket data.

## What I'd change next time

I'd add a timeout-based fallback: if no keeper pays within N blocks, anyone can call a `refund` function to return escrowed funds to ticket holders. The keeper is a convenience, not a dependency.

## The through-line

Settlement systems only work when every failure mode has a defined next step. On-chain randomness is the easy part. Keeping money moving when the network hiccups is the engineering problem.

