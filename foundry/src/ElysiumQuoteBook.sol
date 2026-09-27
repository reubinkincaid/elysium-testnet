// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Elysium Quote Book
/// @notice Maintains a live two-sided quote for a token pair and refreshes it
///         on a block-driven cadence. Costs scale with the refresh rate, so
///         running cost is a dial, not a hidden constant.
///
/// @dev Purpose. Elysium's sequencer revenue splits 50% KNTQ buyback /
///      25% builders / 25% treasury, and the docs describe the 25% as going
///      to "apps consuming blockspace". Blockspace consumption is the only
///      one of those three that is measurable from outside, and this contract
///      measures it honestly: `refresh()` is a real state write whose gas cost
///      is paid on every call, and `getQuote()` never lies about when the
///      book was last touched.
///
///      This is deliberately NOT a game of "call functions to farm a reward".
///      Nothing here mints, self-calls, or generates its own activity. Each
///      refresh is externally initiated, and the contract records a genuine
///      quote change rather than a counter bump. If nobody refreshes it, it
///      goes stale and says so — which is the behaviour a real consumer
///      needs to trust it.
///
///      No owner, no privileged path, no upgrade. Quotes are set by whoever
///      refreshes; there is no oracle and no price feed, so this must not be
///      used as a price source without adding one.
contract ElysiumQuoteBook {
    // -------------------------------------------------------------- events
    event Quoted(
        address indexed token,
        uint256 bid,
        uint256 ask,
        uint256 spreadBps,
        uint256 refreshedAt
    );

    /// @notice Emitted when a refresh is rejected as too soon. Useful for
    ///         measuring achieved cadence without reading storage.
    event RefreshSkipped(address indexed token, uint256 nextAllowedAt);

    struct Book {
        uint256 bid;
        uint256 ask;
        uint256 quotedAt;
    }

    /// @notice Minimum seconds between refreshes for a token.
    /// @dev The cadence dial. At the Elysium testnet baseFee of 0.01 gwei a
    ///      refresh costs roughly 60-90k gas, so even a 1-second cadence is
    ///      a fraction of a cent per day. On a chain with real fees this
    ///      number would be the whole design.
    uint256 public immutable minInterval;

    mapping(address => Book) public books;

    // Per-token running counters, so cost is observable from outside.
    mapping(address => uint256) public refreshCount;
    mapping(address => uint256) public lastRefreshGas;

    constructor(uint256 minInterval_) {
        minInterval = minInterval_;
    }

    /// @notice Publish a two-sided quote for `token`.
    /// @dev Reverts if called sooner than `minInterval` since the last
    ///      refresh. The revert is the cadence control; `tryRefresh` is the
    ///      non-reverting form for callers that do not want to fail.
    function refresh(address token, uint256 bid, uint256 ask) public {
        Book storage b = books[token];
        uint256 nowTs = block.timestamp;
        // An unquoted book (quotedAt == 0) must always be refreshable. Without
        // this, a chain whose timestamp is still small — which is exactly the
        // case on a fresh testnet — can never seed its first quote, because
        // 0 + minInterval exceeds block.timestamp for the first ~5 seconds.
        if (b.quotedAt != 0) {
            require(nowTs >= b.quotedAt + minInterval, "EQB: too soon");
        }
        _write(token, bid, ask, nowTs);
    }

    /// @notice Non-reverting form of `refresh`. Returns false if skipped.
    function tryRefresh(address token, uint256 bid, uint256 ask) public returns (bool) {
        Book storage b = books[token];
        uint256 nowTs = block.timestamp;
        if (b.quotedAt != 0 && nowTs < b.quotedAt + minInterval) {
            emit RefreshSkipped(token, b.quotedAt + minInterval);
            return false;
        }
        _write(token, bid, ask, nowTs);
        return true;
    }

    function _write(address token, uint256 bid, uint256 ask, uint256 nowTs) internal {
        require(token != address(0), "EQB: token is zero");
        require(bid > 0 && ask > 0, "EQB: zero quote");
        // Strictly greater: a flat book has no spread to cross, so recording
        // one would advertise a live quote that has no market in it.
        require(ask > bid, "EQB: crossed book");

        uint256 mid = (bid + ask) / 2;
        uint256 spreadBps = (ask > bid) ? (((ask - bid) * 10_000) / mid) : 0;

        books[token] = Book({bid: bid, ask: ask, quotedAt: nowTs});
        refreshCount[token] += 1;
        lastRefreshGas[token] = gasleft();

        emit Quoted(token, bid, ask, spreadBps, nowTs);
    }

    /// @notice Current book for `token`, plus staleness in seconds.
    function getQuote(address token) external view returns (uint256 bid, uint256 ask, uint256 age) {
        Book storage b = books[token];
        bid = b.bid;
        ask = b.ask;
        age = b.quotedAt == 0 ? type(uint256).max : block.timestamp - b.quotedAt;
    }

    /// @notice Whether a quote is fresh enough to act on.
    function isStale(address token, uint256 maxAge) external view returns (bool) {
        Book storage b = books[token];
        if (b.quotedAt == 0) return true;
        return block.timestamp - b.quotedAt > maxAge;
    }

    /// @notice When `token` may next be refreshed.
    function nextAllowedAt(address token) external view returns (uint256) {
        return books[token].quotedAt + minInterval;
    }
}
