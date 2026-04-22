#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Env, String,
};

// ─── State Enum ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum EscrowState {
    Created,
    Funded,
    Submitted,
    Approved,
    Released,
    Disputed,
}

// ─── Storage Keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Client,
    Freelancer,
    Amount,
    State,
    ProofUri,
    DisputeResolver,
    TokenAddress,
}

// ─── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Initialize the escrow. Called by the factory after deployment.
    pub fn initialize(
        env: Env,
        client: Address,
        freelancer: Address,
        amount: i128,
        token_address: Address,
        dispute_resolver: Address,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Client) {
            panic!("already initialized");
        }

        assert!(amount > 0, "amount must be positive");

        env.storage().instance().set(&DataKey::Client, &client);
        env.storage().instance().set(&DataKey::Freelancer, &freelancer);
        env.storage().instance().set(&DataKey::Amount, &amount);
        env.storage().instance().set(&DataKey::State, &EscrowState::Created);
        env.storage().instance().set(&DataKey::TokenAddress, &token_address);
        env.storage().instance().set(&DataKey::DisputeResolver, &dispute_resolver);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("init")),
            (client, freelancer, amount),
        );
    }

    /// Client deposits funds (transfers token into this contract).
    pub fn deposit(env: Env) {
        let client: Address = env.storage().instance().get(&DataKey::Client).unwrap();
        client.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Created, "invalid state for deposit");

        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();

        // Transfer tokens from client to this contract
        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&client, &env.current_contract_address(), &amount);

        env.storage().instance().set(&DataKey::State, &EscrowState::Funded);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("deposit")),
            (client, amount),
        );
    }

    /// Freelancer submits work with a proof URI (IPFS hash or URL).
    pub fn submit_work(env: Env, proof_uri: String) {
        let freelancer: Address = env.storage().instance().get(&DataKey::Freelancer).unwrap();
        freelancer.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Funded, "invalid state for submission");

        env.storage().instance().set(&DataKey::ProofUri, &proof_uri);
        env.storage().instance().set(&DataKey::State, &EscrowState::Submitted);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("submit")),
            (freelancer, proof_uri),
        );
    }

    /// Client approves work — releases funds to freelancer.
    pub fn approve_work(env: Env) {
        let client: Address = env.storage().instance().get(&DataKey::Client).unwrap();
        client.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Submitted, "invalid state for approval");

        env.storage().instance().set(&DataKey::State, &EscrowState::Approved);
        Self::release_funds(env);
    }

    /// Client raises a dispute.
    pub fn raise_dispute(env: Env, caller: Address) {
        let client: Address = env.storage().instance().get(&DataKey::Client).unwrap();
        let freelancer: Address = env.storage().instance().get(&DataKey::Freelancer).unwrap();

        // Either party can raise a dispute
        assert!(
            caller == client || caller == freelancer,
            "unauthorized"
        );
        caller.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(
            state == EscrowState::Submitted || state == EscrowState::Funded,
            "invalid state for dispute"
        );

        env.storage().instance().set(&DataKey::State, &EscrowState::Disputed);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("dispute")),
            (caller,),
        );
    }

    /// Called by DisputeResolution contract to resolve the dispute.
    pub fn resolve_dispute(env: Env, freelancer_wins: bool) {
        let dispute_resolver: Address =
            env.storage().instance().get(&DataKey::DisputeResolver).unwrap();
        dispute_resolver.require_auth();

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        assert!(state == EscrowState::Disputed, "not in disputed state");

        if freelancer_wins {
            env.storage().instance().set(&DataKey::State, &EscrowState::Approved);
            Self::release_funds(env.clone());
        } else {
            // Refund client
            let client: Address = env.storage().instance().get(&DataKey::Client).unwrap();
            let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
            let token: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();

            let token_client = soroban_sdk::token::Client::new(&env, &token);
            token_client.transfer(&env.current_contract_address(), &client, &amount);

            env.storage().instance().set(&DataKey::State, &EscrowState::Released);
        }

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("resolved")),
            (freelancer_wins,),
        );
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    pub fn get_state(env: Env) -> EscrowState {
        env.storage().instance().get(&DataKey::State).unwrap()
    }

    pub fn get_details(env: Env) -> (Address, Address, i128, EscrowState) {
        let client: Address = env.storage().instance().get(&DataKey::Client).unwrap();
        let freelancer: Address = env.storage().instance().get(&DataKey::Freelancer).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        (client, freelancer, amount, state)
    }

    pub fn get_proof_uri(env: Env) -> Option<String> {
        env.storage().instance().get(&DataKey::ProofUri)
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    fn release_funds(env: Env) {
        let freelancer: Address = env.storage().instance().get(&DataKey::Freelancer).unwrap();
        let amount: i128 = env.storage().instance().get(&DataKey::Amount).unwrap();
        let token: Address = env.storage().instance().get(&DataKey::TokenAddress).unwrap();

        let token_client = soroban_sdk::token::Client::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &freelancer, &amount);

        env.storage().instance().set(&DataKey::State, &EscrowState::Released);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("released")),
            (freelancer, amount),
        );
    }
}
