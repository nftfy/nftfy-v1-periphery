import Web3 from 'web3';
import { PromiEvent } from 'web3-core';
import { Contract, EventData } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

export type SendOptions = {
  from?: string;
  gasPrice?: string | bigint;
  gas?: number;
  value?: number | string | bigint;
  nonce?: number;
  callback?: (error: Error, tx: string) => void;
};

export const ADDRESS = '0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47';

const ABI: AbiItem[] = [
  {
    type: 'function',
    name: 'fee',
    inputs: [],
    stateMutability: 'view',
    outputs: [{ type: 'uint256', name: '_fee' }],
  },
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
  {
    type: 'event',
    name: 'Trade',
    inputs: [
      { type: 'address', indexed: true, name: '_bookToken' },
      { type: 'address', indexed: true, name: '_execToken' },
      { type: 'bytes32', indexed: true, name: '_orderId' },
      { type: 'uint256', indexed: false, name: '_bookAmount' },
      { type: 'uint256', indexed: false, name: '_execAmount' },
      { type: 'uint256', indexed: false, name: '_execFeeAmount' },
      { type: 'address', indexed: false, name: '_maker' },
      { type: 'address', indexed: false, name: '_taker' },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CancelOrder',
    inputs: [
      { type: 'address', indexed: true, name: '_bookToken' },
      { type: 'address', indexed: true, name: '_execToken' },
      { type: 'bytes32', indexed: true, name: '_orderId' },
    ],
    anonymous: false,
  },
];

async function _currentUser(web3: Web3): Promise<string> {
  const [address] = await web3.eth.getAccounts();
  if (address === undefined) throw new Error('No account set');
  return address;
}

async function _filterTxId(event: PromiEvent<Contract>): Promise<string> {
  let txId: string | null = null;
  await event.on('receipt', ({ transactionHash }) => { txId = transactionHash; });
  if (txId === null) throw new Error('Unknown txId');
  return txId;
}

export async function fee(web3: Web3): Promise<bigint> {
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return BigInt(await contract.methods.fee().call());
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

export async function executeOrder(web3: Web3, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, signature: string, requiredBookAmount: bigint, options: SendOptions = {}): Promise<string> {
  let { from = await _currentUser(web3), nonce, gas = 200000, gasPrice, value } = options;
  if (typeof gasPrice === 'bigint') gasPrice = String(gasPrice);
  if (typeof value === 'bigint') value = String(value);
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return await _filterTxId(contract.methods.executeOrder(bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount).send({ from, nonce, gas, gasPrice, value }, options.callback));
}

export async function executeOrders(web3: Web3, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], signatures: string[], lastRequiredBookAmount: bigint, options: SendOptions = {}): Promise<string> {
  let { from = await _currentUser(web3), nonce, gas = 240000 * salts.length + 100000, gasPrice, value } = options;
  if (typeof gasPrice === 'bigint') gasPrice = String(gasPrice);
  if (typeof value === 'bigint') value = String(value);
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  const siglist = '0x' + signatures.map((signature) => signature.substr(2)).join('');
  return await _filterTxId(contract.methods.executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, siglist, lastRequiredBookAmount).send({ from, nonce, gas, gasPrice, value }, options.callback));
}

export async function cancelOrder(web3: Web3, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, salt: bigint, options: SendOptions = {}): Promise<string> {
  let { from = await _currentUser(web3), nonce, gas = 100000, gasPrice, value } = options;
  if (typeof gasPrice === 'bigint') gasPrice = String(gasPrice);
  if (typeof value === 'bigint') value = String(value);
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return await _filterTxId(contract.methods.cancelOrder(bookToken, execToken, bookAmount, execAmount, salt).send({ from, nonce, gas, gasPrice, value }, options.callback));
}

export async function cancelOrders(web3: Web3, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], salts: bigint[], options: SendOptions = {}): Promise<string> {
  let { from = await _currentUser(web3), nonce, gas = 100000 * salts.length + 50000, gasPrice, value } = options;
  if (typeof gasPrice === 'bigint') gasPrice = String(gasPrice);
  if (typeof value === 'bigint') value = String(value);
  const contract = new web3.eth.Contract(ABI, ADDRESS);
  return await _filterTxId(contract.methods.cancelOrders(bookToken, execToken, bookAmounts, execAmounts, salts).send({ from, nonce, gas, gasPrice, value }, options.callback));
}

export function onTrade(web3: Web3, callback: (orderId: string) => void): void {
  const constract = new web3.eth.Contract(ABI, ADDRESS);
  constract.events.Trade({ fromBlock: 'latest' }, (error: unknown, event: EventData) => {
    if (error) return;
    const { _orderId: orderId } = event.returnValues;
    callback(orderId);
  });
}

export function onCancelOrder(web3: Web3, callback: (orderId: string) => void): void {
  const constract = new web3.eth.Contract(ABI, ADDRESS);
  constract.events.CancelOrder({ fromBlock: 'latest' }, (error: unknown, event: EventData) => {
    if (error) return;
    const { _orderId: orderId } = event.returnValues;
    callback(orderId);
  });
}
