// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PeerToPeerMarkets is ReentrancyGuard
{
	using SafeMath for uint256;
	using SafeERC20 for IERC20;

	struct OrderInfo {
		address owner;
		bytes32 orderId;
		uint256 giveAmount;
		uint256 takeAmount;
	}

	mapping (bytes32 => uint256) private indexes;
	mapping (address => uint256) private balances;

	mapping (address => mapping (address => OrderInfo[])) public orders;

	function orderCount(address _giveToken, address _takeToken) external view returns (uint256 _count)
	{
		OrderInfo[] storage _orders = orders[_giveToken][_takeToken];
		return _orders.length;
	}

	function createOrder(address _giveToken, address _takeToken, bytes32 _orderId, uint256 _giveAmount, uint256 _takeAmount) external nonReentrant
	{
		address _from = msg.sender;
		require(indexes[_orderId] == 0, "duplicate order");
		OrderInfo[] storage _orders = orders[_giveToken][_takeToken];
		uint256 _i = _orders.length;
		IERC20(_giveToken).safeTransferFrom(_from, address(this), _giveAmount);
		balances[_giveToken] = balances[_giveToken].add(_giveAmount);
		_orders.push(OrderInfo({
			owner: _from,
			orderId: _orderId,
			giveAmount: _giveAmount,
			takeAmount: _takeAmount
		}));
		indexes[_orderId] = _i + 1;
		emit CreateOrder(_giveToken, _takeToken, _orderId);
	}

	function cancelOrder(address _giveToken, address _takeToken, bytes32 _orderId) external nonReentrant
	{
		address _from = msg.sender;
		uint256 _i = indexes[_orderId];
		require(_i > 0, "unknown order");
		_i--;
		OrderInfo[] storage _orders = orders[_giveToken][_takeToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		require(_order.owner == _from, "access denied");
		uint256 _giveAmount = _order.giveAmount;
		indexes[_orderId] = 0;
		uint256 _j = _orders.length - 1;
		if (_i < _j) {
			indexes[_orders[_j].orderId] = _i;
			_orders[_i] = _orders[_j];
		}
		_orders.pop();
		balances[_giveToken] = balances[_giveToken].sub(_giveAmount);
		IERC20(_giveToken).safeTransfer(_from, _giveAmount);
		emit CancelOrder(_giveToken, _takeToken, _orderId);
	}

	function updateOrder(address _giveToken, address _takeToken, bytes32 _orderId, uint256 _giveAmount, uint256 _takeAmount) external nonReentrant
	{
		address _from = msg.sender;
		uint256 _i = indexes[_orderId];
		require(_i > 0, "unknown order");
		_i--;
		OrderInfo[] storage _orders = orders[_giveToken][_takeToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		require(_order.owner == _from, "access denied");
		if (_giveAmount > _order.giveAmount) {
			uint256 _amount = _giveAmount - _order.giveAmount;
			IERC20(_giveToken).safeTransferFrom(_from, address(this), _amount);
			balances[_giveToken] = balances[_giveToken].add(_amount);
			_order.giveAmount = _giveAmount;
			_order.takeAmount = _takeAmount;
		}
		else
		if (_giveAmount < _order.giveAmount) {
			_order.giveAmount = _giveAmount;
			_order.takeAmount = _takeAmount;
			uint256 _amount = _order.giveAmount - _giveAmount;
			balances[_giveToken] = balances[_giveToken].sub(_amount);
			IERC20(_giveToken).safeTransfer(_from, _amount);
		}
		else {
			_order.giveAmount = _giveAmount;
			_order.takeAmount = _takeAmount;
		}
		emit ChangeOrder(_giveToken, _takeToken, _orderId);
	}

	function executeOrderExactGive(address _giveToken, address _takeToken, bytes32 _orderId, uint256 _giveAmount, uint256 _minTakeAmount) external nonReentrant
	{
		address _from = msg.sender;
		uint256 _i = indexes[_orderId];
		require(_i > 0, "unknown order");
		_i--;
		OrderInfo[] storage _orders = orders[_takeToken][_giveToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		uint256 _takeAmount = _giveAmount.mul(_order.giveAmount) / _order.takeAmount;
		require(_takeAmount <= _order.giveAmount, "insufficient balance");
		require(_takeAmount >= _minTakeAmount, "high slippage");
		_order.giveAmount = _order.giveAmount.sub(_takeAmount);
		_order.takeAmount = _order.takeAmount.sub(_giveAmount);
		balances[_takeToken] = balances[_takeToken].sub(_takeAmount);
		IERC20(_takeToken).safeTransfer(_from, _takeAmount);
		IERC20(_giveToken).safeTransferFrom(_from, _order.owner, _giveAmount);
		emit ChangeOrder(_giveToken, _takeToken, _orderId);
	}

	function executeOrderExactTake(address _giveToken, address _takeToken, bytes32 _orderId, uint256 _takeAmount, uint256 _maxGiveAmount) external nonReentrant
	{
		address _from = msg.sender;
		uint256 _i = indexes[_orderId];
		require(_i > 0, "unknown order");
		_i--;
		OrderInfo[] storage _orders = orders[_takeToken][_giveToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		uint256 _giveAmount = _takeAmount.mul(_order.takeAmount) / _order.giveAmount;
		require(_takeAmount <= _order.giveAmount, "insufficient balance");
		require(_giveAmount <= _maxGiveAmount, "high slippage");
		_order.giveAmount = _order.giveAmount.sub(_takeAmount);
		_order.takeAmount = _order.takeAmount.sub(_giveAmount);
		balances[_takeToken] = balances[_takeToken].sub(_takeAmount);
		IERC20(_takeToken).safeTransfer(_from, _takeAmount);
		IERC20(_giveToken).safeTransferFrom(_from, _order.owner, _giveAmount);
		emit ChangeOrder(_giveToken, _takeToken, _orderId);
	}

	function recoverLostFunds(address _token, address _to) external nonReentrant
	{
		uint256 _balance = balances[_token];
		uint256 _current = IERC20(_token).balanceOf(address(this));
		IERC20(_token).safeTransfer(_to, _current - _balance);
	}

	event CreateOrder(address indexed _giveToken, address indexed _takeToken, bytes32 indexed _orderId);
	event ChangeOrder(address indexed _giveToken, address indexed _takeToken, bytes32 indexed _orderId);
	event CancelOrder(address indexed _giveToken, address indexed _takeToken, bytes32 indexed _orderId);
}
