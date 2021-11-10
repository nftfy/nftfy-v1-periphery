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

const PRIVATE_KEY = process.env['PRIVATE_KEY'] || '';
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

function getWeb3(): Web3 {
  const web3 = new Web3(HTTP_PROVIDER_URLS[NETWORK]);
  const account = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
  web3.eth.accounts.wallet.add(account);
  return web3;
}

// abi

const SBP2P_ABI = require('../build/contracts/SignatureBasedPeerToPeerMarkets.json').abi;
const SBP2P_ADDRESS: { [key in Network]: string } = {
  'mainnet': '0x0000000000000000000000000000000000000000',
  'kovan': '0x4ac3563829ca52af878d937Ef7fC1995378DE7A9',
};

async function generateOrderId(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint): Promise<string> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return await contract.methods.generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt).call();
}

async function checkOrderExecution(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, requiredBookAmount: bigint): Promise<bigint> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return await contract.methods.checkOrderExecution(bookToken, execToken, bookAmount, execAmount, maker, salt, requiredBookAmount).call();
}

async function checkOrdersExecution(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], lastRequiredBookAmount: bigint): Promise<bigint> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  return await contract.methods.checkOrdersExecution(bookToken, execToken, bookAmounts, execAmounts, makers, salts, lastRequiredBookAmount).call();
}

async function executeOrder(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, maker: string, salt: bigint, signature: string, requiredBookAmount: bigint): Promise<void> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.executeOrder(bookToken, execToken, bookAmount, execAmount, salt, signature, requiredBookAmount).send();
}

async function executeOrders(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], makers: string[], salts: bigint[], signatures: string, lastRequiredBookAmount: bigint): Promise<void> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.executeOrders(bookToken, execToken, bookAmounts, execAmounts, makers, salts, signatures, lastRequiredBookAmount).send();
}

async function cancelOrder(bookToken: string, execToken: string, bookAmount: bigint, execAmount: bigint, salt: bigint): Promise<void> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrder(bookToken, execToken, bookAmount, execAmount, salt).send();
}

async function cancelOrders(bookToken: string, execToken: string, bookAmounts: bigint[], execAmounts: bigint[], salts: bigint[]): Promise<void> {
  const web3 = getWeb3();
  const contract = new web3.eth.Contract(SBP2P_ABI, SBP2P_ADDRESS[NETWORK]);
  await contract.methods.cancelOrders(bookToken, execToken, bookAmounts, execAmounts, salts).send();
}

// db

const db: { [bookToken: string]: { [execToken: string]: Order[] } } = {};
const indexes: { [orderId: string]: { bookToken: string, execToken: string } } = {};

async function dbInsertOrder(order: Order): Promise<void> {
  const { orderId, bookToken, execToken } = order;
  if (indexes[orderId] !== undefined) throw new Error('Duplicate order: ' + orderId);
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  level1.push({ ...order });
  indexes[orderId] = { bookToken, execToken };
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

async function dbLookupOrders(bookToken: string, execToken: string, direction: 'asc' | 'desc', maker = ''): Promise<Order[]> {
  const level0 = db[bookToken] || (db[bookToken] = {});
  const level1 = level0[execToken] || (level0[execToken] = []);
  const orders = [...level1.filter((order) => order.maker === (maker || order.maker))];
  if (direction === 'asc') {
    orders.sort((order1, order2) => order1.price < order2.price ? -1 : order1.price > order2.price ? 1 : 0);
    return orders;
  }
  if (direction === 'desc') {
    orders.sort((order1, order2) => order1.price > order2.price ? -1 : order1.price < order2.price ? 1 : 0);
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
};

async function createLimitBuyOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const web3 = getWeb3();
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  const bookToken = quoteToken;
  const execToken = baseToken;
  const bookAmount = amount * price / 1000000000000000000n;
  const execAmount = amount;
  const maker = account.address;
  const salt = BigInt(randomInt());
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const { signature } = await web3.eth.accounts.sign(orderId, PRIVATE_KEY);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price };
  await dbInsertOrder(order);
  return order;
}

async function createLimitSellOrder(baseToken: string, quoteToken: string, amount: bigint, price: bigint): Promise<Order> {
  if (amount <= 0n) throw new Error('Invalid amount: ' + amount);
  if (price <= 0n) throw new Error('Invalid price: ' + price);
  const web3 = getWeb3();
  const account = web3.eth.accounts.wallet[0];
  if (account === undefined) throw new Error('Panic');
  const bookToken = baseToken;
  const execToken = quoteToken;
  const bookAmount = amount;
  const execAmount = amount * price / 1000000000000000000n;
  const maker = account.address;
  const salt = BigInt(randomInt());
  const orderId = await generateOrderId(bookToken, execToken, bookAmount, execAmount, maker, salt);
  const { signature } = await web3.eth.accounts.sign(orderId, PRIVATE_KEY);
  const order = { orderId, bookToken, execToken, bookAmount, execAmount, maker, salt, signature, price };
  await dbInsertOrder(order);
  return order;
}

async function cancelLimitOrder(orderId: string): Promise<void> {
  const order = await dbLookupOrder(orderId);
  if (order === null) throw new Error('Unknown order: ' + orderId);
  const { bookToken, execToken, bookAmount, execAmount, salt } = order;
  await cancelOrder(bookToken, execToken, bookAmount, execAmount, salt);
  await dbRemoveOrder(orderId);
}

// main

async function main(args: string[]): Promise<void> {
  const ETH = '0x0000000000000000000000000000000000000000';
  const TEST = '0xfC0d9D4e5821Ee772e6c6dE75256f5c96E545DD0';
  const order = await createLimitSellOrder(TEST, ETH, 5000000000000000000n, 1000000000000000000n);
  console.log(order);
}

entrypoint(main);
