import fs from 'fs';
import Web3 from 'web3';

// runtime

type MainFn = (argv: string[]) => Promise<void>;

async function entrypoint(main: MainFn): Promise<void> {
  try {
    await main(process.argv);
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
  process.exit(0);
}

function randomInt(limit = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(Math.random() * limit);
}

// web3

type Network = 'mainnet' | 'kovan';

const INFURA_PROJECT_ID = process.env['INFURA_PROJECT_ID'] || '';

const HTTP_PROVIDER_URLS: { [key in Network]: string } = {
  'mainnet': 'https://mainnet.infura.io/v3/' + INFURA_PROJECT_ID,
  'kovan': 'https://kovan.infura.io/v3/' + INFURA_PROJECT_ID,
};

function _network(network: string): Network {
  if (network in HTTP_PROVIDER_URLS) return network as Network;
  throw new Error('Unknown network: ' + network);
}

const NETWORK = _network(process.env['NETWORK'] || 'kovan');

function initWeb3(privateKey: string): Web3 {
  const web3 = new Web3(HTTP_PROVIDER_URLS[NETWORK]);
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  return web3;
}

let web3: Web3;

function currentUser(): string {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  return account.address;
}

async function sign(hash: string): Promise<string> {
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  const { signature } = await web3.eth.accounts.sign(hash, account.privateKey);
  return signature
}

// abi

const ERC20_ABI = require('../build/contracts/ERC20.json').abi;

async function balanceOf(token: string, account: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ERC20_ABI, token);
  return BigInt(await contract.methods.balanceOf(account).call());
}

async function allowance(token: string, account: string, spender: string): Promise<bigint> {
  const contract = new web3.eth.Contract(ERC20_ABI, token);
  return BigInt(await contract.methods.allowance(account, spender).call());
}

async function approve(token: string, spender: string, amount: bigint): Promise<void> {
  const contract = new web3.eth.Contract(ERC20_ABI, token);
  await contract.methods.approve(spender, amount).send();
}

const SBP2P_ABI = require('../build/contracts/SignatureBasedPeerToPeerMarkets.json').abi;
const SBP2P_ADDRESS: { [key in Network]: string } = {
  'mainnet': '0x0000000000000000000000000000000000000000',
  'kovan': '0x4ac3563829ca52af878d937Ef7fC1995378DE7A9',
};

async function executedBookAmounts(orderId: string): Promise<bigint> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return BigInt(await contract.methods.executedBookAmounts(orderId).call());
}

async function generateOrderId(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint): Promise<string> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return await contract.methods.generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt).call();
}

async function checkOrderExecution(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, requiredBookAmount: bigint): Promise<bigint> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return BigInt(await contract.methods.checkOrderExecution(bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount).call());
}

async function checkOrdersExecution(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], lastRequiredBookAmount: bigint): Promise<bigint> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return BigInt(await contract.methods.checkOrdersExecution(bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount).call());
}

async function executeOrder(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, signature: string, requiredBookAmount: bigint): Promise<void> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.executeOrder(bookToken, execToken, bookAmount, execAmount, salt, signature, requiredBookAmount).send();
}

async function executeOrders(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], signatures: string[], lastRequiredBookAmount: bigint): Promise<void> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  const siglist = '0x' + signatures.map((signature) => signature.substr(2)).join('');
  await contract.methods.executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, siglist, lastRequiredBookAmount).send();
}

async function cancelOrder(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, salt: bigint): Promise<void> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrder(bookToken, execToken, bookAmount, execAmount, salt).send();
}

async function cancelOrders(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], salts: bigint[]): Promise<void> {
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrders(bookToken, execToken, bookAmounts, execAmounts, salts).send();
}

// db

let db: { [bookToken: string]: { [execToken: string]: Order[] } } = {};
let indexes: { [orderId: string]: { bookToken: string, execToken: string } } = {};

function dbLoad(): void {
  try { const data = JSON.parse(fs.readFileSync('db-' + NETWORK + '.json').toString()); db = data.db; indexes = data.indexes; } catch (e) { }
}

function dbSave(): void {
  try { fs.writeFileSync('db-' + NETWORK + '.json', JSON.stringify({ db, indexes }, undefined, 2)); } catch (e) { }
}

dbLoad();

async function dbInsertOrder(order: Order): Promise<void> {
  const { orderId, bookToken, execToken } = order;
  if (indexes[orderId] !== undefined) throw new Error('Duplicate order: ' + orderId);
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  level1.push({ ...order });
  indexes[orderId] = { bookToken, execToken };
  dbSave();
}

async function dbRemoveOrder(orderId: string): Promise<void> {
  const item = indexes[orderId];
  if (item === undefined) throw new Error('Unknown order: ' + orderId);
  const { bookToken, execToken } = item;
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  const index = level1.findIndex((order) => order.orderId == orderId);
  if (index < 0) throw new Error('Panic');
  level1.splice(index, 1);
  delete indexes[orderId];
  dbSave();
}

async function dbLookupOrder(orderId: string): Promise<Order | null> {
  const item = indexes[orderId];
  if (item === undefined) return null;
  const { bookToken, execToken } = item;
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  const index = level1.findIndex((order) => order.orderId == orderId);
  if (index < 0) throw new Error('Panic');
  const order = level1[index];
  if (order === undefined) throw new Error('Panic');
  return order;
}

async function dbBookSumOrders(bookToken: string, maker = ''): Promise<bigint> {
  const level0 = db[bookToken] || (db[bookToken] = {});
  let sum = 0n;
  for (const level1 of Object.values(level0)) {
    const orders = [...level1.filter((order) => order.maker === (maker || order.maker))];
    sum += orders.reduce((acc, order) => acc + order.bookAmount, 0n);
  }
  return sum;
}

