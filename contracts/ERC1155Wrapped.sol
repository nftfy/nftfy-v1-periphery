// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { IERC1155 } from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import { ERC1155Holder } from "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import { IERC1155MetadataURI } from "@openzeppelin/contracts/token/ERC1155/IERC1155MetadataURI.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ERC1155Wrapped is ReentrancyGuard, ERC721, ERC1155Holder
{
	struct Index {
		address collection;
		uint256 id;
	}

	uint256 public nextTokenId = 1;
	mapping (uint256 => Index) public targets;

	modifier onlyOwner(uint256 _tokenId)
	{
		require(msg.sender == ownerOf(_tokenId), "access denied");
		_;
	}

	modifier onlyOwnerBatch(uint256[] calldata _tokenIds)
	{
		for (uint256 _i = 0; _i < _tokenIds.length; _i++) {
			require(msg.sender == ownerOf(_tokenIds[_i]), "access denied");
		}
		_;
	}

	constructor () ERC721("Wrapped ERC-1155", "W1155") public
	{
	}

	function deposit(address _collection, uint256 _id) external nonReentrant returns (uint256 _tokenId)
	{
		address _from = msg.sender;
		IERC1155(_collection).safeTransferFrom(_from, address(this), _id, 1, new bytes(0));
		string memory _tokenURI = IERC1155MetadataURI(_collection).uri(_id);
		_tokenId = nextTokenId++;
		_safeMint(_from, _tokenId);
		_setTokenURI(_tokenId, _tokenURI);
		targets[_tokenId] = Index({ collection: _collection, id: _id });
		emit Deposit(_from, _collection, _id, _tokenId);
		return _tokenId;
	}

	function withdraw(uint256 _tokenId) external nonReentrant onlyOwner(_tokenId) returns (address _collection, uint256 _id)
	{
		address _from = msg.sender;
		Index storage _index = targets[_tokenId];
		_collection = _index.collection;
		_id = _index.id;
		_index.collection = address(0);
		_index.id = 0;
		_burn(_tokenId);
		IERC1155(_collection).safeTransferFrom(address(this), _from, _id, 1, new bytes(0));
		emit Withdrawal(_from, _collection, _id, _tokenId);
		return (_collection, _id);
	}

	function batchDeposit(address _collection, uint256[] calldata _ids, uint256[] calldata _amounts) external nonReentrant returns (uint256[] memory _tokenIds)
	{
		address _from = msg.sender;
		require(_ids.length == _amounts.length, "length mismatch");
		{
			uint256 _count = 0;
			for (uint256 _j = 0; _j < _amounts.length; _j++) {
				_count += _amounts[_j];
			}
			_tokenIds = new uint256[](_count);
		}
		IERC1155(_collection).safeBatchTransferFrom(_from, address(this), _ids, _amounts, new bytes(0));
		uint256 _i = 0;
		for (uint256 _j = 0; _j < _ids.length; _j++) {
			uint256 _id = _ids[_j];
			uint256 _amount = _amounts[_j];
			string memory _tokenURI = IERC1155MetadataURI(_collection).uri(_id);
			for (uint256 _k = 0; _k < _amount; _k++) {
				uint256 _tokenId = nextTokenId++;
				_safeMint(_from, _tokenId);
				_setTokenURI(_tokenId, _tokenURI);
				targets[_tokenId] = Index({ collection: _collection, id: _id });
				emit Deposit(_from, _collection, _id, _tokenId);
				_tokenIds[_i++] = _tokenId;
			}
		}
		return _tokenIds;
	}

	function batchWithdraw(address _collection, uint256[] calldata _ids, uint256[] calldata _amounts, uint256[] calldata _tokenIds) external nonReentrant onlyOwnerBatch(_tokenIds)
	{
		address _from = msg.sender;
		require(_ids.length == _amounts.length, "length mismatch");
		{
			uint256 _count = 0;
			for (uint256 _j = 0; _j < _amounts.length; _j++) {
				_count += _amounts[_j];
			}
			require(_count == _tokenIds.length, "unexpected length");
		}
		uint256 _j = 0;
		uint256 _k = 0;
		for (uint256 _i = 0; _i < _tokenIds.length; _i++) {
			while (_k == _amounts[_j]) {
				_j++;
				_k = 0;
			}
			uint256 _tokenId = _tokenIds[_i];
			Index storage _index = targets[_tokenId];
			require(_index.collection == _collection, "unexpected collection");
			require(_index.id == _ids[_j], "unexpected id");
			_index.collection = address(0);
			_index.id = 0;
			_burn(_tokenId);
			emit Withdrawal(_from, _collection, _ids[_j], _tokenId);
			_k++;
		}
		IERC1155(_collection).safeBatchTransferFrom(address(this), _from, _ids, _amounts, new bytes(0));
	}

	event Deposit(address indexed _account, address indexed _collection, uint256 indexed _id, uint256 _tokenId);
	event Withdrawal(address indexed _account, address indexed _collection, uint256 indexed _id, uint256 _tokenId);
}
