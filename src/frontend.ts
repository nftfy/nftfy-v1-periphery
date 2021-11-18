import Web3 from 'web3';

import { Order, PreparedExecution } from './types';
import { Api } from './backend';
import { balanceOf, allowance, approve } from './token';
import { ADDRESS, executedBookAmounts, generateOrderId, checkOrderExecution, checkOrdersExecution, executeOrder, executeOrders, cancelOrder, cancelOrders } from './orderbook';

const DEFAULT_ORDER_DURATION = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

function randomInt(limit = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(Math.random() * limit);
}

function currentUser(web3: Web3): string {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('No account set');
  return account.address;
}

async function sign(web3: Web3, hash: string): Promise<string> {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('No account set');
  const signature = await web3.eth.personal.sign(hash, account.address, '');
  return signature;
}

function generateSalt(startTime: number, endTime: number, random = randomInt()): bigint {
  return BigInt(random) << 128n | BigInt(Math.floor(startTime / 1000)) << 64n | BigInt(Math.floor(endTime / 1000));
}

// api used by the frontend

export async function enableOrderCreation(web3: Web3, bookToken: string): Promise<void> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  await approve(web3, bookToken, ADDRESS, 2n ** 256n - 1n);
}

export async function createLimitBuyOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = quoteToken;
  const execToken = baseToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount * price / 1000000000000000000n;
  const execAmount = amount;
  const freeBookAmount = bookAmount;
  const maker = currentUser(web3);
  const time = Date.now();
  const startTime = time;
  const endTime = startTime + duration;
  const salt = generateSalt(startTime, endTime);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(web3, orderId);
  const available = await api.availableForLimitOrder(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  price = execAmount * 1000000000000000000n / bookAmount;
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time, startTime, endTime, freeBookAmount };
  await api.insertOrder(order);
  return order;
}

export async function createLimitSellOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = baseToken;
  const execToken = quoteToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount;
  const execAmount = amount * price / 1000000000000000000n;
  const freeBookAmount = bookAmount;
  const maker = currentUser(web3);
  const time = Date.now();
  const startTime = time;
  const endTime = startTime + duration;
  const salt = generateSalt(startTime, endTime);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(web3, orderId);
  const available = await api.availableForLimitOrder(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  price = execAmount * 1000000000000000000n / bookAmount;
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time, startTime, endTime, freeBookAmount };
  await api.insertOrder(order);
  return order;
}

export async function cancelLimitOrder(web3: Web3, api: Api, orderId: string): Promise<void> {
  const maker = currentUser(web3);
  const order = await api.lookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const executedBookAmount = await executedBookAmounts(web3, orderId);
  if ((executedBookAmount < order.bookAmount) && (order.endTime > Date.now())) {
    // the order was partially executed, exposed publicly, and needs to be cancelled on-chain
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    await cancelOrder(web3, bookToken, execToken, bookAmount, execAmount, salt);
  }
  await api.updateOrders([orderId]);
}

export async function executeMarketOrder(web3: Web3, api: Api, prepared: PreparedExecution): Promise<void> {
  const { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount } = prepared;
  if (makers.length === 1) {
    const bookAmount = bookAmounts[0] || 0n;
    const execAmount = execAmounts[0] || 0n;
    const maker = makers[0] || '';
    const salt = salts[0] || 0n;
    const signature = signatures[0] || '';
    const requiredBookAmount = lastRequiredBookAmount;
    const requiredExecAmount = await checkOrderExecution(web3, bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    await executeOrder(web3, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount, { value });
  } else {
    const requiredExecAmount = await checkOrdersExecution(web3, bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    await executeOrders(web3, bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount, { value });
  }
  await api.updateOrders(orderIds);
}
