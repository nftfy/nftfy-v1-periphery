import fs from 'fs';
import Web3 from 'web3';

import {
  Order,
  Api,
  Db,
  enableOrderCreation,
  createLimitSellOrder,
  cancelLimitOrder,
  executeMarketOrder,
  apiAvailableForLimitOrder,
  apiInsertOrder,
  apiRemoveOrder,
  apiLookupOrder,
  apiPrepareMarketBuyOrder,
  apiPrepareMarketSellOrder,
  apiRegisterMarketOrder,
} from './index';

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

// db

function createDb(): Db {

  let db: { [bookToken: string]: { [execToken: string]: Order[] } } = {};
  let indexes: { [orderId: string]: { bookToken: string, execToken: string } } = {};

  function load(): void {
    const decodeBigInt = (key: string, value: unknown) => typeof value === 'string' && /-?\d+n/.test(value) ? BigInt(value.slice(0, -1)) : value;
    try { const data = JSON.parse(fs.readFileSync('db-' + NETWORK + '.json').toString(), decodeBigInt); db = data.db; indexes = data.indexes; } catch (e) { }
  }

  function save(): void {
    const encodeBigInt = (key: string, value: unknown) => typeof value === 'bigint' ? value.toString() + 'n' : value;
    try { fs.writeFileSync('db-' + NETWORK + '.json', JSON.stringify({ db, indexes }, encodeBigInt, 2)); } catch (e) { }
  }

  load();

  async function insertOrder(order: Order): Promise<void> {
    const { orderId, bookToken, execToken } = order;
    if (indexes[orderId] !== undefined) throw new Error('Duplicate order: ' + orderId);
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    level1.push({ ...order });
    indexes[orderId] = { bookToken, execToken };
    save();
  }

  async function removeOrder(orderId: string): Promise<void> {
    const item = indexes[orderId];
    if (item === undefined) throw new Error('Unknown order: ' + orderId);
    const { bookToken, execToken } = item;
    const level0 = db[bookToken] || (db[bookToken] = {});
    const level1 = level0[execToken] || (level0[execToken] = []);
    const index = level1.findIndex((order) => order.orderId == orderId);
    if (index < 0) throw new Error('Panic');
    level1.splice(index, 1);
    delete indexes[orderId];
    save();
  }

  async function updateOrder(orderId: string, freeBookAmount: bigint): Promise<void> {
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
    save();
  }

  async function lookupOrder(orderId: string): Promise<Order | null> {
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

  async function lookupOrders(bookToken: string, execToken: string, direction: 'asc' | 'desc', maker = ''): Promise<Order[]> {
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

  async function bookSumOrders(bookToken: string, maker = ''): Promise<bigint> {
    const level0 = db[bookToken] || (db[bookToken] = {});
    let sum = 0n;
    for (const level1 of Object.values(level0)) {
      const orders = [...level1.filter((order) => order.maker === (maker || order.maker))];
      sum += orders.reduce((acc, order) => acc + order.freeBookAmount, 0n);
    }
    return sum;
  }

  return { insertOrder, removeOrder, updateOrder, lookupOrder, lookupOrders, bookSumOrders };
}

// main

async function main(args: string[]): Promise<void> {
  const privateKey = args[2];
  if (privateKey === undefined) throw new Error('Missing privateKey');
  const command = args[3];

  const web3 = initWeb3(privateKey);
  const db = createDb();
  const api: Api = {
    availableForLimitOrder: (bookToken, maker) => apiAvailableForLimitOrder(web3, db, bookToken, maker),
    insertOrder: (order) => apiInsertOrder(db, order),
    removeOrder: (orderId) => apiRemoveOrder(db, orderId),
    lookupOrder: (orderId) => apiLookupOrder(db, orderId),
    prepareMarketBuyOrder: (baseToken, quoteToken, amount) => apiPrepareMarketBuyOrder(web3, db, baseToken, quoteToken, amount),
    prepareMarketSellOrder: (baseToken, quoteToken, amount) => apiPrepareMarketSellOrder(web3, db, baseToken, quoteToken, amount),
    registerMarketOrder: (prepared) => apiRegisterMarketOrder(web3, db, prepared),
  };

  const ETH = '0x0000000000000000000000000000000000000000';
  const TEST = '0xfC0d9D4e5821Ee772e6c6dE75256f5c96E545DD0';

  if (command === 'unlock') {
    await enableOrderCreation(web3, TEST);
  }
  else
  if (command === 'create') {
    const order = await createLimitSellOrder(web3, api, TEST, ETH, 6000000000000000000n, 100000000000000n); // 6 TEST for 0.0001 ETH
    console.log(order);
  }
  else
  if (command === 'cancel') {
    const orderId = args[4];
    if (orderId === undefined) throw new Error('Missing orderId');
    await cancelLimitOrder(web3, api, orderId, true);
  }
  else
  if (command === 'execute') {
    const prepared = await api.prepareMarketBuyOrder(TEST, ETH, 9000000000000000000n); // 9 TEST
    await executeMarketOrder(web3, api, prepared);
  }
}

entrypoint(main);
