// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {TrustPay} from "../TrustPay.sol";
import {DeployTrustPay} from "../script/DeployTrustPay.s.sol";

/// @dev 6-decimal mock USDC with open mint.
contract MockUSDC6 is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Token whose transferFrom returns false (non-reverting failure).
contract FalseToken {
    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}

abstract contract TrustPayTestBase is Test {
    MockUSDC6 internal usdc;
    TrustPay internal pay;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant FUNDS = 1_000_000e6;

    function setUp() public virtual {
        usdc = new MockUSDC6();
        pay = new TrustPay(IERC20(address(usdc)));
        usdc.mint(alice, FUNDS);
        vm.prank(alice);
        usdc.approve(address(pay), type(uint256).max);
    }

    function _repeat(string memory unit, uint256 n) internal pure returns (string memory) {
        bytes memory u = bytes(unit);
        bytes memory out = new bytes(u.length * n);
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < u.length; j++) {
                out[i * u.length + j] = u[j];
            }
        }
        return string(out);
    }
}

contract TrustPayTest is TrustPayTestBase {
    // ---------------- constructor ----------------

    function test_Constructor_SetsUsdc() public view {
        assertEq(address(pay.usdc()), address(usdc));
        assertEq(pay.paymentCount(), 0);
        assertEq(pay.MAX_NOTE_LENGTH(), 140);
    }

    function test_Constructor_RevertsOnZeroAddress() public {
        vm.expectRevert(abi.encodeWithSelector(TrustPay.InvalidToken.selector, address(0)));
        new TrustPay(IERC20(address(0)));
    }

    function test_Constructor_RevertsOnEOA() public {
        vm.expectRevert(abi.encodeWithSelector(TrustPay.InvalidToken.selector, bob));
        new TrustPay(IERC20(bob));
    }

    // ---------------- pay: happy path ----------------

    function test_Pay_MovesFundsAndReturnsId() public {
        vm.prank(alice);
        uint256 id = pay.pay(bob, 250e6, "lunch");
        assertEq(id, 1);
        assertEq(pay.paymentCount(), 1);
        assertEq(usdc.balanceOf(alice), FUNDS - 250e6);
        assertEq(usdc.balanceOf(bob), 250e6);
        assertEq(usdc.balanceOf(address(pay)), 0);
    }

    function test_Pay_IdsIncrementFromOne() public {
        for (uint256 i = 1; i <= 3; i++) {
            vm.prank(alice);
            assertEq(pay.pay(bob, 1e6, ""), i);
            assertEq(pay.paymentCount(), i);
        }
        assertEq(usdc.balanceOf(bob), 3e6);
        assertEq(usdc.balanceOf(address(pay)), 0);
    }

    function test_Pay_EmitsPaymentSent() public {
        vm.expectEmit(true, true, true, true, address(pay));
        emit TrustPay.PaymentSent(1, alice, bob, 42e6, "hello bob");
        vm.prank(alice);
        pay.pay(bob, 42e6, "hello bob");

        // second payment gets id 2 and different fields
        vm.expectEmit(true, true, true, true, address(pay));
        emit TrustPay.PaymentSent(2, alice, bob, 1, "");
        vm.prank(alice);
        pay.pay(bob, 1, "");
    }

    function test_Pay_ConsumesExactAllowance() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 10e6);
        vm.prank(carol);
        usdc.approve(address(pay), 10e6);
        vm.prank(carol);
        pay.pay(bob, 4e6, "x");
        assertEq(usdc.allowance(carol, address(pay)), 6e6);
    }

    // ---------------- pay: reverts ----------------

    function test_RevertWhen_RecipientZero() public {
        vm.prank(alice);
        vm.expectRevert(TrustPay.ZeroAddress.selector);
        pay.pay(address(0), 1e6, "");
    }

    function test_RevertWhen_RecipientIsSender() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TrustPay.InvalidRecipient.selector, alice));
        pay.pay(alice, 1e6, "");
    }

    function test_RevertWhen_RecipientIsContract() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TrustPay.InvalidRecipient.selector, address(pay)));
        pay.pay(address(pay), 1e6, "");
    }

    function test_RevertWhen_AmountZero() public {
        vm.prank(alice);
        vm.expectRevert(TrustPay.ZeroAmount.selector);
        pay.pay(bob, 0, "");
    }

    function test_RevertWhen_NoteTooLong_141Bytes() public {
        string memory note = _repeat("a", 141);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TrustPay.NoteTooLong.selector, 141, 140));
        pay.pay(bob, 1e6, note);
        assertEq(pay.paymentCount(), 0);
    }

    function test_Pay_NoteExactly140BytesOk() public {
        string memory note = _repeat("a", 140);
        vm.expectEmit(true, true, true, true, address(pay));
        emit TrustPay.PaymentSent(1, alice, bob, 1e6, note);
        vm.prank(alice);
        pay.pay(bob, 1e6, note);
        assertEq(pay.paymentCount(), 1);
    }

    function test_RevertWhen_InsufficientAllowance() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 10e6);
        vm.prank(carol);
        usdc.approve(address(pay), 5e6);
        vm.prank(carol);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(pay), 5e6, 6e6)
        );
        pay.pay(bob, 6e6, "");
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, alice, FUNDS, FUNDS + 1)
        );
        pay.pay(bob, FUNDS + 1, "");
    }

    function test_FailedTransferRollsBackPaymentCount() public {
        vm.prank(alice);
        pay.pay(bob, 1e6, "ok");
        assertEq(pay.paymentCount(), 1);

        // fails inside the token transfer, after the counter increment + event
        vm.prank(alice);
        vm.expectRevert();
        pay.pay(bob, FUNDS * 2, "fail");
        assertEq(pay.paymentCount(), 1, "count rolled back");

        // next success reuses id 2 (no gap)
        vm.prank(alice);
        assertEq(pay.pay(bob, 1e6, "ok2"), 2);
    }

    function test_FailedTransferRollsBack_TokenReturnsFalse() public {
        FalseToken ft = new FalseToken();
        TrustPay p2 = new TrustPay(IERC20(address(ft)));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(ft)));
        p2.pay(bob, 1e6, "");
        assertEq(p2.paymentCount(), 0);
    }

    // ---------------- native value ----------------

    function test_RevertWhen_NativeValueSentPlain() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(pay).call{value: 1 ether}("");
        assertFalse(ok);
        assertEq(address(pay).balance, 0);
    }

    function test_RevertWhen_NativeValueWithCalldata() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(pay).call{value: 1}(abi.encodeCall(TrustPay.pay, (bob, 1e6, "")));
        assertFalse(ok);
        assertEq(address(pay).balance, 0);
        assertEq(pay.paymentCount(), 0);
    }

    function test_RevertWhen_UnknownSelectorNoValue() public {
        (bool ok,) = address(pay).call(hex"deadbeef");
        assertFalse(ok);
    }

    // ---------------- multi-byte notes ----------------

    function test_Note_CountedInBytes_TwoByteChars() public {
        // "é" = 2 bytes. 70 chars = 140 bytes OK; 71 chars = 142 bytes reverts.
        string memory ok = _repeat(unicode"é", 70);
        assertEq(bytes(ok).length, 140);
        vm.prank(alice);
        pay.pay(bob, 1e6, ok);

        string memory tooLong = _repeat(unicode"é", 71);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TrustPay.NoteTooLong.selector, 142, 140));
        pay.pay(bob, 1e6, tooLong);
    }

    function test_Note_CountedInBytes_FourByteEmoji() public {
        // 35 emoji = 140 bytes OK; 36 = 144 bytes (only 36 chars) reverts.
        string memory ok = _repeat(unicode"😀", 35);
        assertEq(bytes(ok).length, 140);
        vm.prank(alice);
        pay.pay(bob, 1e6, ok);

        string memory tooLong = _repeat(unicode"😀", 36);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(TrustPay.NoteTooLong.selector, 144, 140));
        pay.pay(bob, 1e6, tooLong);
    }

    // ---------------- fuzz ----------------

    function testFuzz_Pay(address recipient, uint256 amount, uint256 noteLen) public {
        vm.assume(recipient != address(0) && recipient != alice && recipient != address(pay));
        amount = bound(amount, 1, FUNDS);
        noteLen = bound(noteLen, 0, 300);
        string memory note = _repeat("n", noteLen);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 recBefore = usdc.balanceOf(recipient);

        vm.prank(alice);
        if (noteLen > 140) {
            vm.expectRevert(abi.encodeWithSelector(TrustPay.NoteTooLong.selector, noteLen, 140));
            pay.pay(recipient, amount, note);
            assertEq(pay.paymentCount(), 0);
            assertEq(usdc.balanceOf(alice), aliceBefore);
        } else {
            vm.expectEmit(true, true, true, true, address(pay));
            emit TrustPay.PaymentSent(1, alice, recipient, amount, note);
            uint256 id = pay.pay(recipient, amount, note);
            assertEq(id, 1);
            assertEq(pay.paymentCount(), 1);
            assertEq(usdc.balanceOf(alice), aliceBefore - amount);
            assertEq(usdc.balanceOf(recipient), recBefore + amount);
        }
        assertEq(usdc.balanceOf(address(pay)), 0);
    }
}

