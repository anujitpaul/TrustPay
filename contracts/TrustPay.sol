// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TrustPay
 * @notice Minimal, non-custodial USDC payments intended for Arc Mainnet (chain ID 5042).
 * @dev Uses OpenZeppelin SafeERC20. The deployer must supply the authentic USDC
 * token address; the constructor checks code presence, not token identity or chain ID.
 * Payments transfer tokens directly from payer to recipient, never through this contract.
 * USDC accidentally sent directly to this contract is unrecoverable by design:
 * there is no withdrawal or rescue path. The app should approve only the exact
 * payment amount. There are no payable entry points, receive, or fallback functions.
 */
contract TrustPay {
    /// @dev Enables checked ERC-20 transfers for the configured token.
    using SafeERC20 for IERC20;

    /// @notice The immutable USDC token used for all payments.
    IERC20 public immutable usdc;

    /// @notice Number of payments recorded; the first payment has ID 1.
    uint256 public paymentCount;

    /// @notice Maximum note length in bytes, not Unicode characters.
    uint256 public constant MAX_NOTE_LENGTH = 140;

    /// @notice The supplied token address is zero or has no deployed code.
    /// @param token The rejected token address.
    error InvalidToken(address token);

    /// @notice The recipient is the zero address.
    error ZeroAddress();

    /// @notice The recipient is this contract or the payer.
    /// @param recipient The rejected recipient address.
    error InvalidRecipient(address recipient);

    /// @notice The payment amount is zero.
    error ZeroAmount();

    /// @notice The note exceeds MAX_NOTE_LENGTH bytes.
    /// @param length The supplied note length in bytes.
    /// @param maximum The maximum allowed note length in bytes.
    error NoteTooLong(uint256 length, uint256 maximum);

    /**
     * @notice Records a USDC payment made directly from sender to recipient.
     * @param id Unique payment ID, starting at 1.
     * @param sender Address paying USDC.
     * @param recipient Address receiving USDC.
     * @param amount Amount paid in the token's smallest units.
     * @param note Public payment note.
     */
    event PaymentSent(
        uint256 indexed id,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        string note
    );

    /**
     * @notice Configures the immutable payment token.
     * @dev Reverts with InvalidToken if the address is zero or has no code.
     * @param usdc_ Authentic USDC token contract on the intended deployment chain.
     */
    constructor(IERC20 usdc_) {
        if (address(usdc_) == address(0) || address(usdc_).code.length == 0) {
            revert InvalidToken(address(usdc_));
        }
        usdc = usdc_;
    }

    /**
     * @notice Pays USDC directly from the caller to a recipient.
     * @dev The payer must approve this contract for at least amount; the app should
     * approve only the exact amount. Checks precede effects: the counter is incremented
     * and the event is emitted before the external transfer, keeping ID/event ordering
     * consistent even if the token calls back. A failed transfer reverts both effects
     * and the event. USDC sent directly to this contract cannot be recovered.
     * @param recipient Nonzero recipient other than the caller or this contract.
     * @param amount Positive amount in the token's smallest units.
     * @param note Public note of at most MAX_NOTE_LENGTH bytes.
     * @return id Unique ID assigned to this payment.
     */
    function pay(address recipient, uint256 amount, string calldata note) external returns (uint256 id) {
        if (recipient == address(0)) revert ZeroAddress();
        if (recipient == address(this) || recipient == msg.sender) revert InvalidRecipient(recipient);
        if (amount == 0) revert ZeroAmount();
        uint256 noteLength = bytes(note).length;
        if (noteLength > MAX_NOTE_LENGTH) revert NoteTooLong(noteLength, MAX_NOTE_LENGTH);

        id = ++paymentCount;
        emit PaymentSent(id, msg.sender, recipient, amount, note);
        usdc.safeTransferFrom(msg.sender, recipient, amount);
    }
}
