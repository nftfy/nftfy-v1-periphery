require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');
const gasLimit = process.env['GAS_LIMIT'];
const gasPrice = process.env['GAS_PRICE'];
const privateKey = process.env['PRIVATE_KEY'];
const infuraProjectId = process.env['INFURA_PROJECT_ID'];

module.exports = {
  compilers: {
    solc: {
      version: '0.6.12',
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  networks: {
    mainnet: {
      network_id: 1,
      gasPrice,
      provider: () => new HDWalletProvider(privateKey, 'https://mainnet.infura.io/v3/' + infuraProjectId),
      skipDryRun: false,
    },
    kovan: {
      network_id: 42,
      gasPrice,
      provider: () => new HDWalletProvider(privateKey, 'https://kovan.infura.io/v3/' + infuraProjectId),
      skipDryRun: true,
    },
    development: {
      network_id: '*',
      gas: gasLimit,
      host: 'localhost',
      port: 8545,
      skipDryRun: true,
    },
  },
};
