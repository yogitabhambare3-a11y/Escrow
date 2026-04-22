#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env,
};

// ─── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    AuthorizedEscrows,
}

// ─── Inter-contract interface for Escrow ──────────────────────────────────────

mod escrow_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32-unknown-unknown/release/escrow.wasm"
    );
}

// ─── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct DisputeResolutionContract;

#[contractimpl]
impl DisputeResolutionContract {
    /// Initialize with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Register an escrow contract as authorized to use this resolver.
    pub fn register_escrow(env: Env, escrow_id: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let mut escrows: soroban_sdk::Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEscrows)
            .unwrap_or(soroban_sdk::Vec::new(&env));

        escrows.push_back(escrow_id.clone());
        env.storage().instance().set(&DataKey::AuthorizedEscrows, &escrows);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("register")),
            (escrow_id,),
        );
    }

    /// Admin resolves a dispute by calling back into the Escrow contract.
    pub fn resolve_dispute(env: Env, escrow_id: Address, freelancer_wins: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Verify escrow is registered
        let escrows: soroban_sdk::Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::AuthorizedEscrows)
            .unwrap_or(soroban_sdk::Vec::new(&env));

        let mut found = false;
        for i in 0..escrows.len() {
            if escrows.get(i).unwrap() == escrow_id {
                found = true;
                break;
            }
        }
        assert!(found, "escrow not registered");

        // Inter-contract call: call resolve_dispute on the Escrow contract
        let escrow_client = escrow_contract::Client::new(&env, &escrow_id);
        escrow_client.resolve_dispute(&freelancer_wins);

        env.events().publish(
            (symbol_short!("dispute"), symbol_short!("resolved")),
            (escrow_id, freelancer_wins),
        );
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}
