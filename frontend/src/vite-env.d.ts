/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK: string
  readonly VITE_RPC_URL: string
  readonly VITE_NETWORK_PASSPHRASE: string
  readonly VITE_FACTORY_CONTRACT_ID: string
  readonly VITE_DISPUTE_CONTRACT_ID: string
  readonly VITE_TOKEN_ADDRESS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
