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
  return scValToNative(successSim.result.retval);
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
  const result = await simulateContract(
    FACTORY_CONTRACT_ID,
    'get_escrows',
    [],
    signerAddress
  );
  return (result as string[]) || [];
}

// ─── Escrow ───────────────────────────────────────────────────────────────────

export async function getEscrowDetails(
  contractId: string,
  signerAddress: string
): Promise<EscrowDetails> {
  const details = (await simulateContract(
    contractId,
    'get_details',
    [],
    signerAddress
  )) as [string, string, bigint, Record<string, unknown>];

  const proofUri = (await simulateContract(
    contractId,
    'get_proof_uri',
    [],
    signerAddress
  )) as string | null;

  const stateKey = Object.keys(details[3])[0] as EscrowState;

  return {
    contractId,
    client: details[0],
    freelancer: details[1],
    amount: details[2],
    state: stateKey,
    proofUri: proofUri ?? undefined,
  };
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
