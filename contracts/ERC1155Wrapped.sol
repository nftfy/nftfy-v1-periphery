// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC1155Wrapped is ERC721
{
	struct Index {
		address collection;
		uint256 id;
	}

	uint256 public nextTokenId = 1;
	mapping (uint256 => Index) indexes;

	modifier onlyOwner(uint256 _tokenId)
	{
		require(msg.sender == ownerOf(_tokenId), "access denied");
		_;
	}

	constructor () ERC721("ERC-1155 Wrapped", "1155W") public
	{
	}

	function deposit(address _collection, uint256 _id) external
	{
		address _from = msg.sender;
		IERC1155(_collection).safeTransferFrom(_from, address(this), _id, 1, new bytes(0));
		uint256 _tokenId = nextTokenId++;
		string memory _tokenURI = IERC1155MetadataURI(_collection).uri(_id);
		_safeMint(_from, _tokenId);
		_setTokenURI(_tokenId, _tokenURI);
		indexes[_tokenId] = Index({
			collection: _collection,
			id: _id
		});
	}

	function withdraw(uint256 _tokenId) external onlyOwner(_tokenId)
	{
		address _from = msg.sender;
		Index storage _index = indexes[_tokenId];
		address _collection = _index.collection;
		uint256 _id = _index.id;
		_index.collection = address(0);
		_index.id = 0;
		_burn(_tokenId);
		IERC1155(_collection).safeTransferFrom(address(this), _from, _id, 1, new bytes(0));
	}
}
