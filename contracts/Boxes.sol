// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

library SafeERC721
{
	function safeApprove(IERC721 _token, address _to, uint256 _tokenId) internal
	{
		try IERC721(_token).approve(_to, _tokenId) {
		} catch (bytes memory /* _data */) {
		}
	}
}

contract Boxes is ReentrancyGuard, ERC721, ERC721Holder
{
	using SafeERC721 for IERC721;

	uint256 constant MINT_LIMIT = 1_000_000_000_000;

	struct Item {
		address token;
		uint256 tokenId;
	}

	struct Index {
		uint256 boxId;
		uint256 i;
	}

	uint256 public immutable baseIndex;

	mapping (uint256 => Item[]) private items;
	mapping (address => mapping (uint256 => Index)) private indexes;

	modifier onlyOwner(uint256 _boxId)
	{
		require(msg.sender == ownerOf(_boxId), "access denied");
		_;
	}

	constructor () ERC721("Boxes", "BOX") public
	{
		baseIndex = (_chainId() - 1) * MINT_LIMIT + 1;
		_setBaseURI("ipfs://");
	}

	function boxOf(address _token, uint256 _tokenId) external view returns (uint256 _boxId, uint256 _i)
	{
		Index storage _index = indexes[_token][_tokenId];
		return (_index.boxId, _index.i);
	}

	function boxItemCount(uint256 _boxId) external view returns (uint256 _count)
	{
		return items[_boxId].length;
	}

	function boxItem(uint256 _boxId, uint256 _i) external view returns (address _token, uint256 _tokenId)
	{
		Item storage _item = items[_boxId][_i];
		return (_item.token, _item.tokenId);
	}

	function mint(string memory _cid, address _to) external
	{
		uint256 _supply = totalSupply();
		require(_supply < MINT_LIMIT, "limit exhausted");
		uint256 _boxId = baseIndex + _supply;
		_safeMint(_to, _boxId);
		_setTokenURI(_boxId, _cid);
	}

	function setTokenURI(uint256 _boxId, string memory _cid) external onlyOwner(_boxId)
	{
		_setTokenURI(_boxId, _cid);
	}

	function boxAddItem(uint256 _boxId, address _token, uint256 _tokenId) external onlyOwner(_boxId) nonReentrant
	{
		address _from = msg.sender;
		_safeTransferFrom(_token, _from, _tokenId);
		_boxAddItem(_boxId, _token, _tokenId);
	}

	function boxRemoveItem(uint256 _boxId, address _token, uint256 _tokenId, address _to) external onlyOwner(_boxId) nonReentrant
	{
		_boxRemoveItem(_boxId, _token, _tokenId);
		_safeTransfer(_token, _to, _tokenId);
	}

	function boxAddItemBatch(uint256 _boxId, address[] memory _tokens, uint256[] memory _tokenIds) external onlyOwner(_boxId) nonReentrant
	{
		address _from = msg.sender;
		require(_tokens.length == _tokenIds.length, "length mismatch");
		for (uint256 _i = 0; _i < _tokens.length; _i++) {
			_safeTransferFrom(_tokens[_i], _from, _tokenIds[_i]);
		}
		for (uint256 _i = 0; _i < _tokens.length; _i++) {
			_boxAddItem(_boxId, _tokens[_i], _tokenIds[_i]);
		}
	}

	function boxRemoveItemBatch(uint256 _boxId, address[] memory _tokens, uint256[] memory _tokenIds, address _to) external onlyOwner(_boxId) nonReentrant
	{
		require(_tokens.length == _tokenIds.length, "length mismatch");
		for (uint256 _i = 0; _i < _tokens.length; _i++) {
			_boxRemoveItem(_boxId, _tokens[_i], _tokenIds[_i]);
		}
		for (uint256 _i = 0; _i < _tokens.length; _i++) {
			_safeTransfer(_tokens[_i], _to, _tokenIds[_i]);
		}
	}

	function recoverItem(address _token, uint256 _tokenId, address _to) external nonReentrant
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_index.boxId == 0, "not found");
		_safeTransfer(_token, _to, _tokenId);
	}

	function _boxAddItem(uint256 _boxId, address _token, uint256 _tokenId) internal
	{
		require(_token != address(this), "not allowed");
		Index storage _index = indexes[_token][_tokenId];
		require(_index.boxId == 0, "not found");
		Item[] storage _items = items[_boxId];
		uint256 _i = _items.length;
		_items.push(Item({
			token: _token,
			tokenId: _tokenId
		}));
		_index.boxId = _boxId;
		_index.i = _i;
		emit BoxAddItem(_boxId, _token, _tokenId);
	}

	function _boxRemoveItem(uint256 _boxId, address _token, uint256 _tokenId) internal
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_index.boxId == _boxId, "not found");
		uint256 _i = _index.i;
		_index.boxId = 0;
		_index.i = 0;
		Item[] storage _items = items[_boxId];
		uint256 _j = _items.length - 1;
		if (_i < _j) {
			Item storage _item = _items[_j];
			indexes[_item.token][_item.tokenId].i = _i;
			_items[_i] = _item;
		}
		_items.pop();
		emit BoxRemoveItem(_boxId, _token, _tokenId);
	}

	function _safeTransfer(address _token, address _to, uint256 _tokenId) internal
	{
		require(_to != address(this), "not allowed");
		IERC721(_token).safeApprove(address(this), _tokenId);
		IERC721(_token).transferFrom(address(this), _to, _tokenId);
	}

	function _safeTransferFrom(address _token, address _from, uint256 _tokenId) internal
	{
		require(_from != address(this), "not allowed");
		IERC721(_token).transferFrom(_from, address(this), _tokenId);
	}

	function _chainId() internal pure returns (uint256 _chainid)
	{
		assembly { _chainid := chainid() }
		return _chainid;
	}

	event BoxAddItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
	event BoxRemoveItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
}
