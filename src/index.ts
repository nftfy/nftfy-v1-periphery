import Web3 from 'web3';

import { balanceOf, allowance, approve } from './token';
import { ADDRESS, executedBookAmounts, generateOrderId, checkOrderExecution, checkOrdersExecution, executeOrder, executeOrders, cancelOrder, cancelOrders } from './orderbook';

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

export interface Db {
  insertOrder(order: Order): Promise<void>;
  removeOrder(orderId: string): Promise<void>;
  updateOrder(orderId: string, freeBookAmount: bigint): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  lookupOrders(bookToken: string, execToken: string, direction: 'asc' | 'desc', maker?: string): Promise<Order[]>;
  bookSumOrders(bookToken: string, maker?: string): Promise<bigint>;
}

function currentUser(web3: Web3): string {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  return account.address;
}

async function sign(web3: Web3, hash: string): Promise<string> {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  const { signature } = await web3.eth.accounts.sign(hash, account.privateKey);
  return signature
}

const DEFAULT_ORDER_DURATION = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

function randomInt(limit = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(Math.random() * limit);
}

function generateSalt(duration = DEFAULT_ORDER_DURATION, startTime = Date.now(), random = randomInt()): bigint {
  const endTime = startTime + duration;
  return BigInt(random) << 128n | BigInt(Math.floor(startTime / 1000)) << 64n | BigInt(Math.floor(endTime / 1000));
}

export async function enableOrderCreation(web3: Web3, bookToken: string): Promise<void> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  await approve(web3, bookToken, ADDRESS, 2n ** 256n - 1n);
}

export async function availableForLimitOrder(web3: Web3, db: Db, bookToken: string, maker = currentUser(web3)): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(web3, bookToken, maker);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  const free = balance < approved ? balance : approved;
  const used = await db.bookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

export async function createLimitBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
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
  const available = await availableForLimitOrder(web3, db, bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await db.insertOrder(order);
  return order;
}

export async function createLimitSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
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
  const available = await availableForLimitOrder(web3, db, bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await db.insertOrder(order);
  return order;
}

export async function cancelLimitOrder(web3: Web3, db: Db, orderId: string, forceOnChain = false): Promise<void> {
  const maker = currentUser(web3);
  const order = await db.lookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const execAmount = await executedBookAmounts(web3, orderId);
  if ((execAmount > 0n || forceOnChain) && (order.time + order.duration > Date.now())) {
    // the order was partially executed, exposed publicly, and needs to be cancelled on-chain
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    await cancelOrder(web3, bookToken, execToken, bookAmount, execAmount, salt);
  }
  await db.removeOrder(orderId);
}

export async function prepareMarketBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
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

export async function prepareMarketSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
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

export async function executeMarketOrder(web3: Web3, db: Db, prepared: PreparedExecution): Promise<void> {
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
