// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Create2 } from "@openzeppelin/contracts/utils/Create2.sol";

contract Collection is Ownable, ERC721
{
	uint256 public immutable baseIndex;

	constructor (string memory _name, string memory _symbol, address _to) ERC721(_name, _symbol) public
	{
		baseIndex = (_chainId() - 1) * 1_000_000_000_000 + 1;
		_setBaseURI("ipfs://ipfs/");
		transferOwnership(_to);
	}

	function mint(string memory _cid, address _to) external onlyOwner
	{
		uint256 _tokenId = baseIndex + totalSupply();
		_safeMint(_to, _tokenId);
		_setTokenURI(_tokenId, _cid);
	}

	function _chainId() internal pure returns (uint256 _chainid)
	{
		assembly { _chainid := chainid() }
		return _chainid;
	}
}

contract CollectionFactory
{
	function createPublicCollection(string memory _name, string memory _symbol) external returns (address _collection)
	{
		return _createCollection(_name, _symbol, address(this));
	}

	function createPrivateCollection(string memory _name, string memory _symbol, address _to) external returns (address _collection)
	{
		return _createCollection(_name, _symbol, _to);
	}

	function mint(address _collection, string memory _cid, address _to) external
	{
		Collection(_collection).mint(_cid, _to);
	}

	function _createCollection(string memory _name, string memory _symbol, address _to) internal returns (address _collection)
	{
		bytes memory _params = abi.encode(_name, _symbol, _to);
		bytes memory _bytecode = abi.encodePacked(type(Collection).creationCode, _params);
		_collection = Create2.deploy(0, keccak256(_params), _bytecode);
		emit NewCollection(_collection, _to);
		return _collection;
	}

	event NewCollection(address indexed _collection, address indexed _to);
}
