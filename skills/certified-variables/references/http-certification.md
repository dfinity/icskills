# HTTP Certification for Custom `http_request` Canisters

For canisters serving HTTP responses directly from `http_request`, responses must be certified so the HTTP gateway can verify them. A complete, minimal canister serving one certified response at `/hello`:

**Cargo.toml dependencies:**

```toml
[dependencies]
candid = "0.10"
ic-cdk = "0.20"
ic-http-certification = "4"
```

**Certifying and serving the response:**

```rust
use ic_cdk::{init, post_upgrade, query};
use ic_http_certification::{
    utils::add_v2_certificate_header, DefaultCelBuilder, DefaultResponseCertification,
    HttpCertification, HttpCertificationPath, HttpCertificationTree, HttpCertificationTreeEntry,
    HttpRequest, HttpResponse, CERTIFICATE_EXPRESSION_HEADER_NAME,
};
use std::cell::RefCell;

const PATH: &str = "/hello";

thread_local! {
    static TREE: RefCell<HttpCertificationTree> = RefCell::new(HttpCertificationTree::default());
    // The certified response and its certification, kept to serve and to build the witness.
    static CERTIFIED: RefCell<Option<(HttpResponse<'static>, HttpCertification)>> = RefCell::new(None);
}

fn certify() {
    let cel = DefaultCelBuilder::response_only_certification()
        .with_response_certification(DefaultResponseCertification::certified_response_headers(vec![
            "Content-Type",
        ]))
        .build();
    // The IC-CertificateExpression header must be part of the response that gets certified.
    let response = HttpResponse::ok(
        b"hello".to_vec(),
        vec![
            ("Content-Type".into(), "text/plain".into()),
            (CERTIFICATE_EXPRESSION_HEADER_NAME.into(), cel.to_string()),
        ],
    )
    .build();
    let certification = HttpCertification::response_only(&cel, &response, None).unwrap();

    TREE.with_borrow_mut(|tree| {
        tree.insert(&HttpCertificationTreeEntry::new(
            HttpCertificationPath::exact(PATH),
            &certification,
        ));
        ic_cdk::api::certified_data_set(tree.root_hash());
    });
    CERTIFIED.with_borrow_mut(|c| *c = Some((response, certification)));
}

#[init]
fn init() {
    certify();
}

// The tree lives on the heap and is wiped on upgrade: rebuild it and re-set the root hash.
#[post_upgrade]
fn post_upgrade() {
    certify();
}

#[query]
fn http_request(req: HttpRequest) -> HttpResponse<'static> {
    if req.get_path().ok().as_deref() != Some(PATH) {
        return HttpResponse::not_found(b"not found".to_vec(), vec![]).build();
    }
    let (mut response, certification) = CERTIFIED.with_borrow(|c| c.clone().unwrap());
    let path = HttpCertificationPath::exact(PATH);
    let witness = TREE.with_borrow(|tree| {
        tree.witness(&HttpCertificationTreeEntry::new(&path, &certification), PATH)
            .unwrap()
    });
    add_v2_certificate_header(
        &ic_cdk::api::data_certificate().expect("http_request must be a query"),
        &mut response,
        &witness,
        &path.to_expr_path(),
    );
    response
}

ic_cdk::export_candid!();
```

`response_only_certification` certifies the response regardless of request details; use `DefaultCelBuilder::full_certification()` with `HttpCertification::full` when request headers or query parameters must be bound too. For many or dynamic responses (JSON APIs, fallbacks, skipping certification, upgrading to update calls), follow the [ic-http-certification docs](https://docs.rs/ic-http-certification) and the [http-certification examples](https://github.com/dfinity/response-verification/tree/main/examples/http-certification). Their project setup uses dfx, but the canister code applies unchanged. For static files served from your own Rust canister, `ic-asset-certification` builds on this crate.

## Checking it

```bash
# Local: the gateway URL comes from `icp network status --json` (gateway_url)
curl -s -D - http://CANISTER_ID.localhost:8000/hello
# Mainnet
curl -s -D - https://CANISTER_ID.icp.net/hello
```

Expected: `200`, with `IC-Certificate` and `IC-CertificateExpression` headers. A response that fails verification comes back as JSON with `"error_type": "backend_response_verification"`. The `raw` host (`CANISTER_ID.raw.icp.net`, locally `CANISTER_ID.raw.localhost`) skips verification, so it serves even a broken certification: do not test there.
