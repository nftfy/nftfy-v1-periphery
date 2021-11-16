import Web3 from 'web3';
import { PromiEvent } from 'web3-core';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

export const ADDRESS = '0x9e2873c1c89696987F671861901A06Ad7Cb97f8C';

const ABI: AbiItem[] = [
  {
    type: 'function',
    name: 'executedBookAmounts',
    inputs: [{ type: 'bytes32', name: '_orderId' }],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_executedBookAmounts' }],
  },
  {
    type: 'function',
    name: 'generateOrderId',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256', name: '_bookAmount' },
      { type: 'uint256', name: '_execAmount' },
      { type: 'address', name: '_maker' },
      { type: 'uint256', name: '_salt' },
    ],
    stateMutability: 'view',
    outputs: [{ type: 'bytes32', name: '_orderId' }],
  },
  {
    type: 'function',
    name: 'checkOrderExecution',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256', name: '_bookAmount' },
      { type: 'uint256', name: '_execAmount' },
      { type: 'address', name: '_maker' },
      { type: 'uint256', name: '_salt' },
      { type: 'uint256', name: '_requiredBookAmount' },
    ],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_totalExecAmount' }],
  },
  {
    type: 'function',
    name: 'checkOrdersExecution',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256[]', name: '_bookAmounts' },
      { type: 'uint256[]', name: '_execAmounts' },
      { type: 'address[]', name: '_makers' },
      { type: 'uint256[]', name: '_salts' },
      { type: 'uint256', name: '_lastRequiredBookAmount' },
    ],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_totalExecAmount' }],
  },
  {
    type: 'function',
    name: 'executeOrder',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256', name: '_bookAmount' },
      { type: 'uint256', name: '_execAmount' },
      { type: 'address', name: '_maker' },
      { type: 'uint256', name: '_salt' },
      { type: 'bytes', name: '_signature' },
      { type: 'uint256', name: '_requiredBookAmount' },
    ],
    stateMutability: 'payable',
    outputs: [],
  },
  {
    type: 'function',
    name: 'executeOrders',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256[]', name: '_bookAmounts' },
      { type: 'uint256[]', name: '_execAmounts' },
      { type: 'address[]', name: '_makers' },
      { type: 'uint256[]', name: '_salts' },
      { type: 'bytes', name: '_signatures' },
      { type: 'uint256', name: '_lastRequiredBookAmount' },
    ],
    stateMutability: 'payable',
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelOrder',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256', name: '_bookAmount' },
      { type: 'uint256', name: '_execAmount' },
      { type: 'uint256', name: '_salt' },
    ],
    stateMutability: 'nonpayable',
    outputs: [],
  },
  {
    type: 'function',
    name: 'cancelOrders',
    inputs: [
      { type: 'address', name: '_bookToken' },
      { type: 'address', name: '_execToken' },
      { type: 'uint256[]', name: '_bookAmounts' },
      { type: 'uint256[]', name: '_execAmounts' },
      { type: 'uint256[]', name: '_salts' },
    ],
    stateMutability: 'nonpayable',
    outputs: [],
  },
];

function currentUser(web3: Web3): string {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('No account set');
  return account.address;
}

async function filterTxId(event: PromiEvent<Contract>): Promise<string> {
  let txId: string | null = null;
  await event.on('transactionHash', (hash: string) => { txId = hash; });
  if (txId === null) throw new Error('Unknown txId');
  return txId;
}

export async function executedBookAmounts(web3: Web3, orderId: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return BigInt(await contract.methods.executedBookAmounts(orderId).call());
}

export async function generateOrderId(web3: Web3, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint): Promise<string> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return await contract.methods.generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt).call();
}

export async function checkOrderExecution(web3: Web3, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, requiredBookAmount: bigint): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return BigInt(await contract.methods.checkOrderExecution(bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount).call());
}

export async function checkOrdersExecution(web3: Web3, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], lastRequiredBookAmount: bigint): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return BigInt(await contract.methods.checkOrdersExecution(bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount).call());
}

export async function executeOrder(web3: Web3, value: bigint, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, signature: string, requiredBookAmount: bigint, from = currentUser(web3)): Promise<void> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  await filterTxId(contract.methods.executeOrder(bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount).send({ from, value: String(value), gas: 150000 }));
}

export async function executeOrders(web3: Web3, value: bigint, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], signatures: string[], lastRequiredBookAmount: bigint, from = currentUser(web3)): Promise<void> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  const siglist = '0x' + signatures.map((signature) => signature.substr(2)).join('');
  await filterTxId(contract.methods.executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, siglist, lastRequiredBookAmount).send({ from, value: String(value), gas: 150000 * salts.length + 50000 }));
}

export async function cancelOrder(web3: Web3, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, salt: bigint, from = currentUser(web3)): Promise<void> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  await filterTxId(contract.methods.cancelOrder(bookToken, execToken, bookAmount, execAmount, salt).send({ from, gas: 75000 }));
}

export async function cancelOrders(web3: Web3, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], salts: bigint[], from = currentUser(web3)): Promise<void> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  await filterTxId(contract.methods.cancelOrders(bookToken, execToken, bookAmounts, execAmounts, salts).send({ from, gas: 75000 * salts.length + 25000 }));
}
