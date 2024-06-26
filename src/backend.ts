import Web3 from 'web3';

import { Order, PreparedExecution } from './types';
import { Db } from './db';
import { ADDRESS, executedBookAmounts, generateOrderId } from './orderbook';
import { balanceOf, allowance } from './token';

function _recoverSigner(web3: Web3, hash: string, signature: string): string {
  return web3.eth.accounts.recover(hash, signature);
}

function _extractSalt(salt: bigint): { startTime: number; endTime: number; random: number } {
  if (salt < 0) throw new Error('Invalid salt: ' + salt);
  const _startTime = ((salt >> 64n) & (2n ** 64n - 1n)) * 1000n;
  const _endTime = (salt & (2n ** 64n - 1n)) * 1000n;
  const _random = salt >> 128n;
  if (_startTime > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid salt.startTime: ' + _startTime);
  if (_endTime > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid salt.endTime: ' + _endTime);
  if (_random > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Invalid salt.random: ' + _random);
  const startTime = Number(_startTime);
  const endTime = Number(_endTime);
  const random = Number(_random);
  return { startTime, endTime, random };
}

async function _validateOrder(web3: Web3, order: Order): Promise<void> {
  if (order.bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid order.bookToken: ' + order.bookToken);
  if (order.bookAmount <= 0) throw new Error('Invalid order.bookAmount: ' + order.bookAmount);
  if (order.execAmount <= 0) throw new Error('Invalid order.execAmount: ' + order.execAmount);
  if (order.bookAmount * order.execAmount >= 2n ** 256n) throw new Error('Numeric overflow');
  if (order.salt < 0 || order.salt >= 2n ** 256n) throw new Error('Invalid order.salt: ' + order.salt);
  const orderId = await generateOrderId(web3, order.bookToken, order.execToken, order.bookAmount, order.execAmount, order.maker, order.salt);
  if (order.orderId !== orderId) throw new Error('Invalid order.orderId: ' + order.orderId);
  const maker = _recoverSigner(web3, orderId, order.signature);
  if (order.maker !== maker) throw new Error('Invalid order.maker: ' + order.maker);
}

async function _availableBalance(web3: Web3, db: Db, bookToken: string, maker: string): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(web3, bookToken, maker);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  const free = balance < approved ? balance : approved;
  const used = await db.bookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

async function _fetchOrders(web3: Web3, db: Db, orderIds: string[]): Promise<Order[]> {
  const orders: Order[] = [];
  for (const orderId of orderIds) {
    const order = await db.lookupOrder(orderId);
    if (order === null) throw new Error('Invalid orderId: ' + orderId);
    orders.push(order);
  }
  return orders;
}

async function _isContract(web3: Web3, token: string): Promise<boolean> {
  return await web3.eth.getCode(token) !== '0x';
}

async function _updateOrders(web3: Web3, db: Db, orders: Order[], time: number): Promise<void> {
  for (const order of orders) {
    const executedBookAmount = await executedBookAmounts(web3, order.orderId);
    if (executedBookAmount >= order.bookAmount || time >= order.endTime) {
      await db.removeOrder(order.orderId);
    } else {
      const freeBookAmount = order.bookAmount - executedBookAmount;
      await db.updateOrder(order.orderId, freeBookAmount);
    }
  }
}

async function _removeOrders(web3: Web3, db: Db, orders: Order[]): Promise<void> {
  for (const order of orders) {
    await db.removeOrder(order.orderId);
  }
}

async function _prepareExecution(web3: Web3, db: Db, bookToken: string, execToken: string, requiredBookAmount: bigint, requiredExecAmount: bigint, time: number): Promise<PreparedExecution | null> {
  if (requiredBookAmount <= 0n) throw new Error('Invalid requiredBookAmount: ' + requiredBookAmount);
  if (requiredExecAmount <= 0n) throw new Error('Invalid requiredExecAmount: ' + requiredExecAmount);
  const orders = await db.lookupOrders(bookToken, execToken, time);
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount } of orders) {
    available[maker] = available[maker] || await _availableBalance(web3, db, bookToken, maker);
    if ((available[maker] || 0n) < 0n) continue;
    const freeExecAmount = (freeBookAmount * execAmount + bookAmount - 1n) / bookAmount;
    orderIds.push(orderId);
    bookAmounts.push(bookAmount);
    execAmounts.push(execAmount);
    makers.push(maker);
    salts.push(salt);
    signatures.push(signature);
    requiredBookAmount -= freeBookAmount;
    requiredExecAmount -= freeExecAmount;
    if (requiredBookAmount <= 0n) {
      const lastRequiredBookAmount = freeBookAmount + requiredBookAmount;
      return { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
    if (requiredExecAmount <= 0n) {
      const lastRequiredExecAmount = freeExecAmount + requiredExecAmount;
      const lastRequiredBookAmount = lastRequiredExecAmount * bookAmount / execAmount;
      return { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
  }
  return null;
}

// api used by the backend

export interface Api {
  availableBalance(bookToken: string, maker: string): Promise<bigint>;
  listOrders(maker: string): Promise<Order[]>;
  insertOrder(order: Order): Promise<void>;
  lookupOrder(orderId: string): Promise<Order | null>;
  lookupOrders(bookToken: string, execToken: string): Promise<Order[]>;
  prepareExecution(bookToken: string, execToken: string, requiredBookAmount: bigint, requiredExecAmount: bigint): Promise<PreparedExecution | null>;
  updateOrders(orderIds: string[]): Promise<void>;
  refreshOrders(bookToken: string, execToken: string): Promise<void>;
}

export function createApi(web3: Web3, db: Db): Api {

  async function availableBalance(bookToken: string, maker: string): Promise<bigint> {
    return await _availableBalance(web3, db, bookToken, maker);
  }

  async function listOrders(maker: string): Promise<Order[]> {
    return await db.lookupUserOrders(maker);
  }

  async function insertOrder(order: Order): Promise<void> {
    _validateOrder(web3, order);
    const price = order.execAmount * 1000000000000000000n / order.bookAmount;
    const time = Date.now();
    const { startTime, endTime } = _extractSalt(order.salt);
    const executedBookAmount = await executedBookAmounts(web3, order.orderId);
    if (executedBookAmount >= order.bookAmount) throw new Error('Inactive order');
    const freeBookAmount = order.bookAmount - executedBookAmount;
    order.price = price;
    order.time = time;
    order.startTime = startTime;
    order.endTime = endTime;
    order.freeBookAmount = freeBookAmount;
    return await db.insertOrder(order);
  }

  async function lookupOrder(orderId: string): Promise<Order | null> {
    return await db.lookupOrder(orderId);
  }

  async function lookupOrders(bookToken: string, execToken: string): Promise<Order[]> {
    const time = Date.now();
    return await db.lookupOrders(bookToken, execToken, time);
  }

  async function prepareExecution(bookToken: string, execToken: string, requiredBookAmount: bigint, requiredExecAmount: bigint): Promise<PreparedExecution | null> {
    const time = Date.now();
    return await _prepareExecution(web3, db, bookToken, execToken, requiredBookAmount, requiredExecAmount, time);
  }

  async function updateOrders(orderIds: string[]): Promise<void> {
    const time = Date.now();
    const orders = await _fetchOrders(web3, db, orderIds);
    await _updateOrders(web3, db, orders, time);
  }

  async function refreshOrders(bookToken: string, execToken: string): Promise<void> {
    const time = Date.now();
    const orders = await db.lookupOrders(bookToken, execToken, time);
    if (await _isContract(web3, execToken)) {
      await _updateOrders(web3, db, orders, time);
    } else {
      await _removeOrders(web3, db, orders);
    }
  }

  return {
    availableBalance,
    listOrders,
    insertOrder,
    lookupOrder,
    lookupOrders,
    prepareExecution,
    updateOrders,
    refreshOrders,
  };
}