// ---------------- invariant ----------------

contract TrustPayHandler is Test {
    TrustPay public pay;
    MockUSDC6 public usdc;
    address[] public actors;
    uint256 public successes;

    constructor(TrustPay _pay, MockUSDC6 _usdc) {
        pay = _pay;
        usdc = _usdc;
        for (uint256 i = 0; i < 4; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", vm.toString(i)))));
        }
        usdc.mint(address(this), 1e30);
        usdc.approve(address(pay), type(uint256).max);
    }

    /// @dev Inputs deliberately include invalid ones; only successes are counted.
    function doPay(uint256 recipientSeed, uint256 amount, uint256 noteLen) external {
        address recipient = recipientSeed % 7 == 0 ? address(0) : actors[recipientSeed % actors.length];
        if (recipientSeed % 11 == 0) recipient = address(pay);
        amount = bound(amount, 0, 1e12);
        noteLen = bound(noteLen, 0, 200);
        bytes memory note = new bytes(noteLen);
        try pay.pay(recipient, amount, string(note)) {
            successes++;
        } catch {}
    }

    /// @dev Someone tries to push USDC straight in is out of scope; try sending a failing over-balance pay.
    function doOverspend(uint256 recipientSeed) external {
        address recipient = actors[recipientSeed % actors.length];
        try pay.pay(recipient, type(uint256).max, "") {
            successes++;
        } catch {}
    }
}

