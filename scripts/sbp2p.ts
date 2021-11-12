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
  const from = currentUser();
  const contract = new web3.eth.Contract(ERC20_ABI, token);
  await contract.methods.approve(spender, amount).send({ from, gas: 75000 });
}

const SBP2P_ABI = require('../build/contracts/SignatureBasedPeerToPeerMarkets.json').abi;
const SBP2P_ADDRESS: { [key in Network]: string } = {
  'mainnet': '0x0000000000000000000000000000000000000000',
  'kovan': '0x9e2873c1c89696987F671861901A06Ad7Cb97f8C',
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

async function executeOrder(value: bigint, bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, signature: string, requiredBookAmount: bigint): Promise<void> {
  const from = currentUser();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.executeOrder(bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount).send({ from, value: String(value), gas: 150000 });
}

async function executeOrders(value: bigint, bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], signatures: string[], lastRequiredBookAmount: bigint): Promise<void> {
  const from = currentUser();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  const siglist = '0x' + signatures.map((signature) => signature.substr(2)).join('');
  await contract.methods.executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, siglist, lastRequiredBookAmount).send({ from, value: String(value), gas: 150000 * salts.length + 50000 });
}

async function cancelOrder(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, salt: bigint): Promise<void> {
  const from = currentUser();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrder(bookToken, execToken, bookAmount, execAmount, salt).send({ from, gas: 75000 });
}

async function cancelOrders(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], salts: bigint[]): Promise<void> {
  const from = currentUser();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrders(bookToken, execToken, bookAmounts, execAmounts, salts).send({ from, gas: 75000 * salts.length + 25000 });
}

// db

let db: { [bookToken: string]: { [execToken: string]: Order[] } } = {};
let indexes: { [orderId: string]: { bookToken: string, execToken: string } } = {};

function dbLoad(): void {
  const decodeBigInt = (key: string, value: unknown) => typeof value === 'string' && /-?\d+n/.test(value) ? BigInt(value.slice(0, -1)) : value;
  try { const data = JSON.parse(fs.readFileSync('db-' + NETWORK + '.json').toString(), decodeBigInt); db = data.db; indexes = data.indexes; } catch (e) { }
}

function dbSave(): void {
  const encodeBigInt = (key: string, value: unknown) => typeof value === 'bigint' ? value.toString() + 'n' : value;
  try { fs.writeFileSync('db-' + NETWORK + '.json', JSON.stringify({ db, indexes }, encodeBigInt, 2)); } catch (e) { }
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

async function dbUpdateOrder(orderId: string, freeBookAmount: bigint): Promise<void> {
  const item = indexes[orderId];
  if (item === undefined) throw new Error('Unknown order: ' + orderId);
  const { bookToken, execToken } = item;
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  const index = level1.findIndex((order) => order.orderId == orderId);
  if (index < 0) throw new Error('Panic');
  const order = level1[index];
  if (order === undefined) throw new Error('Panic');
  order.freeBookAmount = freeBookAmount;
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
    sum += orders.reduce((acc, order) => acc + order.freeBookAmount, 0n);
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

const DEFAULT_ORDER_DURATION = 100 * 365 * 24 * 60 * 60 * 1000; // 100 years

type Order = {
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

function generateSalt(duration = DEFAULT_ORDER_DURATION, startTime = Date.now(), random = randomInt()): bigint {
  const endTime = startTime + duration;
  return BigInt(random) << 128n | BigInt(Math.floor(startTime / 1000)) << 64n | BigInt(Math.floor(endTime / 1000));
}

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

async function createLimitBuyOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = quoteToken;
  const execToken = baseToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount * price / 1000000000000000000n;
  const execAmount = amount;
  const freeBookAmount = bookAmount;
  const maker = currentUser();
  const time = Date.now();
  const salt = generateSalt(duration, time);
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, freeBookAmount, price, time, duration };
  const available = await availableForLimitOrder(bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await dbInsertOrder(order);
  return order;
}

async function createLimitSellOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint, duration = DEFAULT_ORDER_DURATION): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const bookToken = baseToken;
  const execToken = quoteToken;
  if (bookToken === '0x0000000000000000000000000000000000000000') throw new Error('Invalid token: ' + bookToken);
  const bookAmount = amount;
  const execAmount = amount * price / 1000000000000000000n;
  const freeBookAmount = bookAmount;
  const maker = currentUser();
  const time = Date.now();
  const salt = generateSalt(duration, time);
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const signature = await sign(orderId);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, freeBookAmount, price, time, duration };
  const available = await availableForLimitOrder(bookToken);
  if (available < bookAmount) throw new Error('Insufficient balance: ' + available);
  await dbInsertOrder(order);
  return order;
}

