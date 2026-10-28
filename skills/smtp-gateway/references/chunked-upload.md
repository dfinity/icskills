# Chunked Upload

Optional extension of the SMTP gateway protocol for messages that do not fit one ingress call (~2 MiB). A canister that does not implement it keeps receiving `smtp_request` as before. Oversize mail for it is refused with a permanent error, and the sender gets a normal bounce.

## When the gateway uses it

- The encoded `SmtpRequest` is larger than 2,097,152 bytes, **and** `smtp_capabilities` returned both `upload_protocol_version >= 1` and `max_message_size > 0`. The check fails closed: a missing field, `0`, or no `smtp_capabilities` method at all means single-call delivery only.
- The gateway queries `smtp_capabilities` during `RCPT TO`, concurrently with `smtp_request_validate`, and caches the answer for 10 minutes. A missing method is cached as "no chunked upload".
- When the sender declared the message size up front (`SIZE=` on `MAIL FROM`), an oversize message is refused at `RCPT TO` with `552 5.3.4 Recipient accepts at most <limit> bytes.`, where the limit is your advertised `max_message_size` or 2,097,152 for a canister without chunked upload.
- Too large for a canister without chunked upload: `550 5.5.0 Permanent delivery error: message is too large (<n> bytes encoded, limit is 2097152) and canister <id> does not support chunked upload`.
- The gateway enforces your advertised `max_message_size` only on this path. Enforce it yourself too, with 552.
- By default the gateway accepts at most 1,996,800 bytes per message (header block and body together), so with default settings chunked upload is rarely triggered.

## What the gateway sends

- Every chunk repeats `version`, `message_id`, `envelope`, `total_chunks`, `chunk_size` and `body_size`. `headers` and `gateway_flags` are only on chunk 0. `message_id` is the same per-transaction UUIDv7 as in `smtp_request`.
- `chunk_size` is at most 1 MiB. Headers are never split, and a header block too large to leave 256 KiB of payload in chunk 0 is a permanent failure.
- Up to 2 chunks per canister are in flight at once (16 across all canisters), so chunks arrive **in any order**. A failed chunk is retried up to twice (after 250 ms and 500 ms; after 2 s and 4 s on a 429 or 503).
- `smtp_upload_commit` is sent exactly once. If its reply is lost (timeout or transport error), the gateway makes **one** `smtp_upload_status` query. A committed upload with an `Ok` result counts as delivered, and a committed `Err` is mapped by its class. Anything else is reported as temporary (450), and the sending server retries the whole message later with a new `message_id`.
- `smtp_upload_abort` is fire-and-forget, sent when the gateway gives up on a chunk. Never rely on it: expire uncommitted uploads yourself.
- The whole delivery is bounded by 90 seconds. The gateway never re-sends a commit, so a retained verdict only has to outlive that window. Keep it for a few minutes.

## Obligations

| The canister must | Code if violated |
|---|---|
| Reject a `version` it does not implement, on both chunk and commit | 504 |
| Recompute `SHA256(payload)` and compare it with `payload_sha256` **before** storing the chunk | 554 |
| Check `total_chunks == ceil(body_size / chunk_size)` and `index < total_chunks`, and bound `total_chunks` **before** any allocation or offset arithmetic (`chunk_size = 1` with `total_chunks = 4_000_000_000` is an allocation attack) | 554 |
| Check the payload length: `min(chunk_size, body_size - index * chunk_size)` | 554 |
| Reject a chunk that disagrees with the upload already in progress under the same `message_id`, including a resent index with different bytes | 450 (a collision is worth retrying) |
| Accept an identical resend of a chunk as a no-op | — |
| Keep the upload when a commit arrives before all chunks: the rest may still come | 450 |
| Derive the commit digest from the payloads **it stored**, never from the caller's `payload_sha256` values | 554 on mismatch |
| Make `smtp_upload_commit` idempotent: retain the verdict per `message_id` and return it for a repeated commit and from `smtp_upload_status` | — |
| Return 530 for an unauthorized caller; a trap is retried | 530 |
| Cap concurrent uploads and buffered bytes, and expire uploads that are never committed | 452 |

The commit digest is `body_sha256 = SHA256(d_0 || d_1 || ... || d_{n-1})` with `d_i = SHA256(payload_i)`, in index order: it hashes 32 bytes per chunk, not the body again. It depends on `chunk_size`, so it checks the transfer, not the content: never use it to deduplicate mail. Compute it with the crate's `ic_smtp_gateway_protocol::body_sha256(&digests)` so that both sides use the same construction.