contract TrustPayInvariantTest is TrustPayTestBase {
    TrustPayHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new TrustPayHandler(pay, usdc);
        targetContract(address(handler));
    }

    function invariant_NoBalanceHeldByTrustPay() public view {
        assertEq(usdc.balanceOf(address(pay)), 0);
        assertEq(address(pay).balance, 0);
    }

    function invariant_PaymentCountEqualsSuccesses() public view {
        assertEq(pay.paymentCount(), handler.successes());
    }
}

// ---------------- deploy script ----------------

contract DeployTrustPayTest is Test {
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    DeployTrustPay internal script;

    function setUp() public {
        script = new DeployTrustPay();
    }

    function test_Deploy_RevertsOnWrongChain() public {
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(DeployTrustPay.WrongChain.selector, 1));
        script.run();
    }

    function test_Deploy_RevertsWhenUsdcHasNoCode() public {
        vm.chainId(5042);
        vm.expectRevert(abi.encodeWithSelector(DeployTrustPay.UsdcHasNoCode.selector, ARC_USDC));
        script.run();
    }

    function test_Deploy_SucceedsOnArcWithMockedUsdc() public {
        MockUSDC6 mock = new MockUSDC6();
        vm.etch(ARC_USDC, address(mock).code);
        vm.chainId(5042);
        TrustPay deployed = script.run();
        assertEq(address(deployed.usdc()), ARC_USDC);
        assertEq(deployed.paymentCount(), 0);
        assertGt(address(deployed).code.length, 0);
    }
}
