// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

contract TestToken is ERC20
{
	uint256 constant UNITS = 100000;

	constructor (string memory _name, string memory _symbol, uint8 _decimals) ERC20(_name, _symbol) public
	{
		_setupDecimals(_decimals);
	}

	function faucet() external
	{
		_mint(msg.sender, UNITS * 10 ** uint256(decimals()));
	}
}

contract TestTokenFactory
{
	function createToken(string memory _name, string memory _symbol, uint8 _decimals) external returns (address _address)
	{
		bytes memory _params = abi.encode(_name, _symbol, _decimals);
		bytes memory _bytecode = abi.encodePacked(type(TestToken).creationCode, _params);
		_address = Create2.deploy(0, keccak256(_params), _bytecode);
		emit NewToken(_address);
		return _address;
	}

	event NewToken(address indexed _token);
}