The chunked Candid types, unlike `SmtpRequest`, use required fields on purpose: a malformed chunk fails to decode instead of arriving as an empty record. Counter widths are exact (`index : nat32`; a `nat64` does not decode).

```candid
type SmtpCapabilities = record {
  upload_protocol_version : opt nat32;
  max_message_size : opt nat64;   // header block + body, in bytes
};
type SmtpUploadChunk = record {
  version : nat32;
  message_id : text;
  envelope : Envelope;
  index : nat32;                   // 0-based
  total_chunks : nat32;
  chunk_size : nat64;              // payload length of every chunk but the last
  body_size : nat64;
  payload_sha256 : blob;           // 32 bytes
  payload : blob;
  headers : opt vec Header;        // chunk 0 only
  gateway_flags : opt vec text;    // chunk 0 only
};
type SmtpUploadChunkOk = record { chunks_received : nat32 };
type SmtpUploadChunkResponse = variant { Ok : SmtpUploadChunkOk; Err : SmtpRequestError };
type SmtpUploadCommit = record {
  version : nat32;
  message_id : text;
  body_sha256 : blob;
  total_chunks : nat32;
};
type SmtpUploadId = record { message_id : text };
type SmtpUploadStatus = record { known : bool; committed : bool; result : opt SmtpResponse };
type SmtpUploadStatusResponse = variant { Ok : SmtpUploadStatus; Err : SmtpRequestError };

// service additions
smtp_capabilities : () -> (SmtpCapabilities) query;
smtp_upload_chunk : (SmtpUploadChunk) -> (SmtpUploadChunkResponse);
smtp_upload_commit : (SmtpUploadCommit) -> (SmtpResponse);
smtp_upload_status : (SmtpUploadId) -> (SmtpUploadStatusResponse) query;
smtp_upload_abort : (SmtpUploadId) -> (SmtpResponse);
```

## Rust implementation

This module sits next to the Rust example in `SKILL.md` and reuses its `check_caller` (gateway principal or controller, else 530) and `check_envelope`. Every chunked method runs the caller check first. Add `sha2 = "0.11"` to `[dependencies]`.

`ic_cdk::export_candid!()` resolves method signature types at the **crate root**. Methods in a submodule whose types are not imported in `lib.rs` fail with `cannot find type SmtpUploadChunk in this scope`. Add this to the top of `lib.rs`:

```rust
// export_candid!() resolves method signature types at the crate root, so the
// types of the methods in `chunked` must be in scope here too.
use ic_smtp_gateway_protocol::{
    SmtpCapabilities, SmtpUploadChunk, SmtpUploadChunkResponse, SmtpUploadCommit, SmtpUploadId,
    SmtpUploadStatusResponse,
};

mod chunked;
```

`src/chunked.rs`:

