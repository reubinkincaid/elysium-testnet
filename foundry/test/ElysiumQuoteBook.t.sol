// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ElysiumQuoteBook} from "../src/ElysiumQuoteBook.sol";

/// @dev The important properties here are the cadence control and the
///      honesty of the staleness signal — a consumer must be able to tell
///      whether a quote is live without trusting the publisher.
contract ElysiumQuoteBookTest is Test {
    ElysiumQuoteBook book;
    address token = address(0xA11CE);
    uint256 constant MIN_INTERVAL = 5;

    uint256 constant BID = 100e18;
    uint256 constant ASK = 101e18;

    function setUp() public {
        book = new ElysiumQuoteBook(MIN_INTERVAL);
    }

    function test_starts_empty() public view {
        (uint256 bid, uint256 ask, uint256 age) = book.getQuote(token);
        assertEq(bid, 0);
        assertEq(ask, 0);
        assertEq(age, type(uint256).max, "never-quoted reports max age, not 0");
    }

    function test_first_refresh_succeeds() public {
        book.refresh(token, BID, ASK);
        (uint256 bid, uint256 ask, uint256 age) = book.getQuote(token);
        assertEq(bid, BID);
        assertEq(ask, ASK);
        assertLe(age, 1);
    }

    function test_refresh_too_soon_reverts() public {
        book.refresh(token, BID, ASK);
        vm.expectRevert("EQB: too soon");
        book.refresh(token, BID, ASK);
    }

    /// After the interval elapses, refresh works again.
    function test_refresh_allowed_after_interval() public {
        book.refresh(token, BID, ASK);
        vm.warp(block.timestamp + MIN_INTERVAL);
        book.refresh(token, BID, ASK + 1);
        assertEq(book.refreshCount(token), 2);
    }

    /// tryRefresh must not revert — it returns false and emits instead, so a
    /// keeper loop can call every block without reverting its own tx.
    function test_tryRefresh_does_not_revert_when_too_soon() public {
        assertTrue(book.tryRefresh(token, BID, ASK));
        assertFalse(book.tryRefresh(token, BID, ASK), "second call in same block skipped");
        vm.warp(block.timestamp + MIN_INTERVAL);
        assertTrue(book.tryRefresh(token, BID, ASK + 1));
    }

    function test_nextAllowedAt() public {
        book.refresh(token, BID, ASK);
        assertEq(book.nextAllowedAt(token), block.timestamp + MIN_INTERVAL);
    }

    function test_rejects_crossed_book() public {
        vm.expectRevert("EQB: crossed book");
        book.refresh(token, ASK, BID); // bid > ask
    }

    function test_rejects_zero_quote() public {
        vm.expectRevert("EQB: zero quote");
        book.refresh(token, 0, ASK);
    }

    function test_rejects_zero_token() public {
        vm.expectRevert("EQB: token is zero");
        book.refresh(address(0), BID, ASK);
    }

    /// An exactly-flat book (ask == bid) is rejected. A zero-width book is
    /// not a market: it has no spread to cross and would look like a live
    /// quote with no liquidity, so the contract refuses to record one.
    function test_rejects_flat_quote() public {
        vm.expectRevert("EQB: crossed book");
        book.refresh(token, BID, BID);
    }

    // ------------------------------------------------------------ staleness
    function test_not_stale_when_fresh() public {
        book.refresh(token, BID, ASK);
        assertFalse(book.isStale(token, 10));
    }

    function test_stale_when_old() public {
        book.refresh(token, BID, ASK);
        vm.warp(block.timestamp + 11);
        assertTrue(book.isStale(token, 10));
    }

    function test_never_quoted_is_stale() public view {
        assertTrue(book.isStale(token, 10), "an empty book must not look live");
    }

    /// Staleness must be monotonic: time only moves forward, so a quote that
    /// was fresh cannot become fresh again without a new refresh.
    function test_staleness_increases_monotonically() public {
        book.refresh(token, BID, ASK);
        uint256 lastAge;
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + 3);
            (, , uint256 age) = book.getQuote(token);
            assertGt(age, lastAge);
            lastAge = age;
        }
    }

    /// Emits with a plausible spread. 1/100.5 ~= 99bps.
    function test_emits_spread() public {
        vm.expectEmit(true, false, false, true);
        emit ElysiumQuoteBook.Quoted(token, BID, ASK, 99, block.timestamp);
        book.refresh(token, BID, ASK);
    }
}
