// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Boxes, SafeERC721 } from "./Boxes.sol";

contract BatchMintBox is ReentrancyGuard
{
	using SafeERC721 for IERC721;

	address public immutable boxes;

	constructor (address _boxes) public
	{
		boxes = _boxes;
	}

	function mint(string memory _cid, address[] memory _tokens, uint256[] memory _tokenIds) external returns (uint256 _boxId)
	{
		_boxId = Boxes(boxes).baseIndex() + Boxes(boxes).totalSupply();
		Boxes(boxes).mint(_cid, address(this));
		for (uint256 _i = 0; _i < _tokens.length; _i++) {
			address _token = _tokens[_i];
			uint256 _tokenId = _tokenIds[_i];
			IERC721(_token).transferFrom(msg.sender, address(this), _tokenId);
			IERC721(_token).safeApprove(boxes, _tokenId);
		}
		Boxes(boxes).boxAddItemBatch(_boxId, _tokens, _tokenIds);
		IERC721(boxes).transferFrom(address(this), msg.sender, _boxId);
		return _boxId;
	}
}