```rust
// Chunked upload: the optional methods for messages over the ~2 MiB ingress
// limit. Sits next to the `smtp_request` example and reuses its
// `check_envelope`.
use std::{cell::RefCell, collections::HashMap};

use candid::Principal;
use ic_cdk::{
    api::{msg_caller, time},
    query, update,
};
use ic_smtp_gateway_protocol::{
    body_sha256, Envelope, Header, SmtpCapabilities, SmtpOk, SmtpRequestError, SmtpResponse,
    SmtpUploadChunk, SmtpUploadChunkOk, SmtpUploadChunkResponse, SmtpUploadCommit, SmtpUploadId,
    SmtpUploadStatus, SmtpUploadStatusResponse, SHA256_LEN, SMTP_UPLOAD_PROTOCOL_VERSION,
};
use sha2::{Digest, Sha256};

use crate::{check_caller, check_envelope};

const MAX_MESSAGE_SIZE: u64 = 20 * 1024 * 1024; // advertise only what you enforce
const MAX_CHUNKS: u32 = 4096;
const MAX_OPEN_UPLOADS: usize = 16;
const MAX_BUFFERED_BYTES: u64 = 128 * 1024 * 1024;
const TTL_NS: u64 = 10 * 60 * 1_000_000_000; // must exceed the gateway's 90 s delivery window

struct Upload {
    envelope: Envelope,
    headers: Option<Vec<Header>>,
    total_chunks: u32,
    chunk_size: u64,
    body_size: u64,
    buf: Vec<u8>,                           // pre-sized; chunk i lands at i * chunk_size
    digests: Vec<Option<[u8; SHA256_LEN]>>, // computed HERE, never copied from the caller
    received: u32,
    created_ns: u64,
}

// Keyed by (caller, message_id) so another principal cannot touch the
// gateway's uploads.
type Key = (Principal, String);

thread_local! {
    static UPLOADS: RefCell<HashMap<Key, Upload>> = RefCell::default();
    static VERDICTS: RefCell<HashMap<Key, (SmtpResponse, u64)>> = RefCell::default();
}

fn e(code: u64, message: &str) -> SmtpRequestError {
    SmtpRequestError {
        code,
        message: message.to_string(),
    }
}

/// Header block (re-serialized as `Name:value` + CRLF) plus body.
fn message_size(headers: &[Header], body_size: u64) -> u64 {
    headers
        .iter()
        .map(|h| (h.name.len() + h.value.len() + 3) as u64)
        .fold(2, u64::saturating_add)
        .saturating_add(body_size)
}

fn sweep(now: u64) {
    UPLOADS.with_borrow_mut(|u| u.retain(|_, up| now.saturating_sub(up.created_ns) < TTL_NS));
    VERDICTS.with_borrow_mut(|v| v.retain(|_, (_, at)| now.saturating_sub(*at) < TTL_NS));
}

fn reserved_bytes() -> u64 {
    UPLOADS.with_borrow(|u| u.values().map(|up| up.body_size).sum())
}

/// Hand the reassembled message to the same code path `smtp_request` uses.
fn deliver(_env: Envelope, _headers: Vec<Header>, _body: Vec<u8>) -> SmtpResponse {
    SmtpResponse::Ok(SmtpOk {})
}

#[query]
fn smtp_capabilities() -> SmtpCapabilities {
    SmtpCapabilities {
        upload_protocol_version: Some(SMTP_UPLOAD_PROTOCOL_VERSION),
        max_message_size: Some(MAX_MESSAGE_SIZE),
    }
}

/// Every rejection is a returned verdict: a trap reads as "temporary" and
/// the sender retries a malformed chunk forever.
fn validate_chunk(c: &SmtpUploadChunk) -> Result<[u8; SHA256_LEN], SmtpRequestError> {
    if let Err(SmtpResponse::Err(rejected)) = check_caller() {
        return Err(rejected);
    }
    if c.version != SMTP_UPLOAD_PROTOCOL_VERSION {
        return Err(e(504, "unsupported upload protocol version"));
    }
    // Verify BEFORE storing: a corrupt transfer costs one chunk, not the upload.
    let digest: [u8; SHA256_LEN] = Sha256::digest(&c.payload).into();
    if c.payload_sha256.as_slice() != digest.as_slice() {
        return Err(e(554, "chunk digest mismatch"));
    }
    // Layout must be self-consistent BEFORE any offset arithmetic or
    // allocation: chunk_size = 1, total_chunks = 4e9 would otherwise allocate.
    if c.chunk_size == 0
        || c.total_chunks == 0
        || c.total_chunks > MAX_CHUNKS
        || c.body_size.div_ceil(c.chunk_size) != u64::from(c.total_chunks)
        || c.index >= c.total_chunks
    {
        return Err(e(554, "malformed chunk layout"));
    }
    let expected_len = u64::from(c.index)
        .checked_mul(c.chunk_size)
        .and_then(|offset| c.body_size.checked_sub(offset))
        .map(|left| left.min(c.chunk_size));
    if expected_len != Some(c.payload.len() as u64) {
        return Err(e(554, "chunk payload has the wrong length"));
    }
    if c.index == 0 && c.headers.is_none() {
        return Err(e(554, "the first chunk must carry the headers"));
    }
    let headers = c.headers.as_deref().unwrap_or_default();
    if message_size(headers, c.body_size) > MAX_MESSAGE_SIZE {
        return Err(e(552, "message exceeds the advertised maximum size"));
    }
    if let Err(SmtpResponse::Err(rejected)) = check_envelope(&c.envelope) {
        return Err(rejected);
    }
    Ok(digest)
}

#[update]
fn smtp_upload_chunk(c: SmtpUploadChunk) -> SmtpUploadChunkResponse {
    let digest = match validate_chunk(&c) {
        Ok(d) => d,
        Err(err) => return SmtpUploadChunkResponse::Err(err),
    };
    let key = (msg_caller(), c.message_id.clone());
    let now = time();

    // Already committed: report complete rather than reopening the upload.
    if VERDICTS.with_borrow(|v| v.contains_key(&key)) {
        return SmtpUploadChunkResponse::Ok(SmtpUploadChunkOk {
            chunks_received: c.total_chunks,
        });
    }

    if !UPLOADS.with_borrow(|u| u.contains_key(&key)) {
        sweep(now);
        if UPLOADS.with_borrow(|u| u.len()) >= MAX_OPEN_UPLOADS
            || reserved_bytes().saturating_add(c.body_size) > MAX_BUFFERED_BYTES
        {
            return SmtpUploadChunkResponse::Err(e(452, "too many uploads in progress"));
        }
        // body_size <= MAX_MESSAGE_SIZE was checked, so this fits a wasm32 usize.
        UPLOADS.with_borrow_mut(|u| {
            u.insert(
                key.clone(),
                Upload {
                    envelope: c.envelope.clone(),
                    headers: None,
                    total_chunks: c.total_chunks,
                    chunk_size: c.chunk_size,
                    body_size: c.body_size,
                    buf: vec![0; c.body_size as usize],
                    digests: vec![None; c.total_chunks as usize],
                    received: 0,
                    created_ns: now,
                },
            )
        });
    }

    UPLOADS.with_borrow_mut(|u| {
        let up = u.get_mut(&key).expect("present");
        // Same message_id, different message: transient, worth a retry.
        if (up.total_chunks, up.chunk_size, up.body_size)
            != (c.total_chunks, c.chunk_size, c.body_size)
            || up.envelope != c.envelope
        {
            return SmtpUploadChunkResponse::Err(e(450, "chunk does not match the upload"));
        }
        let slot = c.index as usize;
        // Idempotent in (message_id, index): an identical resend changes nothing.
        if let Some(prev) = up.digests[slot] {
            if prev != digest || (c.index == 0 && up.headers != c.headers) {
                return SmtpUploadChunkResponse::Err(e(450, "chunk does not match the upload"));
            }
            return SmtpUploadChunkResponse::Ok(SmtpUploadChunkOk {
                chunks_received: up.received,
            });
        }
        let offset = slot * up.chunk_size as usize;
        up.buf[offset..offset + c.payload.len()].copy_from_slice(&c.payload);
        if c.index == 0 {
            up.headers = c.headers;
        }
        up.digests[slot] = Some(digest);
        up.received += 1;
        SmtpUploadChunkResponse::Ok(SmtpUploadChunkOk {
            chunks_received: up.received,
        })
    })
}

#[update]
fn smtp_upload_commit(commit: SmtpUploadCommit) -> SmtpResponse {
    if let Err(rejected) = check_caller() {
        return rejected;
    }
    if commit.version != SMTP_UPLOAD_PROTOCOL_VERSION {
        return SmtpResponse::Err(e(504, "unsupported upload protocol version"));
    }
    let key = (msg_caller(), commit.message_id.clone());

    // Idempotent: a repeated commit returns the retained verdict.
    if let Some((verdict, _)) = VERDICTS.with_borrow(|v| v.get(&key).cloned()) {
        return verdict;
    }

    let complete = UPLOADS.with_borrow(|u| match u.get(&key) {
        None => Err(e(450, "unknown upload")),
        // Incomplete is transient and must NOT discard the upload.
        Some(up)
            if up.received != commit.total_chunks || up.total_chunks != commit.total_chunks =>
        {
            Err(e(450, "upload is incomplete"))
        }
        Some(_) => Ok(()),
    });
    if let Err(err) = complete {
        return SmtpResponse::Err(err);
    }

    let up = UPLOADS
        .with_borrow_mut(|u| u.remove(&key))
        .expect("present");
    // Derive the chain from the digests of the bytes WE stored.
    let digests: Vec<[u8; SHA256_LEN]> = up.digests.iter().map(|d| d.expect("complete")).collect();
    let verdict = if body_sha256(&digests).as_slice() != commit.body_sha256.as_slice() {
        SmtpResponse::Err(e(554, "body digest mismatch"))
    } else {
        deliver(up.envelope, up.headers.unwrap_or_default(), up.buf)
    };
    VERDICTS.with_borrow_mut(|v| v.insert(key, (verdict.clone(), time())));
    verdict
}

#[query]
fn smtp_upload_status(id: SmtpUploadId) -> SmtpUploadStatusResponse {
    if let Err(SmtpResponse::Err(rejected)) = check_caller() {
        return SmtpUploadStatusResponse::Err(rejected);
    }
    let key = (msg_caller(), id.message_id);
    if let Some((verdict, _)) = VERDICTS.with_borrow(|v| v.get(&key).cloned()) {
        return SmtpUploadStatusResponse::Ok(SmtpUploadStatus {
            known: true,
            committed: true,
            result: Some(verdict),
        });
    }
    SmtpUploadStatusResponse::Ok(SmtpUploadStatus {
        known: UPLOADS.with_borrow(|u| u.contains_key(&key)),
        committed: false,
        result: None,
    })
}

#[update]
fn smtp_upload_abort(id: SmtpUploadId) -> SmtpResponse {
    if let Err(rejected) = check_caller() {
        return rejected;
    }
    UPLOADS.with_borrow_mut(|u| u.remove(&(msg_caller(), id.message_id)));
    SmtpResponse::Ok(SmtpOk {}) // idempotent: aborting a missing upload is fine
}
```

