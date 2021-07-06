// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC721Holder } from "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

library SafeERC721
{
	function safeApprove(IERC721 _token, address _to, uint256 _tokenId) internal
	{
		try IERC721(_token).approve(_to, _tokenId) {
		} catch (bytes memory /* _data */) {
		}
	}
}

contract Boxes is ERC721, ERC721Holder
{
	using SafeERC721 for IERC721;

	string constant URI_PREFIX = "data:application/json;charset=utf-8,%7B%22image%22%3A%22data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8%2BCjxzdmcgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpjYz0iaHR0cDovL2NyZWF0aXZlY29tbW9ucy5vcmcvbnMjIiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiIHhtbG5zOnN2Zz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmVyc2lvbj0iMS4xIiB3aWR0aD0iMTgwIiBoZWlnaHQ9IjE4MCIgdmlld0JveD0iMCAwIDE4MCAxODAiPgo8cGF0aCBzdHlsZT0iZmlsbDojYjdiN2I3IiBkPSJNIDkwLDM1IDE1MCw2NSA5MCw5NSAzMCw2NSBaIi8%2BCjxwYXRoIHN0eWxlPSJmaWxsOiM4ZThkOGQiIGQ9Ik0gMTUwLDEyNSA5MCwxNTUgOTAsOTUgMTUwLDY1IFoiLz4KPHBhdGggc3R5bGU9ImZpbGw6IzcwNzA3MCIgZD0iTSAzMCwxMjUgOTAsMTU1IDkwLDk1IDMwLDY1IFoiLz4KPHBhdGggc3R5bGU9ImZpbGw6IzcwNzA3MCIgZD0iTSA1Miw1NCA2OCw0NiAxMjgsNzYgMTEyLDg0IFoiLz4KPHBhdGggc3R5bGU9ImZpbGw6IzcwNzA3MCIgZD0iTSAxMjgsNzYgMTEyLDg0IDExMiw5NCAxMjgsODYgWiIvPgo8L3N2Zz4K%22%2C%22description%22%3A%22This%20box%20is%20an%20NFT%20container.%22%2C%22name%22%3A%22Box%20%23";
	string constant URI_SUFFIX_PART_1 = "%22%2C%22external_url%22%3A%22https%3A%2F%2Fnftfy.org%2F";
	string constant URI_SUFFIX_PART_2 = "%2Fbox%2F";
	string constant URI_SUFFIX_PART_3 = "%22%7D";

	struct Item {
		address token;
		uint256 tokenId;
	}

	struct Index {
		uint256 boxId;
		uint256 i;
	}

	string private network;
	mapping (uint256 => Item[]) private items;
	mapping (address => mapping (uint256 => Index)) private indexes;

	modifier onlyOwner(uint256 _boxId)
	{
		require(msg.sender == ownerOf(_boxId), "access denied");
		_;
	}

	constructor (string memory _network) ERC721("Boxes", "BOX") public
	{
		network = _network;
		_setBaseURI(URI_PREFIX);
	}

	function mint(address _to) external
	{
		uint256 _boxId = totalSupply() + 1;
		string memory _id = _boxId.toString();
		string memory _boxURI = string(abi.encodePacked(_id, URI_SUFFIX_PART_1, network, URI_SUFFIX_PART_2, _id, URI_SUFFIX_PART_3));
		_safeMint(_to, _boxId);
		_setTokenURI(_boxId, _boxURI);
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

	function boxAddItem(uint256 _boxId, address _token, uint256 _tokenId, address _from) external onlyOwner(_boxId)
	{
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

	function boxRemoveItem(uint256 _boxId, address _token, uint256 _tokenId, address _to) external onlyOwner(_boxId)
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_boxId == _index.boxId, "not in box");
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

	function recoverItem(address _token, uint256 _tokenId, address _to) external
	{
		Index storage _index = indexes[_token][_tokenId];
		require(_index.boxId == 0, "access denied");
		IERC721(_token).safeApprove(address(this), _tokenId);
		IERC721(_token).transferFrom(address(this), _to, _tokenId);
	}

	event BoxAddItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
	event BoxRemoveItem(uint256 indexed _boxId, address indexed _token, uint256 indexed _tokenId);
}
