#!/bin/bash

source .env

CHAIN_ID=137
GAS_LIMIT=20000000
FORK_URL='https://polygon-mainnet.infura.io/v3/'$INFURA_PROJECT_ID

BALANCE=100000000000000000000000

npx ganache-cli \
	-q \
	-h 0.0.0.0 \
	-i $CHAIN_ID \
	--chainId $CHAIN_ID \
	-l $GAS_LIMIT \
	-f $FORK_URL \
	--account $PRIVATE_KEY,$BALANCE
