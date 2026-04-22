#![cfg(test)]

extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    token, Address, Env, String,
};

// ─── Import compiled contracts ────────────────────────────────────────────────

mod escrow {
    soroban_sdk::contractimport!(
        file = "../target/wasm32-unknown-unknown/release/escrow.wasm"
    );
}

mod dispute_resolution {
    soroban_sdk::contractimport!(
        file = "../target/wasm32-unknown-unknown/release/dispute_resolution.wasm"
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn create_token<'a>(
    env: &Env,
    admin: &Address,
) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone());
    (
        token::Client::new(env, &contract_address.address()),
        token::StellarAssetClient::new(env, &contract_address.address()),
    )
}

struct EscrowTest<'a> {
    env: Env,
    client: Address,
    freelancer: Address,
    #[allow(dead_code)]
    admin: Address,
    amount: i128,
    token: token::Client<'a>,
    escrow: escrow::Client<'a>,
    dispute: dispute_resolution::Client<'a>,
}

impl<'a> EscrowTest<'a> {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        let client_addr = Address::generate(&env);
        let freelancer_addr = Address::generate(&env);
        let admin_addr = Address::generate(&env);
        let amount: i128 = 1_000_0000000; // 1000 XLM in stroops

        // Deploy token and mint to client
        let (token_client, token_admin_client) = create_token(&env, &admin_addr);
        token_admin_client.mint(&client_addr, &amount);

        // Deploy DisputeResolution
        let dispute_id = env.register(dispute_resolution::WASM, ());
        let dispute_client = dispute_resolution::Client::new(&env, &dispute_id);
        dispute_client.initialize(&admin_addr);

        // Deploy Escrow
        let escrow_id = env.register(escrow::WASM, ());
        let escrow_client = escrow::Client::new(&env, &escrow_id);
        escrow_client.initialize(
            &client_addr,
            &freelancer_addr,
            &amount,
            &token_client.address,
            &dispute_id,
        );

        // Register escrow with dispute resolver
        dispute_client.register_escrow(&escrow_id);

        EscrowTest {
            env,
            client: client_addr,
            freelancer: freelancer_addr,
            admin: admin_addr,
            amount,
            token: token_client,
            escrow: escrow_client,
            dispute: dispute_client,
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize() {
    let t = EscrowTest::setup();
    let state = t.escrow.get_state();
    assert_eq!(state, escrow::EscrowState::Created);
}

#[test]
fn test_deposit() {
    let t = EscrowTest::setup();
    t.escrow.deposit();

    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Funded);
    // Contract should hold the tokens
    assert_eq!(t.token.balance(&t.escrow.address), t.amount);
}

#[test]
fn test_submit_work() {
    let t = EscrowTest::setup();
    t.escrow.deposit();

    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof);

    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Submitted);
    assert_eq!(t.escrow.get_proof_uri(), Some(proof));
}

#[test]
fn test_approve_work_releases_funds_to_freelancer() {
    let t = EscrowTest::setup();
    t.escrow.deposit();

    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof);

    let balance_before = t.token.balance(&t.freelancer);
    t.escrow.approve_work();

    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Released);
    assert_eq!(t.token.balance(&t.freelancer) - balance_before, t.amount);
}

#[test]
fn test_dispute_freelancer_wins_releases_funds() {
    let t = EscrowTest::setup();
    t.escrow.deposit();

    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof);

    // Client raises dispute
    t.escrow.raise_dispute(&t.client);
    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Disputed);

    let balance_before = t.token.balance(&t.freelancer);

    // Admin resolves via DisputeResolution → inter-contract call to Escrow
    t.dispute.resolve_dispute(&t.escrow.address, &true);

    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Released);
    assert_eq!(t.token.balance(&t.freelancer) - balance_before, t.amount);
}

#[test]
fn test_dispute_client_wins_refunds_client() {
    let t = EscrowTest::setup();
    t.escrow.deposit();

    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof);

    // Freelancer raises dispute
    t.escrow.raise_dispute(&t.freelancer);

    let balance_before = t.token.balance(&t.client);

    // Admin resolves — client wins (refund)
    t.dispute.resolve_dispute(&t.escrow.address, &false);

    assert_eq!(t.escrow.get_state(), escrow::EscrowState::Released);
    assert_eq!(t.token.balance(&t.client) - balance_before, t.amount);
}

#[test]
#[should_panic(expected = "invalid state for deposit")]
fn test_double_deposit_fails() {
    let t = EscrowTest::setup();
    t.escrow.deposit();
    t.escrow.deposit(); // must panic
}

#[test]
#[should_panic(expected = "invalid state for submission")]
fn test_submit_without_deposit_fails() {
    let t = EscrowTest::setup();
    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof); // must panic
}

#[test]
#[should_panic(expected = "unauthorized")]
fn test_raise_dispute_unauthorized_fails() {
    let t = EscrowTest::setup();
    t.escrow.deposit();
    let proof = String::from_str(&t.env, "ipfs://QmTestHash123");
    t.escrow.submit_work(&proof);

    // Random address cannot raise dispute
    let random = Address::generate(&t.env);
    t.escrow.raise_dispute(&random); // must panic
}
