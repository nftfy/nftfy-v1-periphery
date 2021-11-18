import Web3 from 'web3';

import { Order, PreparedExecution } from './types';
import { Api } from './backend';
import { decimals, balanceOf, allowance, approve } from './token';
import { ADDRESS, executedBookAmounts, generateOrderId, checkOrderExecution, checkOrdersExecution, executeOrder, executeOrders, cancelOrder, cancelOrders } from './orderbook';

type SendOptions = {
  from?: string;
  gasPrice?: string | bigint;
  gas?: number;
  value?: number | string | bigint;
  nonce?: number;
};

const DEFAULT_ORDER_DURATION = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

function _randomInt(limit = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(Math.random() * limit);
}

function _coins(units: bigint, decimals: number): string {
  if (units < 0n) throw new Error('Invalid units: ' + units);
  const _units = String(units);
  if (decimals == 0) return _units;
  const s = _units.padStart(1 + decimals, '0');
  return s.slice(0, -decimals) + '.' + s.slice(-decimals);
}

function _units(coins: string, decimals: number): bigint {
  const regex = new RegExp(`^\\d+${decimals > 0 ? `(\\.\\d{1,${decimals}})?` : ''}$`);
  if (!regex.test(coins)) throw new Error('Invalid coins: ' + coins);
  let index = coins.indexOf('.');
  if (index < 0) index = coins.length;
  const s = coins.slice(index + 1);
  return BigInt(coins.slice(0, index) + s + '0'.repeat(decimals - s.length));
}

async function _currentUser(web3: Web3): Promise<string> {
  const [address] = await web3.eth.getAccounts();
  if (address === undefined) throw new Error('No account set');
  return address;
}

async function _signHash(web3: Web3, hash: string): Promise<string> {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('No account set');
  const signature = await web3.eth.personal.sign(hash, account.address, '');
  return signature;
}

function _generateSalt(startTime: number, endTime: number, random = _randomInt()): bigint {
  if (startTime < 0 || startTime > Number.MAX_SAFE_INTEGER) throw new Error('Invalid startTime: ' + startTime);
  if (endTime < 0 || endTime > Number.MAX_SAFE_INTEGER) throw new Error('Invalid endTime: ' + endTime);
  if (random < 0 || random > Number.MAX_SAFE_INTEGER) throw new Error('Invalid random: ' + random);
  return BigInt(random) << 128n | BigInt(Math.floor(endTime / 1000)) << 64n | BigInt(Math.floor(startTime / 1000));
}

// api used by the frontend

export async function availableBalance(web3: Web3, api: Api, bookToken: string): Promise<string> {
  const maker = await _currentUser(web3);
  const bookDecimals = await decimals(web3, bookToken);
  return _coins(await api.availableBalance(bookToken, maker), bookDecimals);
}

export async function requiresEnableOrderCreation(web3: Web3, api: Api, bookToken: string): Promise<boolean> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const maker = await _currentUser(web3);
  const approved = await allowance(web3, bookToken, maker, ADDRESS);
  return approved < 2n ** 128n;
}

export async function enableOrderCreation(web3: Web3, api: Api, bookToken: string, options: SendOptions = {}): Promise<string> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  return await approve(web3, bookToken, ADDRESS, 2n ** 256n - 1n, options);
}

export async function createLimitBuyOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, _amount: string, _cost: string, duration = DEFAULT_ORDER_DURATION): Promise<string> {
  const bookToken = quoteToken;
  const execToken = baseToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookDecimals = await decimals(web3, bookToken);
  const execDecimals = execToken === '0x0000000000000000000000000000000000000000' ? 18 : await decimals(web3, execToken);
  const bookAmount = _units(_cost, bookDecimals);
  const execAmount = _units(_amount, execDecimals);
  if (bookAmount <= 0n) throw new Error('Invalid bookAmount: ' + bookAmount);
  if (execAmount <= 0n) throw new Error('Invalid execAmount: ' + execAmount);
  if (bookAmount * execAmount >= 2n ** 256n) throw new Error('Numeric overflow');
  const maker = await _currentUser(web3);
  const available = await api.availableBalance(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  const freeBookAmount = bookAmount;
  const time = Date.now();
  const startTime = time;
  const endTime = startTime + duration;
  const salt = _generateSalt(startTime, endTime);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await _signHash(web3, orderId);
  const price = execAmount * 1000000000000000000n / bookAmount;
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time, startTime, endTime, freeBookAmount };
  await api.insertOrder(order);
  return orderId;
}

export async function createLimitSellOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, _amount: string, _cost: string, duration = DEFAULT_ORDER_DURATION): Promise<string> {
  const bookToken = baseToken;
  const execToken = quoteToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookDecimals = await decimals(web3, bookToken);
  const execDecimals = execToken === '0x0000000000000000000000000000000000000000' ? 18 : await decimals(web3, execToken);
  const bookAmount = _units(_amount, bookDecimals);
  const execAmount = _units(_cost, execDecimals);
  if (bookAmount <= 0n) throw new Error('Invalid bookAmount: ' + bookAmount);
  if (execAmount <= 0n) throw new Error('Invalid execAmount: ' + execAmount);
  if (bookAmount * execAmount >= 2n ** 256n) throw new Error('Numeric overflow');
  const maker = await _currentUser(web3);
  const available = await api.availableBalance(bookToken, maker);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  const freeBookAmount = bookAmount;
  const time = Date.now();
  const startTime = time;
  const endTime = startTime + duration;
  const salt = _generateSalt(startTime, endTime);
  const orderId = await generateOrderId(web3, bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await _signHash(web3, orderId);
  const price = execAmount * 1000000000000000000n / bookAmount;
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time, startTime, endTime, freeBookAmount };
  await api.insertOrder(order);
  return orderId;
}

export async function cancelLimitOrder(web3: Web3, api: Api, orderId: string, options: SendOptions = {}): Promise<string | null> {
  const maker = await _currentUser(web3);
  const order = await api.lookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const executedBookAmount = await executedBookAmounts(web3, orderId);
  const time = Date.now();
  let txId: string | null = null;
  if (executedBookAmount < order.bookAmount && order.endTime > time) {
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    txId = await cancelOrder(web3, bookToken, execToken, bookAmount, execAmount, salt, options);
  }
  await api.updateOrders([orderId]);
  return txId;
}

export async function prepareMarkerBuyOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, _amount: string): Promise<PreparedExecution | null> {
  const bookToken = baseToken;
  const execToken = quoteToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookDecimals = await decimals(web3, bookToken);
  const requiredBookAmount = _units(_amount, bookDecimals);
  return await api.prepareExecution(bookToken, execToken, requiredBookAmount);
}

export async function prepareMarkerSellOrder(web3: Web3, api: Api, baseToken: string, quoteToken: string, _cost: string): Promise<PreparedExecution | null> {
  const bookToken = quoteToken;
  const execToken = baseToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookDecimals = await decimals(web3, bookToken);
  const requiredBookAmount = _units(_cost, bookDecimals);
  return await api.prepareExecution(bookToken, execToken, requiredBookAmount);
}

export async function executeMarketOrder(web3: Web3, api: Api, prepared: PreparedExecution, options: SendOptions = {}): Promise<string> {
  const { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount } = prepared;
  let txId: string;
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
    txId = await executeOrder(web3, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount, { value, ...options });
  } else {
    const requiredExecAmount = await checkOrdersExecution(web3, bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    txId = await executeOrders(web3, bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount, { value, ...options });
  }
  await api.updateOrders(orderIds);
  return txId;
}
