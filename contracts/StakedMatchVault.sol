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
 * @title StakedMatchVault
 * @notice Escrow + payout vault for staked FarAction matches on Base.
 *
 * Rules:
 *  - A match is configured with EXACTLY ONE reward asset: USDC or FACTS.
 *    Both players stake that same asset; the match never pays out both.
 *  - On settlement: 90% of the pot is credited to the winner, 10% is sent to
 *    the treasury immediately.
 *  - The winner's share is PULL-based: the winner must call `claim`.
 */
contract StakedMatchVault is Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Asset {
        USDC,
        FACTS
    }

    enum Status {
        None,
        Open,     // created, waiting for opponent
        Locked,   // both stakes escrowed, match in progress
        Settled,  // winner decided, share claimable
        Cancelled // refunded
    }

    struct Match {
        address creator;
        address opponent;
        address winner;
        Asset asset;
        Status status;
        uint256 stake; // per-player stake amount
    }

    /// @notice 10% of every settled pot.
    uint16 public constant TREASURY_BPS = 1_000;
    uint16 public constant BPS_DENOMINATOR = 10_000;

    IERC20 public immutable USDC;
    IERC20 public immutable FACTS;

    address public treasury;

    mapping(bytes32 => Match) public matches;
    /// @dev account => asset => claimable winnings.
    mapping(address => mapping(Asset => uint256)) public claimable;

    event TreasuryUpdated(address indexed treasury);
    event MatchCreated(bytes32 indexed matchId, address indexed creator, Asset asset, uint256 stake);
    event MatchJoined(bytes32 indexed matchId, address indexed opponent);
    event MatchSettled(
        bytes32 indexed matchId, address indexed winner, Asset asset, uint256 winnerAmount, uint256 treasuryAmount
    );
    event MatchCancelled(bytes32 indexed matchId);
    event WinningsClaimed(address indexed account, Asset asset, uint256 amount);
    event Refunded(bytes32 indexed matchId, address indexed account, uint256 amount);

    constructor(address usdc, address facts, address _treasury, address _owner) Auth(_owner) {
        require(usdc != address(0) && facts != address(0) && _treasury != address(0), "ZERO_ADDR");
        USDC = IERC20(usdc);
        FACTS = IERC20(facts);
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "ZERO_TREASURY");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function tokenOf(Asset asset) public view returns (IERC20) {
        return asset == Asset.USDC ? USDC : FACTS;
    }

    // ── Match lifecycle ────────────────────────────────────────────────────

    /// @notice Create a staked match. The creator's stake is escrowed here.
    function createMatch(bytes32 matchId, Asset asset, uint256 stake) external nonReentrant whenNotPaused {
        require(matches[matchId].status == Status.None, "MATCH_EXISTS");
        require(stake > 0, "ZERO_STAKE");

        matches[matchId] = Match({
            creator: msg.sender,
            opponent: address(0),
            winner: address(0),
            asset: asset,
            status: Status.Open,
            stake: stake
        });

        tokenOf(asset).safeTransferFrom(msg.sender, address(this), stake);
        emit MatchCreated(matchId, msg.sender, asset, stake);
    }

    /// @notice Join an open match by matching the stake in the same asset.
    function joinMatch(bytes32 matchId) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        require(m.status == Status.Open, "NOT_OPEN");
        require(msg.sender != m.creator, "SELF_JOIN");

        m.opponent = msg.sender;
        m.status = Status.Locked;

        tokenOf(m.asset).safeTransferFrom(msg.sender, address(this), m.stake);
        emit MatchJoined(matchId, msg.sender);
    }

    /**
     * @notice Settle a locked match. 90% credited to the winner (claimable),
     *         10% transferred to the treasury immediately.
     */
    function settleMatch(bytes32 matchId, address winner) external nonReentrant onlyOperator {
        Match storage m = matches[matchId];
        require(m.status == Status.Locked, "NOT_LOCKED");
        require(winner == m.creator || winner == m.opponent, "BAD_WINNER");

        uint256 pot = m.stake * 2;
        uint256 treasuryAmount = (pot * TREASURY_BPS) / BPS_DENOMINATOR;
        uint256 winnerAmount = pot - treasuryAmount;

        m.winner = winner;
        m.status = Status.Settled;
        claimable[winner][m.asset] += winnerAmount;

        tokenOf(m.asset).safeTransfer(treasury, treasuryAmount);
        emit MatchSettled(matchId, winner, m.asset, winnerAmount, treasuryAmount);
    }

    /// @notice Cancel an unjoined match (creator or operator) and refund the creator.
    function cancelMatch(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == Status.Open, "NOT_OPEN");
        require(msg.sender == m.creator || msg.sender == owner || isOperator[msg.sender], "NOT_ALLOWED");

        m.status = Status.Cancelled;
        tokenOf(m.asset).safeTransfer(m.creator, m.stake);
        emit MatchCancelled(matchId);
        emit Refunded(matchId, m.creator, m.stake);
    }

    /// @notice Abort a locked match (e.g. dispute) and refund both stakes, no fee.
    function refundMatch(bytes32 matchId) external nonReentrant onlyOperator {
        Match storage m = matches[matchId];
        require(m.status == Status.Locked, "NOT_LOCKED");

        m.status = Status.Cancelled;
        IERC20 token = tokenOf(m.asset);
        token.safeTransfer(m.creator, m.stake);
        token.safeTransfer(m.opponent, m.stake);
        emit MatchCancelled(matchId);
        emit Refunded(matchId, m.creator, m.stake);
        emit Refunded(matchId, m.opponent, m.stake);
    }

    // ── Claiming (pull only) ───────────────────────────────────────────────

    /// @notice Winners must claim; the vault never pushes winnings.
    function claim(Asset asset) external nonReentrant whenNotPaused returns (uint256 amount) {
        amount = claimable[msg.sender][asset];
        require(amount > 0, "NOTHING_TO_CLAIM");
        claimable[msg.sender][asset] = 0;
        tokenOf(asset).safeTransfer(msg.sender, amount);
        emit WinningsClaimed(msg.sender, asset, amount);
    }

    /// @notice Rescue unrelated tokens sent here by mistake.
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(USDC) && token != address(FACTS), "ESCROWED_ASSET");
        IERC20(token).safeTransfer(to, amount);
    }
}
