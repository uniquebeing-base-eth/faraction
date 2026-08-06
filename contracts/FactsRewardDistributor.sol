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
 * @title FactsRewardDistributor
 * @notice Pull-based $FACTS reward distributor for FarAction.
 *
 * Used for every FACTS reward surface:
 *  - Daily FACTS claims
 *  - Season leaderboard rewards (top 25, weighted curve)
 *  - Ad-hoc admin distributions
 *  - Future campaigns and community events
 *
 * Design notes:
 *  - The contract NEVER pushes tokens. Eligible users must call `claim`.
 *  - Rewards are grouped into campaigns so seasons/events are isolated and the
 *    architecture stays modular (a new season = a new campaign id).
 *  - No changes to the FACTS token contract are required; the distributor is
 *    funded by transferring FACTS to it.
 */
contract FactsRewardDistributor is Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice $FACTS token on Base.
    IERC20 public immutable FACTS;

    struct Campaign {
        string name;        // e.g. "Season 1 • Genesis: The Awakening"
        uint64 startsAt;    // 0 = immediately claimable
        uint64 endsAt;      // 0 = no deadline
        bool locked;        // when true, allocations are frozen
        uint256 allocated;  // total FACTS allocated
        uint256 claimed;    // total FACTS claimed
    }

    /// @dev campaignId => campaign metadata.
    mapping(uint256 => Campaign) public campaigns;
    /// @dev campaignId => account => claimable FACTS.
    mapping(uint256 => mapping(address => uint256)) public claimable;
    /// @dev campaignId => account => already claimed FACTS.
    mapping(uint256 => mapping(address => uint256)) public claimedOf;

    /// @notice Total FACTS committed to unclaimed allocations across campaigns.
    uint256 public totalCommitted;

    uint256 public nextCampaignId = 1;

    event CampaignCreated(uint256 indexed campaignId, string name, uint64 startsAt, uint64 endsAt);
    event CampaignWindowUpdated(uint256 indexed campaignId, uint64 startsAt, uint64 endsAt);
    event CampaignLocked(uint256 indexed campaignId);
    event RewardsAllocated(uint256 indexed campaignId, address indexed account, uint256 amount);
    event RewardClaimed(uint256 indexed campaignId, address indexed account, uint256 amount);
    event Funded(address indexed from, uint256 amount);
    event Swept(address indexed to, uint256 amount);

    constructor(address facts, address _owner) Auth(_owner) {
        require(facts != address(0), "ZERO_TOKEN");
        FACTS = IERC20(facts);
    }

    // ── Funding ────────────────────────────────────────────────────────────

    /// @notice Pull FACTS into the distributor (requires prior approval).
    function fund(uint256 amount) external {
        FACTS.safeTransferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    /// @notice FACTS held but not committed to any allocation.
    function unallocatedBalance() public view returns (uint256) {
        uint256 bal = FACTS.balanceOf(address(this));
        return bal > totalCommitted ? bal - totalCommitted : 0;
    }

    // ── Campaign management ────────────────────────────────────────────────

    function createCampaign(string calldata name, uint64 startsAt, uint64 endsAt)
        external
        onlyOperator
        returns (uint256 campaignId)
    {
        require(endsAt == 0 || endsAt > startsAt, "BAD_WINDOW");
        campaignId = nextCampaignId++;
        campaigns[campaignId] =
            Campaign({name: name, startsAt: startsAt, endsAt: endsAt, locked: false, allocated: 0, claimed: 0});
        emit CampaignCreated(campaignId, name, startsAt, endsAt);
    }

    function setCampaignWindow(uint256 campaignId, uint64 startsAt, uint64 endsAt) external onlyOperator {
        Campaign storage c = campaigns[campaignId];
        require(bytes(c.name).length != 0, "NO_CAMPAIGN");
        require(endsAt == 0 || endsAt > startsAt, "BAD_WINDOW");
        c.startsAt = startsAt;
        c.endsAt = endsAt;
        emit CampaignWindowUpdated(campaignId, startsAt, endsAt);
    }

    /// @notice Freeze a campaign's allocations (e.g. once a season's leaderboard locks).
    function lockCampaign(uint256 campaignId) external onlyOperator {
        Campaign storage c = campaigns[campaignId];
        require(bytes(c.name).length != 0, "NO_CAMPAIGN");
        c.locked = true;
        emit CampaignLocked(campaignId);
    }

    // ── Allocation ─────────────────────────────────────────────────────────

    /// @notice Allocate (add to) a single account's claimable balance.
    function allocate(uint256 campaignId, address account, uint256 amount) public onlyOperator {
        Campaign storage c = campaigns[campaignId];
        require(bytes(c.name).length != 0, "NO_CAMPAIGN");
        require(!c.locked, "CAMPAIGN_LOCKED");
        require(account != address(0) && amount > 0, "BAD_ALLOCATION");

        uint256 committed = totalCommitted + amount;
        require(FACTS.balanceOf(address(this)) >= committed, "UNDERFUNDED");

        totalCommitted = committed;
        c.allocated += amount;
        claimable[campaignId][account] += amount;
        emit RewardsAllocated(campaignId, account, amount);
    }

    /// @notice Batch allocation — used for the top-25 season leaderboard payout.
    function allocateBatch(uint256 campaignId, address[] calldata accounts, uint256[] calldata amounts)
        external
        onlyOperator
    {
        require(accounts.length == amounts.length, "LENGTH_MISMATCH");
        for (uint256 i; i < accounts.length; ++i) {
            allocate(campaignId, accounts[i], amounts[i]);
        }
    }

    // ── Claiming (pull only) ───────────────────────────────────────────────

    function claim(uint256 campaignId) external nonReentrant whenNotPaused returns (uint256 amount) {
        Campaign storage c = campaigns[campaignId];
        require(bytes(c.name).length != 0, "NO_CAMPAIGN");
        require(block.timestamp >= c.startsAt, "NOT_STARTED");
        require(c.endsAt == 0 || block.timestamp <= c.endsAt, "CLAIM_WINDOW_CLOSED");

        amount = claimable[campaignId][msg.sender];
        require(amount > 0, "NOTHING_TO_CLAIM");

        claimable[campaignId][msg.sender] = 0;
        claimedOf[campaignId][msg.sender] += amount;
        c.claimed += amount;
        totalCommitted -= amount;

        FACTS.safeTransfer(msg.sender, amount);
        emit RewardClaimed(campaignId, msg.sender, amount);
    }

    /// @notice Claim across several campaigns (e.g. daily claims + season reward).
    function claimMany(uint256[] calldata campaignIds) external nonReentrant whenNotPaused returns (uint256 total) {
        for (uint256 i; i < campaignIds.length; ++i) {
            uint256 campaignId = campaignIds[i];
            Campaign storage c = campaigns[campaignId];
            if (bytes(c.name).length == 0) continue;
            if (block.timestamp < c.startsAt) continue;
            if (c.endsAt != 0 && block.timestamp > c.endsAt) continue;

            uint256 amount = claimable[campaignId][msg.sender];
            if (amount == 0) continue;

            claimable[campaignId][msg.sender] = 0;
            claimedOf[campaignId][msg.sender] += amount;
            c.claimed += amount;
            totalCommitted -= amount;
            total += amount;
            emit RewardClaimed(campaignId, msg.sender, amount);
        }
        require(total > 0, "NOTHING_TO_CLAIM");
        FACTS.safeTransfer(msg.sender, total);
    }

    // ── Admin recovery ─────────────────────────────────────────────────────

    /// @notice Withdraw only FACTS that are not committed to an allocation.
    function sweepUnallocated(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "ZERO_TO");
        require(amount <= unallocatedBalance(), "COMMITTED");
        FACTS.safeTransfer(to, amount);
        emit Swept(to, amount);
    }

    /// @notice Rescue tokens accidentally sent here (never FACTS).
    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(FACTS), "USE_SWEEP");
        IERC20(token).safeTransfer(to, amount);
    }
}
