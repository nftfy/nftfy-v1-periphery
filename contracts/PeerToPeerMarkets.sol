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

	struct IndexInfo {
		address bookToken;
		address execToken;
		uint256 i;
	}

	struct OrderInfo {
		address owner;
		bytes32 orderId;
		uint256 bookAmount;
		uint256 execAmount;
	}

	mapping (address => uint256) public balances;
	mapping (bytes32 => IndexInfo) public indexes;
	mapping (address => mapping (address => OrderInfo[])) public orders;

	function orderCount(address _bookToken, address _execToken) external view returns (uint256 _count)
	{
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		return _orders.length;
	}

	function createOrder(address _bookToken, address _execToken, bytes32 _orderId, uint256 _bookAmount, uint256 _execAmount) external nonReentrant
	{
		address _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		require(_index.bookToken == address(0), "duplicate order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		uint256 _i = _orders.length;
		IERC20(_bookToken).safeTransferFrom(_from, address(this), _bookAmount);
		balances[_bookToken] = balances[_bookToken].add(_bookAmount);
		_index.bookToken = _bookToken;
		_index.execToken = _execToken;
		_index.i = _i;
		_orders.push(OrderInfo({
			owner: _from,
			orderId: _orderId,
			bookAmount: _bookAmount,
			execAmount: _execAmount
		}));
		emit CreateOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function cancelOrder(bytes32 _orderId) external nonReentrant
	{
		address _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		require(_bookToken != address(0), "unknown order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.owner == _from, "access denied");
		uint256 _bookAmount = _order.bookAmount;
		_index.bookToken = address(0);
		_index.execToken = address(0);
		_index.i = 0;
		uint256 _j = _orders.length - 1;
		if (_i < _j) {
			indexes[_orders[_j].orderId].i = _i;
			_orders[_i] = _orders[_j];
		}
		_orders.pop();
		if (_bookAmount > 0) {
			balances[_bookToken] = balances[_bookToken].sub(_bookAmount);
			IERC20(_bookToken).safeTransfer(_from, _bookAmount);
		}
		emit CancelOrder(_bookToken, _execToken, _orderId);
	}

	function updateOrder(bytes32 _orderId, uint256 _bookAmount, uint256 _execAmount) external nonReentrant
	{
		address _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		require(_bookToken != address(0), "unknown order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.owner == _from, "access denied");
		if (_bookAmount > _order.bookAmount) {
			uint256 _diffAmount = _bookAmount - _order.bookAmount;
			IERC20(_bookToken).safeTransferFrom(_from, address(this), _diffAmount);
			balances[_bookToken] = balances[_bookToken].add(_diffAmount);
			_order.bookAmount = _bookAmount;
			_order.execAmount = _execAmount;
		}
		else
		if (_bookAmount < _order.bookAmount) {
			uint256 _diffAmount = _order.bookAmount - _bookAmount;
			_order.bookAmount = _bookAmount;
			_order.execAmount = _execAmount;
			balances[_bookToken] = balances[_bookToken].sub(_diffAmount);
			IERC20(_bookToken).safeTransfer(_from, _diffAmount);
		}
		else {
			_order.execAmount = _execAmount;
		}
		emit ChangeOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function executeOrderBook(bytes32 _orderId, uint256 _bookAmount, uint256 _maxExecAmount) external nonReentrant
	{
		address _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		require(_bookToken != address(0), "unknown order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		uint256 _execAmount = _bookAmount.mul(_order.execAmount) / _order.bookAmount;
		require(_bookAmount <= _order.bookAmount, "insufficient amount");
		require(_execAmount <= _maxExecAmount, "high slippage");
		_order.bookAmount = _order.bookAmount.sub(_bookAmount);
		_order.execAmount = _order.execAmount.sub(_execAmount);
		balances[_bookToken] = balances[_bookToken].sub(_bookAmount);
		IERC20(_bookToken).safeTransfer(_from, _bookAmount);
		IERC20(_execToken).safeTransferFrom(_from, _order.owner, _execAmount);
		emit ChangeOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function executeOrderExec(bytes32 _orderId, uint256 _execAmount, uint256 _minBookAmount) external nonReentrant
	{
		address _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		require(_bookToken != address(0), "unknown order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		uint256 _bookAmount = _execAmount.mul(_order.bookAmount) / _order.execAmount;
		require(_bookAmount <= _order.bookAmount, "insufficient amount");
		require(_bookAmount >= _minBookAmount, "high slippage");
		_order.bookAmount = _order.bookAmount.sub(_bookAmount);
		_order.execAmount = _order.execAmount.sub(_execAmount);
		balances[_bookToken] = balances[_bookToken].sub(_bookAmount);
		IERC20(_bookToken).safeTransfer(_from, _bookAmount);
		IERC20(_execToken).safeTransferFrom(_from, _order.owner, _execAmount);
		emit ChangeOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function recoverLostFunds(address _token, address _to) external nonReentrant
	{
		uint256 _balance = balances[_token];
		uint256 _current = IERC20(_token).balanceOf(address(this));
		IERC20(_token).safeTransfer(_to, _current - _balance);
	}

	event CreateOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId, uint256 _bookAmount, uint256 _execAmount);
	event ChangeOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId, uint256 _bookAmount, uint256 _execAmount);
	event CancelOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId);
}
