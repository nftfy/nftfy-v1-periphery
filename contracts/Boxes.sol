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

	function _chainId() internal pure returns (uint256 _chainid)
	{
		assembly { _chainid := chainid() }
		return _chainid;
	}

	function mint(string memory _cid, address _to) external
	{
		uint256 _supply = totalSupply();
		require(_supply < MINT_LIMIT, "limit exhausted");
		uint256 _boxId = baseIndex + _supply;
		_safeMint(_to, _boxId);
		_setTokenURI(_boxId, _cid);
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

	function boxAddItem(uint256 _boxId, address _token, uint256 _tokenId) external onlyOwner(_boxId) nonReentrant
	{
		address _from = msg.sender;
		require(_token != address(this), "not allowed");
		IERC721(_token).transferFrom(_from, address(this), _tokenId);
		uint256 _i = items[_boxId].length;
		items[_boxId].push(Item({
			token: _token,
			tokenId: _tokenId
		}));
		indexes[_token][_tokenId] = Index({
			boxId: _boxId,
			i: _i
		});
		emit BoxAddItem(_boxId, _token, _tokenId);
	}

	function boxRemoveItem(uint256 _boxId, address _token, uint256 _tokenId, address _to) external onlyOwner(_boxId) nonReentrant
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_boxId == _index.boxId, "not found");
		uint256 _i = _index.i;
		_index.boxId = 0;
		_index.i = 0;
		uint256 _j = items[_boxId].length - 1;
		if (_i < _j) {
			items[_boxId][_i] = items[_boxId][_j];
		}
		items[_boxId].pop();
		IERC721(_token).safeApprove(address(this), _tokenId);
		IERC721(_token).transferFrom(address(this), _to, _tokenId);
		emit BoxRemoveItem(_boxId, _token, _tokenId);
	}

	function recoverItem(address _token, uint256 _tokenId, address _to) external nonReentrant
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_index.boxId == 0, "access denied");
		IERC721(_token).safeApprove(address(this), _tokenId);
		IERC721(_token).transferFrom(address(this), _to, _tokenId);
	}

	event BoxAddItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
	event BoxRemoveItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
}
