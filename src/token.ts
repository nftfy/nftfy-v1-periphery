import Web3 from 'web3';
import { PromiEvent } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

type SendOptions = {
  from?: string;
  gasPrice?: string | bigint;
  gas?: number;
  value?: number | string | bigint;
  nonce?: number;
};

const ABI: AbiItem[] = [
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    stateMutability: 'view',
    outputs: [{ type: 'uint8', name: '_decimals' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address', name: '_account' }],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_balance' }],
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { type: 'address', name: '_account' },
      { type: 'address', name: '_spender' },
    ],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_allowance' }],
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { type: 'address', name: '_spender' },
      { type: 'uint256', name: '_amount' },
    ],
    stateMutability: 'nonpayable',
    outputs: [{ type: 'bool', name: '_success' }],
  },
];

async function _currentUser(web3: Web3): Promise<string> {
  const [address] = await web3.eth.getAccounts();
  if (address === undefined) throw new Error('No account set');
  return address;
}

async function _filterTxId(event: PromiEvent<Contract>): Promise<string> {
  let txId: string | null = null;
  await event.on('transactionHash', (hash: string) => { txId = hash; });
  if (txId === null) throw new Error('Unknown txId');
  return txId;
}

export async function decimals(web3: Web3, token: string): Promise<number> {
  const contract = new web3.eth.Contract(ABI, token);
  return Number(await contract.methods.decimals().call());
}

export async function balanceOf(web3: Web3, token: string, account: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, token);
  return BigInt(await contract.methods.balanceOf(account).call());
}

export async function allowance(web3: Web3, token: string, account: string, spender: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, token);
  return BigInt(await contract.methods.allowance(account, spender).call());
}

export async function approve(web3: Web3, token: string, spender: string, amount: bigint, options: SendOptions = {}): Promise<string> {
  let { from = await _currentUser(web3), nonce, gas = 75000, gasPrice, value } = options;
  if (typeof gasPrice === 'bigint') gasPrice = String(gasPrice);
  if (typeof value === 'bigint') value = String(value);
  const contract = new web3.eth.Contract(ABI, token);
  return await _filterTxId(contract.methods.approve(spender, amount).send({ from, nonce, gas, gasPrice, value }));
}
