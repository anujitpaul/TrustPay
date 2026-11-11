// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Remix deploy: compiler 0.8.28; optimizer enabled, 200 runs; EVM cancun.
// Network: Arc Mainnet, chain ID 5042.
// Constructor usdc_: 0x3600000000000000000000000000000000000000.

/**
 * @title ITrustPayUSDC
 * @notice Minimal ERC-20 interface for the configured USDC token.
 */
interface ITrustPayUSDC {
    /**
     * @notice Transfers tokens using the caller's allowance from the payer.
     * @param from Address paying tokens.
     * @param to Address receiving tokens.
     * @param amount Amount in the token's smallest units.
     * @return success Whether the transfer succeeded.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool success);

    /**
     * @notice Returns an account's token balance.
     * @param account Address whose balance is requested.
     * @return balance Balance in the token's smallest units.
     */
    function balanceOf(address account) external view returns (uint256 balance);
}

/**
 * @title TrustPay
 * @notice Minimal, non-custodial USDC payments intended for Arc Mainnet (chain ID 5042).
 * @dev Self-contained, with checked low-level ERC-20 transfers and no imports.
 * The deployer must supply the authentic USDC token address; the constructor checks
 * code presence, not token identity or chain ID. Payments transfer tokens directly
 * from payer to recipient, never through this contract.
 * USDC accidentally sent directly to this contract is unrecoverable by design:
 * there is no withdrawal or rescue path. The app should approve only the exact
 * payment amount. There are no payable entry points, receive, or fallback functions.
 * There is no owner, admin, pause, upgradeability, or fee mechanism.
 */
contract TrustPay {
    /// @notice The immutable USDC token used for all payments.
    ITrustPayUSDC public immutable usdc;

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

    /// @notice The token call failed without revert data or returned an invalid result.
    /// @param from The payer whose transfer failed.
    /// @param to The intended recipient.
    /// @param amount The amount that could not be transferred.
    error TransferFailed(address from, address to, uint256 amount);

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
    constructor(address usdc_) {
        if (usdc_ == address(0) || usdc_.code.length == 0) {
            revert InvalidToken(usdc_);
        }
        usdc = ITrustPayUSDC(usdc_);
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
        _safeTransferFrom(msg.sender, recipient, amount);
    }

    /**
     * @notice Executes a checked transfer directly from payer to recipient.
     * @dev Accepts only successful calls with empty return data or at least 32 bytes
     * whose first word is the canonical ABI encoding of true (1). Trailing bytes are
     * allowed. Failed calls with revert data bubble it unchanged; every other failure
     * reverts with TransferFailed, including false, short, or malformed return data.
     * @param from Address paying USDC.
     * @param to Address receiving USDC.
     * @param amount Amount in the token's smallest units.
     */
    function _safeTransferFrom(address from, address to, uint256 amount) private {
        (bool success, bytes memory returnData) = address(usdc).call(
            abi.encodeWithSelector(ITrustPayUSDC.transferFrom.selector, from, to, amount)
        );
        if (!success) {
            if (returnData.length != 0) {
                assembly ("memory-safe") {
                    revert(add(returnData, 32), mload(returnData))
                }
            }
            revert TransferFailed(from, to, amount);
        }
        if (returnData.length == 0) return;
        if (returnData.length < 32) revert TransferFailed(from, to, amount);

        uint256 result;
        assembly ("memory-safe") {
            result := mload(add(returnData, 32))
        }
        if (result != 1) revert TransferFailed(from, to, amount);
    }
}
