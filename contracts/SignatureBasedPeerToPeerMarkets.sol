// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.6.0;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { ECDSA } from "@openzeppelin/contracts/cryptography/ECDSA.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SignatureBasedPeerToPeerMarkets is ReentrancyGuard
{
	using SafeMath for uint256;
	using SafeERC20 for IERC20;
	using Address for address payable;

	mapping (bytes32 => uint256) public executedBookAmounts;

	uint256 public immutable fee;
	address payable public immutable vault;

	// parameter variables of _executeOrder, avoids stack too deep error, protected by reentrancy guard
	address private bookToken_;
	address private execToken_;
	uint256 private totalExecFeeAmount_;

	constructor (uint256 _fee, address payable _vault) public
	{
		require(_fee <= 1e18, "invalid fee");
		require(_vault != address(0), "invalid address");
		fee = _fee;
		vault = _vault;
	}

	function generateOrderId(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt) public view returns (bytes32 _orderId)
	{
		return keccak256(abi.encodePacked(_chainId(), address(this), _bookToken, _execToken, _bookAmount, _execAmount, _maker, _salt));
	}

	function checkOrderExecution(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt, uint256 _requiredBookAmount) external view returns (uint256 _totalExecAmount)
	{
		return _checkOrderExecution(_bookToken, _execToken, _bookAmount, _execAmount, _maker, _salt, _requiredBookAmount);
	}

	function checkOrdersExecution(address _bookToken, address _execToken, uint256[] calldata _bookAmounts, uint256[] calldata _execAmounts, address payable[] calldata _makers, uint256[] calldata _salts, uint256 _lastRequiredBookAmount) external view returns (uint256 _totalExecAmount)
	{
		// not accurate if duplicate maker orders
		if (_makers.length == 0) return 0;
		_totalExecAmount = 0;
		for (uint256 _i = 0; _i < _makers.length - 1; _i++) {
			uint256 _requiredBookAmount = _bookAmounts[_i];
			uint256 _localExecAmount = _checkOrderExecution(_bookToken, _execToken, _bookAmounts[_i], _execAmounts[_i], _makers[_i], _salts[_i], _requiredBookAmount);
			uint256 _newTotalExecAmount = _totalExecAmount + _localExecAmount;
			if (_newTotalExecAmount <= _totalExecAmount) return 0;
			_totalExecAmount = _newTotalExecAmount;
		}
		{
			uint256 _i = _makers.length - 1;
			uint256 _localExecAmount = _checkOrderExecution(_bookToken, _execToken, _bookAmounts[_i], _execAmounts[_i], _makers[_i], _salts[_i], _lastRequiredBookAmount);
			uint256 _newTotalExecAmount = _totalExecAmount + _localExecAmount;
			if (_newTotalExecAmount <= _totalExecAmount) return 0;
			_totalExecAmount = _newTotalExecAmount;
		}
		return _totalExecAmount;
	}

	function _checkOrderExecution(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt, uint256 _requiredBookAmount) internal view returns (uint256 _requiredExecAmount)
	{
		if (_requiredBookAmount == 0) return 0;
		bytes32 _orderId = generateOrderId(_bookToken, _execToken, _bookAmount, _execAmount, _maker, _salt);
		if (executedBookAmounts[_orderId] >= _bookAmount) return 0;
		uint256 _availableBookAmount = _bookAmount - executedBookAmounts[_orderId];
		if (_requiredBookAmount > _availableBookAmount) return 0;
		if (_requiredBookAmount > IERC20(_bookToken).allowance(_maker, address(this))) return 0;
		if (_requiredBookAmount > IERC20(_bookToken).balanceOf(_maker)) return 0;
		_requiredExecAmount = _requiredBookAmount.mul(_execAmount).add(_bookAmount - 1) / _bookAmount;
		return _requiredExecAmount;
	}

	function executeOrder(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt, bytes calldata _signature, uint256 _requiredBookAmount) external payable nonReentrant
	{
		address payable _taker = msg.sender;
		bookToken_ = _bookToken;
		execToken_ = _execToken;
		_executeOrder(_bookAmount, _execAmount, _maker, _salt, _signature, _taker, _requiredBookAmount);
		if (execToken_ == address(0)) {
			vault.sendValue(totalExecFeeAmount_);
			require(address(this).balance == 0);
		} else {
			IERC20(execToken_).safeTransferFrom(_taker, vault, totalExecFeeAmount_);
		}
		totalExecFeeAmount_ = 0;
	}

	function executeOrders(address _bookToken, address _execToken, uint256[] calldata _bookAmounts, uint256[] calldata _execAmounts, address payable[] calldata _makers, uint256[] calldata _salts, bytes calldata _signatures, uint256 _lastRequiredBookAmount) external payable nonReentrant
	{
		address payable _taker = msg.sender;
		require(_makers.length > 0, "invalid length");
		bookToken_ = _bookToken;
		execToken_ = _execToken;
		for (uint256 _i = 0; _i < _makers.length - 1; _i++) {
			bytes memory _signature = _extractSignature(_signatures, _i);
			uint256 _requiredBookAmount = _bookAmounts[_i];
			_executeOrder(_bookAmounts[_i], _execAmounts[_i], _makers[_i], _salts[_i], _signature, _taker, _requiredBookAmount);
		}
		{
			uint256 _i = _makers.length - 1;
			bytes memory _signature = _extractSignature(_signatures, _i);
			_executeOrder(_bookAmounts[_i], _execAmounts[_i], _makers[_i], _salts[_i], _signature, _taker, _lastRequiredBookAmount);
		}
		if (execToken_ == address(0)) {
			vault.sendValue(totalExecFeeAmount_);
			require(address(this).balance == 0);
		} else {
			IERC20(execToken_).safeTransferFrom(_taker, vault, totalExecFeeAmount_);
		}
		totalExecFeeAmount_ = 0;
	}

	function _executeOrder(uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt, bytes memory _signature, address payable _taker, uint256 _requiredBookAmount) internal
	{
		require(_requiredBookAmount > 0, "invalid amount");
		bytes32 _orderId = generateOrderId(bookToken_, execToken_, _bookAmount, _execAmount, _maker, _salt);
		require(_maker == _recoverSigner(_orderId, _signature), "access denied");
		require(executedBookAmounts[_orderId] < _bookAmount, "inactive order");
		{
			uint256 _availableBookAmount = _bookAmount - executedBookAmounts[_orderId];
			require(_requiredBookAmount <= _availableBookAmount, "insufficient liquidity");
		}
		uint256 _requiredExecAmount = _requiredBookAmount.mul(_execAmount).add(_bookAmount - 1) / _bookAmount;
		uint256 _requiredExecFeeAmount = _requiredExecAmount.mul(fee) / 1e18;
		uint256 _requiredExecNetAmount = _requiredExecAmount - _requiredExecFeeAmount;
		executedBookAmounts[_orderId] += _requiredBookAmount;
		totalExecFeeAmount_ = totalExecFeeAmount_.add(_requiredExecFeeAmount);
		IERC20(bookToken_).safeTransferFrom(_maker, _taker, _requiredBookAmount);
		if (execToken_ == address(0)) {
			_maker.sendValue(_requiredExecNetAmount);
		} else {
			IERC20(execToken_).safeTransferFrom(_taker, _maker, _requiredExecNetAmount);
		}
		emit Trade(bookToken_, execToken_, _orderId, _requiredBookAmount, _requiredExecNetAmount, _requiredExecFeeAmount, _maker, _taker);
	}

	function cancelOrder(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, uint256 _salt) external
	{
		address payable _maker = msg.sender;
		_cancelOrder(_bookToken, _execToken, _bookAmount, _execAmount, _maker, _salt);
	}

	function cancelOrders(address _bookToken, address _execToken, uint256[] calldata _bookAmounts, uint256[] calldata _execAmounts, uint256[] calldata _salts) external
	{
		address payable _maker = msg.sender;
		for (uint256 _i = 0; _i < _bookAmounts.length; _i++) {
			_cancelOrder(_bookToken, _execToken, _bookAmounts[_i], _execAmounts[_i], _maker, _salts[_i]);
		}
	}

	function _cancelOrder(address _bookToken, address _execToken, uint256 _bookAmount, uint256 _execAmount, address payable _maker, uint256 _salt) internal
	{
		bytes32 _orderId = generateOrderId(_bookToken, _execToken, _bookAmount, _execAmount, _maker, _salt);
		executedBookAmounts[_orderId] = uint256(-1);
		emit CancelOrder(_bookToken, _execToken, _orderId);
	}

	function _extractSignature(bytes memory _signatures, uint256 _index) internal pure returns (bytes memory _signature)
	{
		uint256 _offset = 65 * _index;
		_signature = new bytes(65);
		for (uint256 _i = 0; _i < 65; _i++) {
			_signature[_i] = _signatures[_offset + _i];
		}
		return _signature;
	}

	function _recoverSigner(bytes32 _hash, bytes memory _signature) internal pure returns (address _signer)
	{
		return ECDSA.recover(ECDSA.toEthSignedMessageHash(_hash), _signature);
	}

	function _chainId() internal pure returns (uint256 _chainid)
	{
		assembly { _chainid := chainid() }
		return _chainid;
	}

	event Trade(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId, uint256 _bookAmount, uint256 _execAmount, uint256 _execFeeAmount, address _maker, address _taker);
	event CancelOrder(address indexed _bookToken, address indexed _execToken, bytes32 indexed _orderId);
}
