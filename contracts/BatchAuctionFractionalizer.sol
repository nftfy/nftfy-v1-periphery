// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import { Boxes, SafeERC721 } from "./Boxes.sol";

interface IAuctionFractionalizer
{
	function fractionalize(address _target, uint256 _tokenId, string memory _name, string memory _symbol, uint8 _decimals, uint256 _fractionsCount, uint256 _fractionPrice, address _paymentToken, uint256 _kickoff, uint256 _duration, uint256 _fee) external returns (address _fractions);
}

contract BatchAuctionFractionalizer is ReentrancyGuard
{
	using SafeERC20 for IERC20;
	using SafeERC721 for IERC721;

	address public immutable boxes;
	address public immutable fractionalizer;

	constructor (address _boxes, address _fractionalizer) public
	{
		boxes = _boxes;
		fractionalizer = _fractionalizer;
	}

	function fractionalize(string memory _cid, address[] memory _targets, uint256[] memory _tokenIds, string memory _name, string memory _symbol, uint8 _decimals, uint256 _fractionsCount, uint256 _fractionPrice, address _paymentToken, uint256 _kickoff, uint256 _duration, uint256 _fee) external returns (address _fractions)
	{
		uint256 _boxId = Boxes(boxes).baseIndex() + Boxes(boxes).totalSupply();
		Boxes(boxes).mint(_cid, address(this));
		for (uint256 _i = 0; _i < _targets.length; _i++) {
			address _target = _targets[_i];
			uint256 _tokenId = _tokenIds[_i];
			IERC721(_target).transferFrom(msg.sender, address(this), _tokenId);
			IERC721(_target).safeApprove(boxes, _tokenId);
		}
		Boxes(boxes).boxAddItemBatch(_boxId, _targets, _tokenIds);
		IERC721(boxes).approve(fractionalizer, _boxId);
		_fractions = IAuctionFractionalizer(fractionalizer).fractionalize(boxes, _boxId, _name, _symbol, _decimals, _fractionsCount, _fractionPrice, _paymentToken, _kickoff, _duration, _fee);
		IERC20(_fractions).safeTransfer(msg.sender, IERC20(_fractions).balanceOf(address(this)));
		return _fractions;
	}
}
