import {
  Contract,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
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
): Promise<xdr.ScVal | null> {
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
  return successSim.result.retval;
}

// ─── XDR Parsers ──────────────────────────────────────────────────────────────

function parseAddress(val: xdr.ScVal): string {
  try { return Address.fromScVal(val).toString(); } catch { /* fall */ }
  try { return scValToNative(val) as string; } catch { return ''; }
}

function parseI128(val: xdr.ScVal): bigint {
  try {
    if (val.switch().name === 'scvI128') {
      const parts = val.i128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    if (val.switch().name === 'scvU128') {
      const parts = val.u128();
      const hi = BigInt(parts.hi().toString());
      const lo = BigInt(parts.lo().toString());
      return (hi << 64n) | lo;
    }
    return BigInt(String(scValToNative(val)));
  } catch { return 0n; }
}

// Soroban #[contracttype] enums are encoded as scvVec([scvSymbol("VariantName")])
function parseEscrowState(val: xdr.ScVal): EscrowState {
  const STATES: EscrowState[] = ['Created', 'Funded', 'Submitted', 'Approved', 'Released', 'Disputed'];
  try {
    const sw = val.switch().name;
    console.log('parseEscrowState switch:', sw, val.toXDR('base64'));

    if (sw === 'scvVec') {
      const vec = val.vec();
      if (vec && vec.length > 0) {
        const first = vec[0];
        const fsw = first.switch().name;
        if (fsw === 'scvSymbol') return first.sym().toString() as EscrowState;
        if (fsw === 'scvString') return first.str().toString() as EscrowState;
        if (fsw === 'scvU32') {
          const idx = first.u32();
          return STATES[idx] ?? 'Created';
        }
      }
    }
    if (sw === 'scvSymbol') return val.sym().toString() as EscrowState;
    if (sw === 'scvString') return val.str().toString() as EscrowState;
    if (sw === 'scvU32') return STATES[val.u32()] ?? 'Created';
    // scvMap — contracttype enum with named variant
    if (sw === 'scvMap') {
      const map = val.map();
      if (map && map.length > 0) {
        const key = map[0].key();
        if (key.switch().name === 'scvSymbol') return key.sym().toString() as EscrowState;
      }
    }
  } catch (e) { console.warn('parseEscrowState error', e); }
  return 'Created';
}

// ─── Sign helper ──────────────────────────────────────────────────────────────

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
  const result = await invokeContract(FACTORY_CONTRACT_ID, 'create_escrow', args, signerAddress);
  return parseAddress(result);
}

export async function getEscrows(signerAddress: string): Promise<string[]> {
  try {
    const retval = await simulateContract(FACTORY_CONTRACT_ID, 'get_escrows', [], signerAddress);
    if (!retval) return [];
    console.log('getEscrows switch:', retval.switch().name);
    if (retval.switch().name === 'scvVec') {
      return (retval.vec() ?? []).map((v) => parseAddress(v)).filter(Boolean);
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
  const retval = await simulateContract(contractId, 'get_details', [], signerAddress);

  let client = '', freelancer = '', amount = 0n, state: EscrowState = 'Created';

  if (retval && retval.switch().name === 'scvVec') {
    const vec = retval.vec() ?? [];
    console.log('get_details fields:', vec.map(v => v.switch().name));
    if (vec[0]) client = parseAddress(vec[0]);
    if (vec[1]) freelancer = parseAddress(vec[1]);
    if (vec[2]) amount = parseI128(vec[2]);
    if (vec[3]) state = parseEscrowState(vec[3]);
  }

  let proofUri: string | undefined;
  try {
    const proofVal = await simulateContract(contractId, 'get_proof_uri', [], signerAddress);
    if (proofVal && proofVal.switch().name !== 'scvVoid') {
      if (proofVal.switch().name === 'scvString') proofUri = proofVal.str().toString();
      else if (proofVal.switch().name === 'scvVec') {
        const v = proofVal.vec();
        if (v?.[0]?.switch().name === 'scvString') proofUri = v[0].str().toString();
      }
    }
  } catch { /* no proof yet */ }

  return { contractId, client, freelancer, amount, state, proofUri };
}

export async function deposit(contractId: string, signerAddress: string): Promise<void> {
  await invokeContract(contractId, 'deposit', [], signerAddress);
}

export async function submitWork(contractId: string, proofUri: string, signerAddress: string): Promise<void> {
  await invokeContract(contractId, 'submit_work', [nativeToScVal(proofUri, { type: 'string' })], signerAddress);
}

export async function approveWork(contractId: string, signerAddress: string): Promise<void> {
  await invokeContract(contractId, 'approve_work', [], signerAddress);
}

export async function raiseDispute(contractId: string, signerAddress: string): Promise<void> {
  await invokeContract(contractId, 'raise_dispute', [nativeToScVal(signerAddress, { type: 'address' })], signerAddress);
}

export async function resolveDispute(escrowContractId: string, freelancerWins: boolean, signerAddress: string): Promise<void> {
  const args = [
    nativeToScVal(escrowContractId, { type: 'address' }),
    nativeToScVal(freelancerWins, { type: 'bool' }),
  ];
  await invokeContract(DISPUTE_CONTRACT_ID, 'resolve_dispute', args, signerAddress);
}

export function formatXlm(stroops: bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return xlm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 7 });
}

export function truncateAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
