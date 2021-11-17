import Web3 from 'web3';

import { Order, PreparedExecution } from './types';
import { Db } from './db';
import { ADDRESS, executedBookAmounts, generateOrderId } from './orderbook';
import { balanceOf, allowance } from './token';

function recover(web3: Web3, hash: string, signature: string): string {
  return web3.eth.accounts.recover(hash, signature);
}

function extractSalt(salt: bigint): { startTime: number, endTime: number, random: number } {
  const startTime = Number(salt & (2n ** 64n - 1n)) * 1000;
  const endTime = Number((salt >> 64n) & (2n ** 64n - 1n)) * 1000;
  const random = Number(salt >> 128n);
  return { startTime, endTime, random };
}

async function _availableForLimitOrder(web3: Web3, db: Db, bookToken: string, maker: string): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(web3, bookToken, maker);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  const free = balance < approved ? balance : approved;
  const used = await db.bookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

async function _updateOrders(web3: Web3, db: Db, orderIds: string[]): Promise<void> {
  const orders: Order[] = [];
  for (const orderId of orderIds) {
    const order = await db.lookupOrder(orderId);
    if (order === null) throw new Error('Invalid orderId: ' + orderId);
    orders.push(order);
  }
  for (const order of orders) {
    const executedBookAmount = await executedBookAmounts(web3, order.orderId);
    if (executedBookAmount >= order.bookAmount) {
      await db.removeOrder(order.orderId);
    } else {
      const freeBookAmount = order.bookAmount - executedBookAmount;
      await db.updateOrder(order.orderId, freeBookAmount);
    }
  }
}

async function _prepareMarketBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = baseToken;
  const execToken = quoteToken;
  const orders = await db.lookupOrders(bookToken, execToken, Date.now(), 'asc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount } of orders) {
    available[maker] = available[maker] || await _availableForLimitOrder(web3, db, bookToken, maker);
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
  return null;
}

async function _prepareMarketSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = quoteToken;
  const execToken = baseToken;
  const orders = await db.lookupOrders(bookToken, execToken, Date.now(), 'desc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount } of orders) {
    available[maker] = available[maker] || await _availableForLimitOrder(web3, db, bookToken, maker);
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
  return null;
}

// api used by the backend

export interface Api {
  availableForLimitOrder(bookToken: string, maker: string): Promise<bigint>;
  insertOrder(order: Order): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null>;
  prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null>;
  updateOrders(orderIds: string[]): Promise<void>;
}

export function createApi(web3: Web3, db: Db): Api {

  async function availableForLimitOrder(bookToken: string, maker: string): Promise<bigint> {
    return await _availableForLimitOrder(web3, db, bookToken, maker);
  }

  async function insertOrder(order: Order): Promise<void> {
    if (order.bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + order.bookToken);
    if (order.bookAmount <= 0 || order.bookAmount >= 2n ** 256n) throw new Error('Invalid bookAmount: ' + order.bookAmount);
    if (order.execAmount <= 0 || order.execAmount >= 2n ** 256n) throw new Error('Invalid execAmount: ' + order.execAmount);
    if (order.freeBookAmount <= 0 || order.freeBookAmount >= 2n ** 256n) throw new Error('Invalid freeBookAmount: ' + order.freeBookAmount);
    if (order.salt < 0 || order.salt >= 2n ** 256n) throw new Error('Invalid salt: ' + order.salt);
    const { startTime, endTime } = extractSalt(order.salt);
    if (startTime !== order.startTime) throw new Error('Invalid startTime: ' + startTime);
    if (endTime !== order.endTime) throw new Error('Invalid endTime: ' + endTime);
    const orderId = await generateOrderId(web3, order.bookToken, order.execToken, order.bookAmount, order.execAmount, order.maker, order.salt);
    if (order.orderId !== orderId) throw new Error('Invalid orderId: ' + order.orderId);
    const maker = recover(web3, orderId, order.signature);
    if (order.maker !== maker) throw new Error('Invalid maker: ' + order.maker);
    const executedBookAmount = await executedBookAmounts(web3, orderId);
    const freeBookAmount = order.bookAmount - executedBookAmount;
    if (freeBookAmount !== order.freeBookAmount) throw new Error('Invalid freeBookAmount: ' + freeBookAmount);
    const available = await _availableForLimitOrder(web3, db, order.bookToken, order.maker);
    if (available < order.freeBookAmount) throw new Error('Insufficient balance: ' + available);
    order.time = Date.now();
    return await db.insertOrder(order);
  }

  async function lookupOrder(orderId: string): Promise<Order | null> {
    return await db.lookupOrder(orderId);
  }

  async function prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null> {
    return await _prepareMarketBuyOrder(web3, db, baseToken, quoteToken, amount);
  }

  async function prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution | null> {
    return await _prepareMarketSellOrder(web3, db, baseToken, quoteToken, amount);
  }

  async function updateOrders(orderIds: string[]): Promise<void> {
    return await _updateOrders(web3, db, orderIds);
  }

  return {
    availableForLimitOrder,
    insertOrder,
    lookupOrder,
    prepareMarketBuyOrder,
    prepareMarketSellOrder,
    updateOrders,
  };
}
