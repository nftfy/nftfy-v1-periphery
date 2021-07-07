// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FixedPriceSale is ReentrancyGuard
{
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	struct SaleInfo {
		address owner;
		uint256 amount;
		uint256 cost;
		address paymentToken;
	}

	mapping (address => SaleInfo) public saleInfo;

	function create(address _token, address _owner, uint256 _amount, uint256 _cost, address _paymentToken, address _account) external nonReentrant
	{
		SaleInfo storage _sale = saleInfo[_token];
		require(_sale.owner == address(0), "unavailable");
		if (_amount > 0) {
			IERC20(_token).safeTransferFrom(_account, address(this), _amount);
		}
		_sale.owner = _owner;
		_sale.amount = _amount;
		_sale.cost = _cost;
		_sale.paymentToken = _paymentToken;
	}

	function adjust(address _token, uint256 _amount, uint256 _cost, address _account) external nonReentrant
	{
		SaleInfo storage _sale = saleInfo[_token];
		require(msg.sender == _sale.owner, "access denied");
		if (_amount > _sale.amount) {
			IERC20(_token).safeTransferFrom(_account, address(this), _amount - _sale.amount);
		}
		else
		if (_amount < _sale.amount) {
			IERC20(_token).safeTransfer(_account, _sale.amount - _amount);
		}
		_sale.amount = _amount;
		_sale.cost = _cost;
	}

	function purchase(address _token, uint256 _amount, address _from, address _to) external nonReentrant
	{
		SaleInfo storage _sale = saleInfo[_token];
		require(_amount > 0, "invalid amount");
		require(_amount <= _sale.amount, "insufficient balance");
		uint256 _cost = _amount.mul(_sale.cost) / _sale.amount;
		_sale.amount -= _amount;
		_sale.cost -= _cost;
		IERC20(_sale.paymentToken).safeTransferFrom(_from, _sale.owner, _cost);
		IERC20(_token).safeTransfer(_to, _amount);
	}

	function recoverLostFunds(address _token, address _to) external nonReentrant
	{
		SaleInfo storage _sale = saleInfo[_token];
		uint256 _balance = IERC20(_token).balanceOf(address(this));
		IERC20(_token).safeTransfer(_to, _balance - _sale.amount);
	}
}