async function dbLookupOrders(bookToken: string, execToken: string, direction: 'asc' | 'desc', maker = ''): Promise<Order[]> {
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  const orders = [...level1.filter((order) => order.maker === (maker || order.maker))];
  if (direction === 'asc') {
    orders.sort((order1, order2) => order1.price < order2.price ? -1 : order1.price > order2.price ? 1 : order1.time - order2.time);
    return orders;
  }
  if (direction === 'desc') {
    orders.sort((order1, order2) => order2.price < order1.price ? -1 : order2.price > order1.price ? 1 : order2.time - order1.time);
    return orders;
  }
  throw new Error('Panic');
}

// lib

type Order = {
  orderId: string;
  bookToken: string;
  execToken: string;
  bookAmount: bigint;
  execAmount: bigint;
  maker: string;
  salt: bigint;
  signature: string;

  price: bigint;
  time: number;
};

async function enableOrderCreation(bookToken: string): Promise<void> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  await approve(bookToken, SBP2P_ADDRESS[NETWORK], 2n ** 256n - 1n);
}

async function availableForLimitOrder(bookToken: string, maker = currentUser()): Promise<bigint> {
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const balance = await balanceOf(bookToken, maker);
  const approved = await allowance(bookToken, maker, SBP2P_ADDRESS[NETWORK]);
  const free = balance < approved ? balance : approved;
  const used = await dbBookSumOrders(bookToken, maker);
  return free >= used ? free - used : -1n;
}

async function createLimitBuyOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = quoteToken;
  const execToken = baseToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount * price / 1000000000000000000n;
  const execAmount = amount;
  const maker = currentUser();
  const salt = BigInt(randomInt());
  const time = Date.now();
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time };
  const available = await availableForLimitOrder(bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await dbInsertOrder(order);
  return order;
}

async function createLimitSellOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = baseToken;
  const execToken = quoteToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount;
  const execAmount = amount * price / 1000000000000000000n;
  const maker = currentUser();
  const salt = BigInt(randomInt());
  const time = Date.now();
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price, time };
  const available = await availableForLimitOrder(bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await dbInsertOrder(order);
  return order;
}

async function cancelLimitOrder(orderId: string): Promise<void> {
  const maker = currentUser();
  const order = await dbLookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const execAmount = await executedBookAmounts(orderId);
  if (execAmount > 0n) {
    // the order was partially executed, exposed publicly, and needs to be cancelled on-chain
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    await cancelOrder(bookToken, execToken, bookAmount, execAmount, salt);
  }
  await dbRemoveOrder(orderId);
}

type PreparedExecution = {
  bookToken: string;
  execToken: string;
  bookAmounts: bigint[];
  execAmounts: bigint[];
  makers: string[];
  salts: bigint[];
  signatures: string[];
  lastRequiredBookAmount: bigint;
};

async function prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = baseToken;
  const execToken = quoteToken;
  const orders = await dbLookupOrders(bookToken, execToken, 'asc');
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { bookAmount, execAmount, maker, salt, signature } of orders) {
    available[maker] = available[maker] || await availableForLimitOrder(bookToken, maker);
    if (available[maker] || 0n < 0n) continue;
    bookAmounts.push(bookAmount);
    execAmounts.push(execAmount);
    makers.push(maker);
    salts.push(salt);
    signatures.push(signature);
    amount -= bookAmount;
    if (amount <= 0n) {
      const lastRequiredBookAmount = bookAmount + amount;
      return { bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
  }
  throw new Error('Insufficient liquidity');
}

async function prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = quoteToken;
  const execToken = baseToken;
  const orders = await dbLookupOrders(bookToken, execToken, 'desc');
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { bookAmount, execAmount, maker, salt, signature } of orders) {
    available[maker] = available[maker] || await availableForLimitOrder(bookToken, maker);
    if (available[maker] || 0n < 0n) continue;
    bookAmounts.push(bookAmount);
    execAmounts.push(execAmount);
    makers.push(maker);
    salts.push(salt);
    signatures.push(signature);
    amount -= execAmount;
    if (amount <= 0n) {
      const lastRequiredExecAmount = execAmount + amount;
      const lastRequiredBookAmount = lastRequiredExecAmount * bookAmount / execAmount;
      return { bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount };
    }
  }
  throw new Error('Insufficient liquidity');
}

async function executeMarketOrder(prepared: PreparedExecution): Promise<void> {
  const { bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount } = prepared;
  if (makers.length === 1) {
    const bookAmount = bookAmounts[0] || 0n;
    const execAmount = execAmounts[0] || 0n;
    const maker = makers[0] || '';
    const salt = salts[0] || 0n;
    const signature = signatures[0] || '';
    const requiredBookAmount = lastRequiredBookAmount;
    const amount = await checkOrderExecution(bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount);
    if (amount <= 0n) throw new Error('Order invalidated');
    await executeOrder(bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount);
  } else {
    const amount = await checkOrdersExecution(bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount);
    if (amount <= 0n) throw new Error('Order invalidated');
    await executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount);
  }
}

// main

async function main(args: string[]): Promise<void> {
  const privateKey = args[2];
  if (privateKey === undefined) throw new Error('Missing private key');
  web3 = initWeb3(privateKey);
  const ETH = '0x0000000000000000000000000000000000000000';
  const TEST = '0xfC0d9D4e5821Ee772e6c6dE75256f5c96E545DD0';
  const order = await createLimitSellOrder(TEST, ETH, 5000000000000000000n, 1000000000000000000n);
  console.log(order);
}

entrypoint(main);
