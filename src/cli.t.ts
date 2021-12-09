import Web3 from 'web3';

import { Order, Api, Db, enableOrderCreation, createLimitSellOrder, cancelLimitOrder, prepareMarkerBuyOrderFromAmount, executeMarketOrder, createApi } from './index';
import { createDb } from './file-db';

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

function _initWeb3(privateKey: string): Web3 {
  const web3 = new Web3(HTTP_PROVIDER_URLS[NETWORK]);
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  return web3;
}

async function main(args: string[]): Promise<void> {
  const privateKey = args[2];
  if (privateKey === undefined) throw new Error('Missing privateKey');
  const command = args[3];

  const web3 = _initWeb3(privateKey);
  const api = createApi(web3, createDb('db-' + NETWORK + '.json'));

  const ETH = '0x0000000000000000000000000000000000000000';
  const TEST = '0xfC0d9D4e5821Ee772e6c6dE75256f5c96E545DD0';

  if (command === 'unlock') {
    await enableOrderCreation(web3, api, TEST);
  }
  else
  if (command === 'create') {
    const order = await createLimitSellOrder(web3, api, TEST, ETH, '6', '0.0001'); // 6 TEST for 0.0001 ETH
    console.log(order);
  }
  else
  if (command === 'cancel') {
    const orderId = args[4];
    if (orderId === undefined) throw new Error('Missing orderId');
    await cancelLimitOrder(web3, api, orderId);
  }
  else
  if (command === 'execute') {
    const prepared = await prepareMarkerBuyOrderFromAmount(web3, api, TEST, ETH, '9'); // 9 TEST
    if (prepared === null) throw new Error('Insufficient liquidity');
    await executeMarketOrder(web3, api, prepared);
  }
}

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

entrypoint(main);
