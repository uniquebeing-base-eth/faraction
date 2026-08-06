// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ── Inlined dependencies (self-contained: paste straight into Remix) ──

/// @notice Minimal ERC20 interface (FACTS / USDC on Base).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Safe wrappers tolerating non-standard (no return value) ERC20s.
library SafeERC20 {
    function safeTransfer(IERC20 token, address to, uint256 amount) internal {
        _call(address(token), abi.encodeWithSelector(token.transfer.selector, to, amount));
    }

    function safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        _call(address(token), abi.encodeWithSelector(token.transferFrom.selector, from, to, amount));
    }

    function _call(address token, bytes memory data) private {
        (bool ok, bytes memory ret) = token.call(data);
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "ERC20_OP_FAILED");
    }
}

/// @notice Two-step ownership with an operator role for backend automation.
abstract contract Auth {
    address public owner;
    address public pendingOwner;
    mapping(address => bool) public isOperator;

    event OwnershipTransferStarted(address indexed from, address indexed to);
    event OwnershipTransferred(address indexed from, address indexed to);
    event OperatorSet(address indexed operator, bool allowed);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == owner || isOperator[msg.sender], "NOT_OPERATOR");
        _;
    }

    constructor(address _owner) {
        require(_owner != address(0), "ZERO_OWNER");
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function transferOwnership(address to) external onlyOwner {
        pendingOwner = to;
        emit OwnershipTransferStarted(owner, to);
    }

    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "NOT_PENDING_OWNER");
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

/// @notice Simple non-reentrancy guard.
abstract contract ReentrancyGuard {
    uint256 private _lock = 1;

    modifier nonReentrant() {
        require(_lock == 1, "REENTRANCY");
        _lock = 2;
        _;
        _lock = 1;
    }
}

/// @notice Pause switch for emergencies.
abstract contract Pausable is Auth {
    bool public paused;

    event PausedSet(bool paused);

    modifier whenNotPaused() {
        require(!paused, "PAUSED");
        _;
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }
}

/**
 * @title FactsPaymentGateway
 * @notice Lightweight $FACTS payment receiver for in-game purchases:
 *         season passes, premium features, cosmetics, character unlocks and
 *         future marketplace purchases.
 *
 * The gateway only receives payments and emits events for backend tracking.
 * Funds are forwarded to the treasury (immediately by default) — it holds no
 * user balances and never pushes rewards.
 */
contract FactsPaymentGateway is Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable FACTS;

    address public treasury;
    /// @notice When true, payments are forwarded to the treasury in the same tx.
    bool public autoForward = true;

    /// @dev sku => price in FACTS (0 = open price / not listed).
    mapping(bytes32 => uint256) public priceOf;
    /// @dev Total FACTS received per sku, for accounting.
    mapping(bytes32 => uint256) public grossOf;

    event TreasuryUpdated(address indexed treasury);
    event AutoForwardUpdated(bool enabled);
    event PriceUpdated(bytes32 indexed sku, uint256 price);
    event PaymentReceived(
        bytes32 indexed sku, address indexed payer, address indexed beneficiary, uint256 amount, bytes32 paymentRef
    );
    event Withdrawn(address indexed to, uint256 amount);

    constructor(address facts, address _treasury, address _owner) Auth(_owner) {
        require(facts != address(0) && _treasury != address(0), "ZERO_ADDR");
        FACTS = IERC20(facts);
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ZERO_TREASURY");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setAutoForward(bool enabled) external onlyOwner {
        autoForward = enabled;
        emit AutoForwardUpdated(enabled);
    }

    /// @notice List or reprice a SKU, e.g. keccak256("SEASON_PASS_30D").
    function setPrice(bytes32 sku, uint256 price) external onlyOperator {
        priceOf[sku] = price;
        emit PriceUpdated(sku, price);
    }

    function setPrices(bytes32[] calldata skus, uint256[] calldata prices) external onlyOperator {
        require(skus.length == prices.length, "LENGTH_MISMATCH");
        for (uint256 i; i < skus.length; ++i) {
            priceOf[skus[i]] = prices[i];
            emit PriceUpdated(skus[i], prices[i]);
        }
    }

    // ── Payments ───────────────────────────────────────────────────────────

    /// @notice Pay for a listed SKU at its configured price.
    function pay(bytes32 sku, bytes32 paymentRef) external {
        uint256 price = priceOf[sku];
        require(price > 0, "SKU_NOT_LISTED");
        _pay(sku, msg.sender, price, paymentRef);
    }

    /// @notice Pay for a SKU on behalf of another account (gifting / relayers).
    function payFor(bytes32 sku, address beneficiary, bytes32 paymentRef) external {
        uint256 price = priceOf[sku];
        require(price > 0, "SKU_NOT_LISTED");
        _pay(sku, beneficiary, price, paymentRef);
    }

    /// @notice Open-amount payment (tips, marketplace, dynamic pricing).
    function payAmount(bytes32 sku, address beneficiary, uint256 amount, bytes32 paymentRef) external {
        require(amount > 0, "ZERO_AMOUNT");
        _pay(sku, beneficiary, amount, paymentRef);
    }

    function _pay(bytes32 sku, address beneficiary, uint256 amount, bytes32 paymentRef)
        private
        nonReentrant
        whenNotPaused
    {
        require(beneficiary != address(0), "ZERO_BENEFICIARY");
        grossOf[sku] += amount;

        if (autoForward) {
            FACTS.safeTransferFrom(msg.sender, treasury, amount);
        } else {
            FACTS.safeTransferFrom(msg.sender, address(this), amount);
        }

        emit PaymentReceived(sku, msg.sender, beneficiary, amount, paymentRef);
    }

    // ── Withdrawals ────────────────────────────────────────────────────────

    /// @notice Sweep held FACTS to the treasury (only needed when autoForward is off).
    function withdraw(uint256 amount) external onlyOwner {
        FACTS.safeTransfer(treasury, amount);
        emit Withdrawn(treasury, amount);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(FACTS), "USE_WITHDRAW");
        IERC20(token).safeTransfer(to, amount);
    }
}
