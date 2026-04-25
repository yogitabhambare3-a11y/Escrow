import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { signTransaction as freighterSign } from '@stellar/freighter-api';
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  FACTORY_CONTRACT_ID,
  DISPUTE_CONTRACT_ID,
  TOKEN_ADDRESS,
} from './constants';
import type { EscrowDetails, EscrowState } from '../types';

const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  signerAddress: string
): Promise<xdr.ScVal> {
  const account = await server.getAccount(signerAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const preparedTx = await server.prepareTransaction(tx);

  const signedXdr = await signTx(preparedTx.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const result = await server.sendTransaction(signedTx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
  }

  // Poll for result
  let getResult = await server.getTransaction(result.hash);
  let attempts = 0;
  while (getResult.status === 'NOT_FOUND' && attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(result.hash);
    attempts++;
  }

  if (getResult.status === 'SUCCESS') {
    const successResult = getResult as SorobanRpc.Api.GetSuccessfulTransactionResponse;
    return successResult.returnValue ?? xdr.ScVal.scvVoid();
  }

  throw new Error(`Transaction failed after polling: ${getResult.status}`);
}

async function simulateContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  signerAddress: string
): Promise<unknown> {
  const account = await server.getAccount(signerAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation error: ${(sim as SorobanRpc.Api.SimulateTransactionErrorResponse).error}`);
  }

  const successSim = sim as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  if (!successSim.result) return null;

  try {
    return scValToNative(successSim.result.retval);
  } catch (e) {
    // Raw XDR parse fallback — return the scVal directly for manual parsing
    console.warn('scValToNative failed, returning raw scVal', e);
    return successSim.result.retval;
  }
}

// ─── Sign helper (handles Freighter v1 string and v2 object response) ─────────
async function signTx(xdrStr: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = await freighterSign(xdrStr, { networkPassphrase: NETWORK_PASSPHRASE });
  if (typeof res === 'string') return res;
  if (res?.signedTxXdr) return res.signedTxXdr;
  if (res?.error) throw new Error(res.error);
  throw new Error('Unexpected signTransaction response');
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export async function createEscrow(
  signerAddress: string,
  freelancer: string,
  amountXlm: number
): Promise<string> {
  const amountStroops = BigInt(Math.round(amountXlm * 10_000_000));

  const args = [
    nativeToScVal(signerAddress, { type: 'address' }),
    nativeToScVal(freelancer, { type: 'address' }),
    nativeToScVal(amountStroops, { type: 'i128' }),
    nativeToScVal(TOKEN_ADDRESS, { type: 'address' }),
    nativeToScVal(DISPUTE_CONTRACT_ID, { type: 'address' }),
  ];

  const result = await invokeContract(
    FACTORY_CONTRACT_ID,
    'create_escrow',
    args,
    signerAddress
  );

  return scValToNative(result) as string;
}

export async function getEscrows(signerAddress: string): Promise<string[]> {
  try {
    const result = await simulateContract(
      FACTORY_CONTRACT_ID,
      'get_escrows',
      [],
      signerAddress
    );
    if (!result) return [];
    if (Array.isArray(result)) return result as string[];
    // Handle raw scVal vec
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = result as any;
    if (raw?._value && Array.isArray(raw._value)) {
      return raw._value.map((v: xdr.ScVal) => {
        try { return scValToNative(v) as string; } catch { return null; }
      }).filter(Boolean);
    }
    return [];
  } catch (e) {
    console.error('getEscrows error:', e);
    return [];
  }
}

// ─── Escrow ───────────────────────────────────────────────────────────────────

export async function getEscrowDetails(
  contractId: string,
  signerAddress: string
): Promise<EscrowDetails> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (await simulateContract(contractId, 'get_details', [], signerAddress)) as any;

  let client = '', freelancer = '', amount = 0n, state: EscrowState = 'Created';

  if (Array.isArray(raw)) {
    client = raw[0] ?? '';
    freelancer = raw[1] ?? '';
    amount = typeof raw[2] === 'bigint' ? raw[2] : BigInt(raw[2] ?? 0);
    state = (raw[3] ? Object.keys(raw[3])[0] : 'Created') as EscrowState;
  } else if (raw && typeof raw === 'object') {
    // Could be a map with named keys
    client = raw.client ?? raw[0] ?? '';
    freelancer = raw.freelancer ?? raw[1] ?? '';
    amount = typeof raw.amount === 'bigint' ? raw.amount : BigInt(raw.amount ?? raw[2] ?? 0);
    const stateObj = raw.state ?? raw[3];
    state = (stateObj ? (typeof stateObj === 'string' ? stateObj : Object.keys(stateObj)[0]) : 'Created') as EscrowState;
  }

  let proofUri: string | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proof = (await simulateContract(contractId, 'get_proof_uri', [], signerAddress)) as any;
    proofUri = typeof proof === 'string' ? proof : undefined;
  } catch { /* no proof yet */ }

  return { contractId, client, freelancer, amount, state, proofUri };
}

export async function deposit(
  contractId: string,
  signerAddress: string
): Promise<void> {
  await invokeContract(contractId, 'deposit', [], signerAddress);
}

export async function submitWork(
  contractId: string,
  proofUri: string,
  signerAddress: string
): Promise<void> {
  const args = [nativeToScVal(proofUri, { type: 'string' })];
  await invokeContract(contractId, 'submit_work', args, signerAddress);
}

export async function approveWork(
  contractId: string,
  signerAddress: string
): Promise<void> {
  await invokeContract(contractId, 'approve_work', [], signerAddress);
}

export async function raiseDispute(
  contractId: string,
  signerAddress: string
): Promise<void> {
  const args = [nativeToScVal(signerAddress, { type: 'address' })];
  await invokeContract(contractId, 'raise_dispute', args, signerAddress);
}

export async function resolveDispute(
  escrowContractId: string,
  freelancerWins: boolean,
  signerAddress: string
): Promise<void> {
  const args = [
    nativeToScVal(escrowContractId, { type: 'address' }),
    nativeToScVal(freelancerWins, { type: 'bool' }),
  ];
  await invokeContract(
    DISPUTE_CONTRACT_ID,
    'resolve_dispute',
    args,
    signerAddress
  );
}

export function formatXlm(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return xlm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

export function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
