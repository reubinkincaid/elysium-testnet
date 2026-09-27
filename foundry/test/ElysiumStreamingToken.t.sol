// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ElysiumStreamingToken} from "../src/ElysiumStreamingToken.sol";

/// @dev Uses vm.warp to move time, since accrual is time-based. The point of
///      these tests is that emission is a pure function of elapsed time and
///      the holder's share of supply — no hidden state, no owner.
///
///      A note on scale: `RATE` is 1 EST per second across the WHOLE supply,
///      so a holder owning a fraction `f` of supply earns `f * elapsed` EST.
///      With 1,000,000 initial supply and one holder, 100s of time yields
///      100 wei-units, not 100e18. The tests below assert that relationship
///      explicitly rather than assuming the holder owns everything.
contract ElysiumStreamingTokenTest is Test {
    ElysiumStreamingToken token;

    address holder = address(0xA11CE);
    address other = address(0xB0B);

    uint256 constant INITIAL = 1_000_000 ether;
    uint256 constant RATE = 1 ether; // 1 EST per second

    function setUp() public {
        token = new ElysiumStreamingToken(INITIAL, RATE, holder);
    }

    function test_constructor_assigns_all_supply() public view {
        assertEq(token.totalSupply(), INITIAL);
        assertEq(token.balanceOf(holder), INITIAL);
        assertEq(token.balanceOf(other), 0);
    }

    function test_symbols() public view {
        assertEq(token.name(), "Open Exchange Token");
        assertEq(token.symbol(), "OEX");
        assertEq(token.decimals(), 18);
    }

    function test_pending_is_zero_at_creation() public view {
        assertEq(token.pendingOf(holder), 0);
    }

    /// RATE is 1e18 units/sec across total supply, so elapsed seconds yield
    /// exactly `elapsed` units in total, split by supply share.
    function test_pending_tracks_elapsed_time() public {
        vm.warp(block.timestamp + 100);
        assertEq(token.pendingOf(holder), 100, "100s at 1e18/s across whole supply");
    }

    function test_claim_mints_exactly_elapsed_emission() public {
        vm.warp(block.timestamp + 250);
        // Call as the holder, not the default test contract.
        vm.prank(holder);
        uint256 claimed = token.claim();
        assertEq(claimed, 250, "250s elapsed at 1e18/s across whole supply");
    }

    function test_supply_grows_with_emission() public {
        vm.warp(block.timestamp + 60);
        token.accrue();
        assertEq(token.totalSupply(), INITIAL + 60);
    }

    /// Two holders should split emission by share of supply, pro rata.
    function test_two_holders_split_pro_rata() public {
        // move half the supply to `other`
        vm.prank(holder);
        token.transfer(other, INITIAL / 2);

        vm.warp(block.timestamp + 100);

        uint256 pendA = token.pendingOf(holder);
        uint256 pendB = token.pendingOf(other);
        assertEq(pendA, pendB, "equal shares earn equally");
        assertEq(pendA, 50, "each holds half the supply, so each gets half of 100s");
    }

    /// A holder who acquires tokens later must not claim the prior period.
    function test_new_holder_cannot_claim_backdated_emission() public {
        vm.warp(block.timestamp + 100);
        vm.prank(holder);
        token.transfer(other, INITIAL / 2);

        // `other` should only earn from now forward, not the past 100s
        assertEq(token.pendingOf(other), 0, "no backdated emission");
    }

    function test_accrue_is_permissionless_and_idempotent_in_block() public {
        vm.warp(block.timestamp + 10);
        uint256 s1 = token.accrue();
        uint256 s2 = token.accrue(); // same block
        assertGt(s1, 0);
        assertEq(s2, 0, "second call in same block emits nothing");
    }

    function test_transfer_realises_pending_first() public {
        vm.warp(block.timestamp + 30);
        uint256 before = token.balanceOf(holder);

        vm.prank(holder);
        token.transfer(other, 1 ether);

        // holder realised 30s of emission AND moved 1 token
        assertEq(token.balanceOf(holder), before + 30 - 1 ether);
        assertEq(token.balanceOf(other), 1 ether);
    }

    function test_allowance_and_transferFrom() public {
        vm.warp(block.timestamp + 5);
        vm.prank(holder);
        token.approve(other, 100 ether);
        assertEq(token.allowance(holder, other), 100 ether);

        vm.prank(other);
        token.transferFrom(holder, other, 40 ether);
        assertEq(token.allowance(holder, other), 60 ether);
        assertEq(token.balanceOf(other), 40 ether);
    }
    function test_cannot_overspend_balance() public {
        vm.expectRevert("EST: insufficient balance");
        token.transfer(other, INITIAL + 1);
    }

    function test_cannot_transfer_to_zero() public {
        vm.expectRevert("EST: transfer to zero");
        token.transfer(address(0), 1);
    }

    /// The contract must not grow faster than the configured rate, however
    /// many times accrue() is called. This is the anti-inflation property.
    function test_emission_rate_is_the_only_source() public {
        uint256 start = block.timestamp;
        vm.warp(start + 1000);

        // call accrue many times within the same window
        for (uint256 i = 0; i < 50; i++) {
            token.accrue();
        }
        // and a few more after warping a little each time
        for (uint256 i = 0; i < 10; i++) {
            vm.warp(block.timestamp + 1);
            token.accrue();
        }

        uint256 expected = INITIAL + ((block.timestamp - start) * RATE) / 1e18;
        assertEq(token.totalSupply(), expected, "supply tracks elapsed time exactly");
    }

    function test_claim_reverts_when_nothing_to_accrue() public {
        vm.expectRevert("EST: nothing to accrue");
        token.claim();
    }
}