async function cancelLimitOrder(orderId: string, forceOnChain = false): Promise<void> {
  const maker = currentUser();
  const order = await dbLookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  if (order.maker !== maker) throw new Error('Invalid order: ' + orderId);
  const execAmount = await executedBookAmounts(orderId);
  if ((execAmount > 0n || forceOnChain) && (order.time + order.duration > Date.now())) {
    // the order was partially executed, exposed publicly, and needs to be cancelled on-chain
    const { bookToken, execToken, bookAmount, execAmount, salt } = order;
    await cancelOrder(bookToken, execToken, bookAmount, execAmount, salt);
  }
  await dbRemoveOrder(orderId);
}

type PreparedExecution = {
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

async function prepareMarketBuyOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = baseToken;
  const execToken = quoteToken;
  const orders = await dbLookupOrders(bookToken, execToken, 'asc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount, time, duration } of orders) {
    if (Date.now() >= time + duration) continue;
    available[maker] = available[maker] || await availableForLimitOrder(bookToken, maker);
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

async function prepareMarketSellOrder(baseToken: string, quoteToken: string, amount: bigint): Promise<PreparedExecution> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  const bookToken = quoteToken;
  const execToken = baseToken;
  const orders = await dbLookupOrders(bookToken, execToken, 'desc');
  const orderIds = [];
  const bookAmounts = [];
  const execAmounts = [];
  const makers = [];
  const salts = [];
  const signatures = [];
  const available: { [adress: string]: bigint } = {};
  for (const { orderId, bookAmount, execAmount, maker, salt, signature, freeBookAmount, time, duration } of orders) {
    if (Date.now() >= time + duration) continue;
    available[maker] = available[maker] || await availableForLimitOrder(bookToken, maker);
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

async function executeMarketOrder(prepared: PreparedExecution): Promise<void> {
  const { bookToken, execToken, orderIds, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount } = prepared;
  if (makers.length === 1) {
    const bookAmount = bookAmounts[0] || 0n;
    const execAmount = execAmounts[0] || 0n;
    const maker = makers[0] || '';
    const salt = salts[0] || 0n;
    const signature = signatures[0] || '';
    const requiredBookAmount = lastRequiredBookAmount;
    const requiredExecAmount = await checkOrderExecution(bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    await executeOrder(value, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, requiredBookAmount);
  } else {
    const requiredExecAmount = await checkOrdersExecution(bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount);
    if (requiredExecAmount <= 0n) throw new Error('Preparation invalidated');
    const value = execToken === '0x0000000000000000000000000000000000000000' ? requiredExecAmount : 0n;
    await executeOrders(value, bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount);
  }
  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];
    if (orderId === undefined) throw new Error('Panic');
    const bookAmount = bookAmounts[i];
    if (bookAmount === undefined) throw new Error('Panic');
    const executedBookAmount = await executedBookAmounts(orderId);
    if (executedBookAmount >= bookAmount) {
      await dbRemoveOrder(orderId);
    } else {
      const freeBookAmount = bookAmount - executedBookAmount;
      await dbUpdateOrder(orderId, freeBookAmount);
    }
  }
}

// main

async function main(args: string[]): Promise<void> {
  const privateKey = args[2];
  if (privateKey === undefined) throw new Error('Missing privateKey');
  const command = args[3];

  web3 = initWeb3(privateKey);

  const ETH = '0x0000000000000000000000000000000000000000';
  const TEST = '0xfC0d9D4e5821Ee772e6c6dE75256f5c96E545DD0';

  if (command === 'unlock') {
    await enableOrderCreation(TEST);
  }
  else
  if (command === 'create') {
    const order = await createLimitSellOrder(TEST, ETH, 6000000000000000000n, 100000000000000n); // 6 TEST for 0.0001 ETH
    console.log(order);
  }
  else
  if (command === 'cancel') {
    const orderId = args[4];
    if (orderId === undefined) throw new Error('Missing orderId');
    await cancelLimitOrder(orderId, true);
  }
  else
  if (command === 'execute') {
    const prepared = await prepareMarketBuyOrder(TEST, ETH, 9000000000000000000n); // 9 TEST
    await executeMarketOrder(prepared);
  }
}

entrypoint(main);