Notes:

- State is keyed by `(caller, message_id)` rather than by `message_id` alone, so that another principal cannot collide with, or probe, the gateway's uploads.
- Uploads live on the heap. An upgrade in the middle of an upload loses it: the commit then gets 450 and the sending server retries the whole message. That is acceptable. A production canister handling many large messages should buffer chunks in stable memory (`stable-memory` skill).
- `deliver` is a stub: route the reassembled message into the same storage and logic as `smtp_request`.

## Test it locally

The body `hello world` split into `"hello "` and `"world"` (`chunk_size = 6`, `body_size = 11`) has these digests, written as Candid blob literals:

```bash
D0='\5e\32\35\a8\34\6e\5a\45\85\f8\c5\85\62\f5\05\2b\8f\e2\6a\3b\b1\22\e1\e9\6c\76\78\49\64\df\c4\61'      # SHA256("hello ")
D1='\48\6e\a4\62\24\d1\bb\4f\b6\80\f3\4f\7c\9a\d9\6a\8f\24\ec\88\be\73\ea\8e\5a\6c\65\26\0e\9c\b8\a7'      # SHA256("world")
BODY='\66\18\9e\d7\99\1e\1e\0f\ce\06\53\99\c5\ca\05\fc\15\c2\81\86\5a\7a\29\91\bd\d6\67\c1\46\6a\91\a4'  # SHA256(D0 || D1)
ENV='envelope = record { from = record { user = "alice"; domain = "example.com" }; to = vec { record { user = "support"; domain = "example.icp0.io" } } }'

# Expected: opt (1 : nat32) and opt (20_971_520 : nat64)
icp canister call backend smtp_capabilities '()'

# Chunk 1 first: order is not guaranteed. Expected: Ok, chunks_received = 1
icp canister call backend smtp_upload_chunk "(record { version = 1; message_id = \"m1\"; $ENV; index = 1; total_chunks = 2; chunk_size = 6; body_size = 11; payload_sha256 = blob \"$D1\"; payload = blob \"world\" })"

# Commit too early. Expected: Err 450 "upload is incomplete" (the upload is kept)
icp canister call backend smtp_upload_commit "(record { version = 1; message_id = \"m1\"; body_sha256 = blob \"$BODY\"; total_chunks = 2 })"

# Chunk 0 carries the headers. Expected: Ok, chunks_received = 2
icp canister call backend smtp_upload_chunk "(record { version = 1; message_id = \"m1\"; $ENV; index = 0; total_chunks = 2; chunk_size = 6; body_size = 11; payload_sha256 = blob \"$D0\"; payload = blob \"hello \"; headers = opt vec { record { name = \"Subject\"; value = \" Big\\r\\n\" } } })"

# Commit, then commit again. Expected: Ok both times (idempotent)
icp canister call backend smtp_upload_commit "(record { version = 1; message_id = \"m1\"; body_sha256 = blob \"$BODY\"; total_chunks = 2 })"
icp canister call backend smtp_upload_commit "(record { version = 1; message_id = \"m1\"; body_sha256 = blob \"$BODY\"; total_chunks = 2 })"

# Expected: known = true; committed = true; result = opt variant { Ok = record {} }
icp canister call backend smtp_upload_status '(record { message_id = "m1" })'

# Allocation attack. Expected: Err 554 "malformed chunk layout", not a trap
icp canister call backend smtp_upload_chunk "(record { version = 1; message_id = \"m3\"; $ENV; index = 0; total_chunks = 4000000000; chunk_size = 1; body_size = 4000000000; payload_sha256 = blob \"$D0\"; payload = blob \"hello \" })"
```

In zsh, print these variables with `print -r` rather than `echo`: zsh's `echo` interprets the backslashes and corrupts the digests.
