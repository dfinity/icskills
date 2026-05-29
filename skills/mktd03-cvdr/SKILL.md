---
name: mktd03-cvdr
description: "Integrates MKTd03 on the Internet Computer to issue Cryptographically Verifiable Deletion Receipts (CVDRs) from Rust canisters using sparse Merkle tree tombstone evidence. Use for verifiable deletion, CVDRs, tombstone proofs, deletion receipts, audit evidence, erasure evidence, or GDPR-supporting deletion workflows on ICP. Do NOT use for ordinary deletion without receipts, MKTd02 leaf-mode receipts, generic stable memory, Internet Identity, wallet integration, or general canister security hardening."
license: Apache-2.0
compatibility: "Rust canister on ICP, dfx or icp-cli available, network access for mainnet deployment and certification verification"
metadata:
  title: "MKTd03 CVDR"
  category: Integration
---

# MKTd03 CVDR

MKTd03 is a Rust protocol/library for issuing Cryptographically Verifiable Deletion Receipts from Internet Computer canisters. It uses sparse Merkle tree evidence to prove a bounded tombstone transition for a target record relative to pre-state and post-state commitments.

Use this skill when an ICP Rust canister needs verifiable deletion receipts, tombstone evidence, CVDR generation, audit evidence, or GDPR-supporting erasure records.

Do not use this skill for ordinary deletion without receipt generation, generic StableBTreeMap setup, Internet Identity login, wallet integration, or general canister hardening.

## Prerequisites

- Rust ICP canister.
- dfx or icp-cli available.
- MKTd03 integrated as a Rust crate dependency.
- Host canister owns application state and passes bounded protocol inputs to MKTd03.
- Library and SDK versions must be pinned from the integrating repository before generating final code.

## Integration Boundary

Use MKTd03 as an embedded protocol engine. The host canister decides what application event occurred and supplies bounded protocol inputs.

The host adapter derives subject_reference, scope_reference, transition_material, and deletion_state_material.

Keep raw PII and high-level application semantics outside the MKTd03 preimage unless a later design explicitly authorizes them.

## Local vs Mainnet Evidence

A CVDR generated against local dfx is demo/development evidence only. Local replica certificate material is not production cryptographic evidence and must not be presented as mainnet-grade proof.

For local demos, display: DEMO — local replica evidence only; this CVDR is not cryptographically authenticated by an IC mainnet subnet.

## Common Pitfalls

- Do not invent a receipt_id API. Use the actual MKTd03 host API from the pinned crate version.
- Do not put raw PII into CVDR preimages.
- Do not treat local dfx certificate material as production proof.
- Do not claim GDPR compliance solely from a CVDR.
- Do not conflate tombstoning with physical erasure.
- Do not make MKTd03 dApp-specific.
- Do not expose full receipt payloads publicly by default.
- Do not skip version pinning.

## Verify It Works

- The host canister builds for wasm32-unknown-unknown.
- The adapter accepts bounded CVDR inputs, not raw user profile data.
- The generated receipt path uses the actual pinned MKTd03 API.
- Local demo receipts are labelled as local/demo evidence.
- The implementation does not claim GDPR compliance solely from issuing a CVDR.
