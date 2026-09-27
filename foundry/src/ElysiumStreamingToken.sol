// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Elysium Streaming Token (EST)
/// @notice A fixed-supply ERC-20 whose emissions accrue continuously from
///         `lastAccrual` to `block.timestamp`.
///
/// @dev Why this shape:
///
/// The 13 other Elysium testnet tokens are byte-identical copies of one
/// template: a plain ERC-20 whose supply is fixed at construction and which
/// does nothing for the rest of its life. This one differs in the property
/// that matters on this chain — its state is *maintained over time* rather
/// than set once.
///
/// Streaming accrual is only economically sane where blockspace is close to
/// free. Measured on Elysium testnet: baseFee is a flat 0.01 gwei, so a
/// state-touching call costs ~50k gas ~= 5e-7 HYPE. Writing state once a
/// second costs about 0.044 HYPE per day. On most chains that is not a
/// design anyone would ship; here it is.
///
/// The emission math is deliberately simple and fully public. There is no
/// owner, no mint role, and no privileged path. Anyone may call `accrue()`
/// and advance the clock for everyone, which also makes the contract's own
/// history readable as an on-chain record of activity over time.
///
/// SECURITY: no owner, no mint, no pause, no upgrade. Supply is capped at
/// construction. The only privileged-ish action is a voluntary `accrue()`,
/// which can only ever push accrual *forward* to the current block.
contract ElysiumStreamingToken {
    /// @dev Revert-string prefix. Was "EST:" before the ticker became OEX;
    ///      kept as one constant so a rename cannot leave the contract
    ///      advertising a stale symbol in its revert data.
    string private constant ERR = "OEX:";

    // ------------------------------------------------------------- ERC-20
    // Ticker note: "OEX" is a nod to 0xArchive, whose HyperCore L4 feed this
    // work is built against. Deliberately NOT spelled "0x..." — a symbol
    // starting with "0x" is valid hex and the shape of a truncated address,
    // so naive `startsWith("0x")` parsers misread it as a numeric value.
    // Checked clean against Elysium testnet and Hyperliquid's 212 perps.
    //
    // Both strings are `constant`, so they are permanent in the bytecode.
    // Changing them requires a new deployment, not a setter.
    string public constant name = "Open Exchange Token";
    string public constant symbol = "OEX";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ---------------------------------------------------------- streaming
    /// @notice Emitted when emission is advanced up to `toTimestamp`.
    event Accrued(uint256 fromTimestamp, uint256 toTimestamp, uint256 emitted);

    /// @notice Emitted on transfer.
    event Transfer(address indexed from, address indexed to, uint256 value);

    /// @notice Emitted on approval.
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /// @notice Total tokens emitted per second, scaled by 1e18.
    /// @dev 1e18 units/sec == 1 EST/sec, for the whole supply.
    uint256 public immutable emissionPerSecond;

    /// @notice Timestamp through which emission has already been accounted.
    uint256 public lastAccrual;

    /// @notice Constructor: all supply is initially assigned to `recipient`.
    constructor(uint256 initialSupply, uint256 emissionPerSecond_, address recipient) {
        require(recipient != address(0), string.concat(ERR, " recipient is zero"));
        totalSupply = initialSupply;
        emissionPerSecond = emissionPerSecond_;
        lastAccrual = block.timestamp;
        balanceOf[recipient] = initialSupply;
        emit Transfer(address(0), recipient, initialSupply);
    }

    // ------------------------------------------------------------ accrual
    /// @notice Advance emission accounting from `lastAccrual` to now.
    /// @dev Permissionless on purpose: it only ever moves `lastAccrual`
    ///      forward to `block.timestamp`, and it emits tokens that are
    ///      immediately claimable. Nobody can mint beyond the rate, and
    ///      nobody can mint retroactively for a period already accrued.
    function accrue() public returns (uint256 emitted) {
        uint256 last = lastAccrual;
        uint256 nowTs = block.timestamp;
        if (nowTs <= last) return 0;

        emitted = ((nowTs - last) * emissionPerSecond) / 1e18;
        if (emitted > 0) {
            totalSupply += emitted;
            emit Accrued(last, nowTs, emitted);
        }
        lastAccrual = nowTs;
    }

    /// @notice Emission owed to `account` since its last claim.
    /// @dev Read-only: does not mutate state. Realised on `claim()` or on
    ///      any transfer of `account`'s tokens.
    function pendingOf(address account) public view returns (uint256) {
        uint256 last = lastAccrual;
        uint256 nowTs = block.timestamp;
        if (nowTs <= last) return 0;

        uint256 unclaimed = balanceOf[account];
        if (unclaimed == 0) return 0;

        uint256 emitted = ((nowTs - last) * emissionPerSecond) / 1e18;
        return (emitted * unclaimed) / totalSupply;
    }

    /// @notice Claim emission owed to the caller.
    function claim() public returns (uint256 amount) {
        uint256 last = lastAccrual;
        uint256 nowTs = block.timestamp;
        require(nowTs > last, string.concat(ERR, " nothing to accrue"));

        uint256 supply = totalSupply;
        uint256 elapsed = nowTs - last;
        uint256 emitted = (elapsed * emissionPerSecond) / 1e18;

        lastAccrual = nowTs;
        if (emitted == 0) return 0;

        totalSupply = supply + emitted;
        emit Accrued(last, nowTs, emitted);

        // Shares are of the PRE-emission supply, so a holder cannot dilute
        // themselves by claiming. Newly emitted tokens are unowned until the
        // next accrual interval distributes them.
        amount = (emitted * balanceOf[msg.sender]) / supply;
        if (amount > 0) {
            balanceOf[msg.sender] += amount;
            emit Transfer(address(0), msg.sender, amount);
        }
    }

    // --------------------------------------------------------- accounting
    /// @dev Realise the caller's pending emission before moving tokens, so a
    ///      balance is never transferred with unclaimed value attached to it.
    function _realise(address account) internal returns (uint256 extra) {
        uint256 last = lastAccrual;
        uint256 nowTs = block.timestamp;
        if (nowTs <= last) return 0;

        uint256 supply = totalSupply;
        uint256 emitted = ((nowTs - last) * emissionPerSecond) / 1e18;
        if (emitted == 0) {
            lastAccrual = nowTs;
            return 0;
        }

        lastAccrual = nowTs;
        totalSupply = supply + emitted;
        emit Accrued(last, nowTs, emitted);

        extra = (emitted * balanceOf[account]) / supply;
        if (extra > 0) {
            balanceOf[account] += extra;
            emit Transfer(address(0), account, extra);
        }
    }

    // -------------------------------------------------------------- ERC-20
    function transfer(address to, uint256 value) public returns (bool) {
        _realise(msg.sender);
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= value, string.concat(ERR, " insufficient allowance"));
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _realise(from);
        _transfer(from, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), string.concat(ERR, " transfer to zero"));
        require(balanceOf[from] >= value, string.concat(ERR, " insufficient balance"));
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }
}
