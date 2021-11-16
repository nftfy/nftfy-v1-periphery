import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

const ABI: AbiItem[] = [
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
    'outputs': [{ type: 'bool', name: '_success' }],
  },
];

export async function balanceOf(web3: Web3, token: string, account: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, token);
  return BigInt(await contract.methods.balanceOf(account).call());
}

export async function allowance(web3: Web3, token: string, account: string, spender: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, token);
  return BigInt(await contract.methods.allowance(account, spender).call());
}

export async function approve(web3: Web3, token: string, spender: string, amount: bigint, from = ''): Promise<void> {
  if (from === '') {
    const account = web3.eth.accounts.wallet[0];
    if (account === undefined) throw new Error('No account set');
    from = account.address;
  }
  const contract = new web3.eth.Contract(ABI, token);
  await contract.methods.approve(spender, amount).send({ from, gas: 75000 });
}
