#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, BytesN, Env,
};

// ─── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    EscrowWasmHash,
    EscrowCount,
    Escrow(u32),
}

// ─── Inter-contract interface for Escrow ──────────────────────────────────────

mod escrow_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32-unknown-unknown/release/escrow.wasm"
    );
}

// ─── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowFactoryContract;

#[contractimpl]
impl EscrowFactoryContract {
    /// Initialize factory with admin and the escrow WASM hash.
    pub fn initialize(env: Env, admin: Address, escrow_wasm_hash: BytesN<32>) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::EscrowWasmHash, &escrow_wasm_hash);
        env.storage().instance().set(&DataKey::EscrowCount, &0u32);
    }

    /// Deploy a new Escrow contract and initialize it.
    pub fn create_escrow(
        env: Env,
        client: Address,
        freelancer: Address,
        amount: i128,
        token_address: Address,
        dispute_resolver: Address,
    ) -> Address {
        client.require_auth();

        assert!(amount > 0, "amount must be positive");

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::EscrowWasmHash)
            .unwrap();

        // Deploy new escrow contract instance
        let escrow_address = env
            .deployer()
            .with_current_contract(env.crypto().sha256(
                &soroban_sdk::Bytes::from_slice(
                    &env,
                    &env.ledger().sequence().to_be_bytes(),
                ),
            ))
            .deploy_v2(wasm_hash, ());

        // Initialize the newly deployed escrow
        let escrow_client = escrow_contract::Client::new(&env, &escrow_address);
        escrow_client.initialize(
            &client,
            &freelancer,
            &amount,
            &token_address,
            &dispute_resolver,
        );

        // Store escrow address
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowCount)
            .unwrap();
        env.storage()
            .instance()
            .set(&DataKey::Escrow(count), &escrow_address);
        env.storage()
            .instance()
            .set(&DataKey::EscrowCount, &(count + 1));

        env.events().publish(
            (symbol_short!("factory"), symbol_short!("created")),
            (client, freelancer, amount, escrow_address.clone()),
        );

        escrow_address
    }

    /// Get all deployed escrow contract addresses.
    pub fn get_escrows(env: Env) -> soroban_sdk::Vec<Address> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::EscrowCount)
            .unwrap_or(0);
        let mut result = soroban_sdk::Vec::new(&env);
        for i in 0..count {
            if let Some(addr) = env.storage().instance().get(&DataKey::Escrow(i)) {
                result.push_back(addr);
            }
        }
        result
    }

    pub fn get_escrow_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::EscrowCount).unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}
