import Web3 from 'web3';

import { Order, PreparedExecution } from './types';
import { Db } from './db';
import { ADDRESS, executedBookAmounts } from './orderbook';
import { balanceOf, allowance } from './token';

function recover(web3: Web3, hash: string, signature: string): string {
  return web3.eth.accounts.recover(hash, signature);
}

async function _availableForLimitOrder(web3: Web3, db: Db, bookToken: string, maker: string): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(web3, bookToken, maker);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  const free = balance < approved ? balance : approved;
  const used = await db.bookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

async function _registerMarketOrder(web3: Web3, db: Db, prepared: PreparedExecution): Promise<void> {
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

async function _prepareMarketBuyOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
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
  throw new Error('Insufficient liquidity');
}

async function _prepareMarketSellOrder(web3: Web3, db: Db, baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
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
  throw new Error('Insufficient liquidity');
}

// api used by the backend

export interface Api {
  availableForLimitOrder(bookToken: string, maker: string): Promise<bigint>;
  insertOrder(order: Order): Promise<void>;
  removeOrder(orderId: string): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution>;
  prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution>;
  registerMarketOrder(prepared: PreparedExecution): Promise<void>;
}

export function createApi(web3: Web3, db: Db): Api {

  async function availableForLimitOrder(bookToken: string, maker: string): Promise<bigint> {
    // TODO validate request
    return await _availableForLimitOrder(web3, db, bookToken, maker);
  }

  async function insertOrder(order: Order): Promise<void> {
    // TODO validate request
    return await db.insertOrder(order);
  }

  async function removeOrder(orderId: string): Promise<void> {
    // TODO validate request
    return await db.removeOrder(orderId);
  }

  async function lookupOrder(orderId: string): Promise<Order | null> {
    // TODO validate request
    return await db.lookupOrder(orderId);
  }

  async function prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
    // TODO validate request
    return await _prepareMarketBuyOrder(web3, db, baseToken, quoteToken, amount);
  }

  async function prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
    // TODO validate request
    return await _prepareMarketSellOrder(web3, db, baseToken, quoteToken, amount);
  }

  async function registerMarketOrder(prepared: PreparedExecution): Promise<void> {
    // TODO validate request
    return await _registerMarketOrder(web3, db, prepared);
  }

  return {
    availableForLimitOrder,
    insertOrder,
    removeOrder,
    lookupOrder,
    prepareMarketBuyOrder,
    prepareMarketSellOrder,
    registerMarketOrder,
  };
}
