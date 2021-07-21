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
		address payable owner;
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

	function generateOrderId(address _owner, uint256 _nonce) external pure returns (bytes32 _orderId)
	{
		return keccak256(abi.encode(_owner, _nonce));
	}

	function createOrder(address _bookToken, address _execToken, bytes32 _orderId, uint256 _bookAmount, uint256 _execAmount) external payable nonReentrant
	{
		address payable _from = msg.sender;
		uint256 _value = msg.value;
		IndexInfo storage _index = indexes[_orderId];
		require(orders[_index.bookToken][_index.execToken][_index.i].orderId == bytes32(0), "duplicate order");
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		uint256 _i = _orders.length;
		if (_bookAmount > 0) {
			_safeTransferFrom(_bookToken, _from, _value, address(this), _bookAmount);
			balances[_bookToken] += _bookAmount;
		}
		_index.bookToken = _bookToken;
		_index.execToken = _execToken;
		_index.i = _i;
		_orders.push(OrderInfo({
			owner: _from,
			orderId: _orderId,
			bookAmount: _bookAmount,
			execAmount: _execAmount
		}));
		emit CreateOrder(_bookToken, _execToken, _orderId);
		emit UpdateOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function cancelOrder(bytes32 _orderId) external nonReentrant
	{
		address payable _from = msg.sender;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
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
			balances[_bookToken] -= _bookAmount;
			_safeTransfer(_bookToken, _from, _bookAmount);
		}
		emit CancelOrder(_bookToken, _execToken, _orderId);
	}

	function updateOrder(bytes32 _orderId, uint256 _bookAmount, uint256 _execAmount) external payable nonReentrant
	{
		address payable _from = msg.sender;
		uint256 _value = msg.value;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		require(_order.owner == _from, "access denied");
		if (_bookAmount > _order.bookAmount) {
			uint256 _difference = _bookAmount - _order.bookAmount;
			_safeTransferFrom(_bookToken, _from, _value, address(this), _difference);
			balances[_bookToken] += _difference;
			_order.bookAmount = _bookAmount;
			_order.execAmount = _execAmount;
		}
		else
		if (_bookAmount < _order.bookAmount) {
			uint256 _difference = _order.bookAmount - _bookAmount;
			_order.bookAmount = _bookAmount;
			_order.execAmount = _execAmount;
			balances[_bookToken] -= _difference;
			_safeTransfer(_bookToken, _from, _difference);
		}
		else {
			_order.execAmount = _execAmount;
		}
		emit UpdateOrder(_bookToken, _execToken, _orderId, _bookAmount, _execAmount);
	}

	function executeOrder(bytes32 _orderId, uint256 _bookAmount, uint256 _execAmount) external payable nonReentrant
	{
		address payable _from = msg.sender;
		uint256 _value = msg.value;
		IndexInfo storage _index = indexes[_orderId];
		address _bookToken = _index.bookToken;
		address _execToken = _index.execToken;
		uint256 _i = _index.i;
		OrderInfo[] storage _orders = orders[_bookToken][_execToken];
		OrderInfo storage _order = _orders[_i];
		require(_order.orderId == _orderId, "unknown order");
		require(_bookAmount <= _order.bookAmount, "insufficient amount");
		if (_order.bookAmount == 0) {
			require(_execAmount <= _order.execAmount, "excessive amount");
		} else {
			require(_execAmount == _bookAmount.mul(_order.execAmount) / _order.bookAmount, "price mismatch");
		}
		_order.bookAmount -= _bookAmount;
		_order.execAmount -= _execAmount;
		if (_bookAmount > 0) {
			balances[_bookToken] -= _bookAmount;
			_safeTransfer(_bookToken, _from, _bookAmount);
		}
		if (_execAmount > 0) {
			_safeTransferFrom(_execToken, _from, _value, _order.owner, _execAmount);
		}
		emit Trade(_bookToken, _execToken, _bookAmount, _execAmount);
		emit UpdateOrder(_bookToken, _execToken, _orderId, _order.bookAmount, _order.execAmount);
	}

	function recoverLostFunds(address _token, address payable _to) external nonReentrant
	{
		uint256 _balance = balances[_token];
		uint256 _current = _balanceOf(_token);
		if (_current > _balance) {
			uint256 _excess = _current - _balance;
			_safeTransfer(_token, _to, _excess);
		}
	}

	function _balanceOf(address _token) internal view returns (uint256 _balance)
	{
		if (_token == address(0)) {
			return address(this).balance;
		} else {
			return IERC20(_token).balanceOf(address(this));
		}
	}

	function _safeTransfer(address _token, address payable _to, uint256 _amount) internal
	{
		if (_token == address(0)) {
			_to.transfer(_amount);
		} else {
			IERC20(_token).safeTransfer(_to, _amount);
		}
	}

	function _safeTransferFrom(address _token, address payable _from, uint256 _value, address payable _to, uint256 _amount) internal
	{
		if (_token == address(0)) {
			require(_value >= _amount, "insufficient value");
			uint256 _change = _value - _amount;
			if (_change > 0) {
				_from.transfer(_change);
			}
			if (_to != address(this)) {
				_to.transfer(_amount);
			}
		} else {
			IERC20(_token).safeTransferFrom(_from, _to, _amount);
		}
	}

	receive() external payable {} // for type checking, not to be used

	event CreateOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId);
	event CancelOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId);
	event UpdateOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId, uint256 _bookAmount, uint256 _execAmount);
	event Trade(address indexed _bookToken, address indexed _execToken, uint256 _bookAmount, uint256 _execAmount);
}
