import Web3 from 'web3';

import { balanceOf, allowance, approve } from './token';
import { ADDRESS, executedBookAmounts, generateOrderId, checkOrderExecution, checkOrdersExecution, executeOrder, executeOrders, cancelOrder, cancelOrders } from './orderbook';

const DEFAULT_ORDER_DURATION = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

export type Order = {
  orderId: string;
  bookToken: string;
  execToken: string;
  bookAmount: bigint;
  execAmount: bigint;
  maker: string;
  salt: bigint;
  signature: string;

  freeBookAmount: bigint;
  price: bigint;
  time: number;
  duration: number;
};

export type PreparedExecution = {
  bookToken: string;
  execToken: string;
  orderIds: string[];
  bookAmounts: bigint[];
  execAmounts: bigint[];
  makers: string[];
  salts: bigint[];
  signatures: string[];
  lastRequiredBookAmount: bigint;
};

export interface Api {
  availableForLimitOrder(bookToken: string, maker: string): Promise<bigint>;
  insertOrder(order: Order): Promise<void>;
  removeOrder(orderId: string): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution>;
  prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution>;
  registerMarketOrder(prepared: PreparedExecution): Promise<void>;
}

export interface Db {
  insertOrder(order: Order): Promise<void>;
  removeOrder(orderId: string): Promise<void>;
  updateOrder(orderId: string, freeBookAmount: bigint): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  lookupOrders(bookToken: string, execToken: string, direction: 'asc' | 'desc', maker?: string): Promise<Order[]>;
  bookSumOrders(bookToken: string, maker?: string): Promise<bigint>;
}

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
  const { signature } = await web3.eth.accounts.sign(hash, account.privateKey);
  return signature
}

async function recover(web3: Web3, hash: string, signature: string): Promise<string> {
  return web3.eth.accounts.recover(hash, signature);
}

function generateSalt(duration = DEFAULT_ORDER_DURATION, startTime = Date.now(), random = randomInt()): bigint {
  const endTime = startTime + duration;
  return BigInt(random) << 128n | BigInt(Math.floor(startTime / 1000)) << 64n | BigInt(Math.floor(endTime / 1000));
}

async function availableForLimitOrder(web3: Web3, db: Db, bookToken: string, maker = currentUser(web3)): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(web3, bookToken, maker);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  const free = balance < approved ? balance : approved;
  const used = await db.bookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

async function registerMarketOrder(web3: Web3, db: Db, prepared: PreparedExecution): Promise<void> {
  const { orderIds, bookAmounts } = prepared;
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    if (orderId === undefined) throw new Error('Panic');
    const bookAmount = bookAmounts[i];
    if (bookAmount === undefined) throw new Error('Panic');
    const executedBookAmount = await executedBookAmounts(web3, orderId);
    if (executedBookAmount >= bookAmount) {
      await db.removeOrder(orderId);
    } else {
      const freeBookAmount = bookAmount - executedBookAmount;
      await db.updateOrder(orderId, freeBookAmount);
    }
  }
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
  const salt = generateSalt(duration, time);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(web3, orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, freeBookAmount, price, time, duration };
  const available = await api.availableForLimitOrder(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
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
  const salt = generateSalt(duration, time);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(web3, orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, freeBookAmount, price, time, duration };
  const available = await api.availableForLimitOrder(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await api.insertOrder(order);
  return order;
}

export async function cancelLimitOrder(web3: Web3, api: Api, orderId: string, forceOnChain = false): Promise<void> {
  const maker = currentUser(web3);
  const order = await api.lookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const execAmount = await executedBookAmounts(web3, orderId);
  if ((execAmount > 0n || forceOnChain) && (order.time + order.duration > Date.now())) {
    // the order was partially executed, exposed publicly, and needs to be cancelled on-chain
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    await cancelOrder(web3, bookToken, execToken, bookAmount, execAmount, salt);
  }
  await api.removeOrder(orderId);
}

async function prepareMarketBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = baseToken;
  const execToken = quoteToken;
  const orders = await db.lookupOrders(bookToken, execToken, 'asc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount, time, duration } of orders) {
    if (Date.now() >= time + duration) continue;
    available[maker] = available[maker] || await availableForLimitOrder(web3, db, bookToken, maker);
    if ((available[maker] || 0n) < 0n) continue;
    orderIds.push(orderId);
    bookAmounts.push(bookAmount);
    execAmounts.push(execAmount);
    makers.push(maker);
    salts.push(salt);
    signatures.push(signature);
    amount -= freeBookAmount;
    if (amount <= 0n) {
      const lastRequiredBookAmount = freeBookAmount + amount;
      return { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
  }
  throw new Error('Insufficient liquidity');
}

async function prepareMarketSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = quoteToken;
  const execToken = baseToken;
  const orders = await db.lookupOrders(bookToken, execToken, 'desc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount, time, duration } of orders) {
    if (Date.now() >= time + duration) continue;
    available[maker] = available[maker] || await availableForLimitOrder(web3, db, bookToken, maker);
    if ((available[maker] || 0n) < 0n) continue;
    const freeExecAmount = (freeBookAmount * execAmount + (bookAmount - 1n)) / bookAmount;
    orderIds.push(orderId);
    bookAmounts.push(bookAmount);
    execAmounts.push(execAmount);
    makers.push(maker);
    salts.push(salt);
    signatures.push(signature);
    amount -= freeExecAmount;
    if (amount <= 0n) {
      const lastRequiredExecAmount = freeExecAmount + amount;
      const lastRequiredBookAmount = lastRequiredExecAmount * bookAmount / execAmount;
      return { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
  }
  throw new Error('Insufficient liquidity');
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
    await executeOrder(web3, value, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount);
  } else {
    const requiredExecAmount = await checkOrdersExecution(web3, bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    await executeOrders(web3, value, bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount);
  }
  await api.registerMarketOrder(prepared);
}

// api used by the backend

export async function apiAvailableForLimitOrder(web3: Web3, db: Db, bookToken: string, maker: string): Promise<bigint> {
  // TODO validate request
  return await availableForLimitOrder(web3, db, bookToken, maker);
}

export async function apiInsertOrder(db: Db, order: Order): Promise<void> {
  // TODO validate request
  await db.insertOrder(order);
}

export async function apiRemoveOrder(db: Db, orderId: string): Promise<void> {
  // TODO validate request
  await db.removeOrder(orderId);
}

export async function apiLookupOrder(db: Db, orderId: string): Promise<Order | null> {
  // TODO validate request
  return await db.lookupOrder(orderId);
}

export async function apiPrepareMarketBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  // TODO validate request
  return await prepareMarketBuyOrder(web3, db, baseToken, quoteToken, amount);
}

export async function apiPrepareMarketSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  // TODO validate request
  return await prepareMarketSellOrder(web3, db, baseToken, quoteToken, amount);
}

export async function apiRegisterMarketOrder(web3: Web3, db: Db, prepared: PreparedExecution): Promise<void> {
  // TODO validate request
  return await registerMarketOrder(web3, db, prepared);
}

