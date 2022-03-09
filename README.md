# Nftfy V1 Periphery

[![Truffle CI Actions Status](https://github.com/nftfy/nftfy-v1-periphery/workflows/Truffle%20CI/badge.svg)](https://github.com/nftfy/nftfy-v1-periphery/actions)

Peripheral smart contracts for interacting with Nftfy V1.

## Deployed Contracts

Ethereum:

| Contract                        | Network (ID) | Address                                                                                                               |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | mainnet (1)  | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://etherscan.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | mainnet (1)  | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://etherscan.io/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | mainnet (1)  | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://etherscan.io/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | mainnet (1)  | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://etherscan.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | mainnet (1)  | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://etherscan.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |

| Contract                        | Network (ID) | Address                                                                                                                       |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | ropsten (3)  | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://ropsten.etherscan.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | ropsten (3)  | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://ropsten.etherscan.io/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | ropsten (3)  | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://ropsten.etherscan.io/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | ropsten (3)  | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://ropsten.etherscan.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | ropsten (3)  | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://ropsten.etherscan.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | ropsten (3)  | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://ropsten.etherscan.io/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

| Contract                        | Network (ID) | Address                                                                                                                       |
| ------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | rinkeby (4)  | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://rinkeby.etherscan.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | rinkeby (4)  | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://rinkeby.etherscan.io/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | rinkeby (4)  | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://rinkeby.etherscan.io/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | rinkeby (4)  | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://rinkeby.etherscan.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | rinkeby (4)  | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://rinkeby.etherscan.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | rinkeby (4)  | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://rinkeby.etherscan.io/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

| Contract                        | Network (ID) | Address                                                                                                                     |
| ------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | kovan (42)   | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://kovan.etherscan.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | kovan (42)   | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://kovan.etherscan.io/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | kovan (42)   | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://kovan.etherscan.io/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | kovan (42)   | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://kovan.etherscan.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | kovan (42)   | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://kovan.etherscan.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | kovan (42)   | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://kovan.etherscan.io/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

| Contract                        | Network (ID) | Address                                                                                                                      |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | goerli (5)   | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://goerli.etherscan.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | goerli (5)   | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://goerli.etherscan.io/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | goerli (5)   | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://goerli.etherscan.io/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | goerli (5)   | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://goerli.etherscan.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | goerli (5)   | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://goerli.etherscan.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | goerli (5)   | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://goerli.etherscan.io/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

Avalanche:

| Contract                        | Network (ID)     | Address                                                                                                               |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | avaxmain (43114) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://snowtrace.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | avaxmain (43114) | N/A                                                                                                                   |
| NftfyCollection                 | avaxmain (43114) | N/A                                                                                                                   |
| PeerToPeerMarkets               | avaxmain (43114) | N/A                                                                                                                   |
| SignatureBasedPeerToPeerMarkets | avaxmain (43114) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://snowtrace.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |

| Contract                        | Network (ID)     | Address                                                                                                                       |
| ------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | avaxtest (43113) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://testnet.snowtrace.io/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | avaxtest (43113) | N/A                                                                                                                           |
| NftfyCollection                 | avaxtest (43113) | N/A                                                                                                                           |
| PeerToPeerMarkets               | avaxtest (43113) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://testnet.snowtrace.io/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | avaxtest (43113) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://testnet.snowtrace.io/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | avaxtest (43113) | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://testnet.snowtrace.io/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

Binance Smart Chain:

| Contract                        | Network (ID) | Address                                                                                                              |
| ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | bscmain (56) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://bscscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | bscmain (56) | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://bscscan.com/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | bscmain (56) | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://bscscan.com/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | bscmain (56) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://bscscan.com/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | bscmain (56) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://bscscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |

| Contract                        | Network (ID) | Address                                                                                                                      |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | bsctest (97) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://testnet.bscscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | bsctest (97) | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://testnet.bscscan.com/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | bsctest (97) | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://testnet.bscscan.com/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | bsctest (97) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://testnet.bscscan.com/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | bsctest (97) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://testnet.bscscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | bsctest (97) | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://testnet.bscscan.com/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

Fantom Network:

| Contract                        | Network (ID)   | Address                                                                                                              |
| ------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | ftmmain (250)  | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://ftmscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | ftmmain (250)  | N/A                                                                                                                  |
| NftfyCollection                 | ftmmain (250)  | N/A                                                                                                                  |
| PeerToPeerMarkets               | ftmmain (250)  | N/A                                                                                                                  |
| SignatureBasedPeerToPeerMarkets | ftmmain (250)  | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://ftmscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |

| Contract                        | Network (ID)   | Address                                                                                                                      |
| ------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | ftmtest (4002) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://testnet.ftmscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | ftmtest (4002) | N/A                                                                                                                          |
| NftfyCollection                 | ftmtest (4002) | N/A                                                                                                                          |
| PeerToPeerMarkets               | ftmtest (4002) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://testnet.ftmscan.com/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | ftmtest (4002) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://testnet.ftmscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | ftmtest (4002) | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://testnet.ftmscan.com/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |

Polygon Matic:

| Contract                        | Network (ID)    | Address                                                                                                                  |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Boxes                           | maticmain (137) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://polygonscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | maticmain (137) | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://polygonscan.com/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | maticmain (137) | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://polygonscan.com/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | maticmain (137) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://polygonscan.com/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | maticmain (137) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://polygonscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |

| Contract                        | Network (ID)      | Address                                                                                                                         |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Boxes                           | matictest (80001) | [0xFc44f66D5D689cD9108c6577533E9572f53a50Bc](https://mumbai.polygonscan.com/address/0xFc44f66D5D689cD9108c6577533E9572f53a50Bc) |
| CollectionFactory               | matictest (80001) | [0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F](https://mumbai.polygonscan.com/address/0x62cF87B0E441e6E3A1634304AbA6332F3Fd6464F) |
| NftfyCollection                 | matictest (80001) | [0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb](https://mumbai.polygonscan.com/address/0x9c8a2b35B268bf2AA69f5fc105514e34daF3cEBb) |
| PeerToPeerMarkets               | matictest (80001) | [0x91FE09bB4D060abc2FD1460f87D19c4c9410448e](https://mumbai.polygonscan.com/address/0x91FE09bB4D060abc2FD1460f87D19c4c9410448e) |
| SignatureBasedPeerToPeerMarkets | matictest (80001) | [0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47](https://mumbai.polygonscan.com/address/0xcda724130b20Bc21Cd99f98d3B90c1A834C21f47) |
| TestTokenFactory                | matictest (80001) | [0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA](https://mumbai.polygonscan.com/address/0x4A4210BfD926174B96FfC39085461B7d8DaB2fBA) |
