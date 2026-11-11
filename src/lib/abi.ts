import { parseAbi, parseAbiItem } from 'viem'

export const trustPayAbi = parseAbi([
  'function usdc() view returns (address)',
  'function paymentCount() view returns (uint256)',
  'function MAX_NOTE_LENGTH() view returns (uint256)',
  'function pay(address recipient, uint256 amount, string note) returns (uint256 id)',
  'event PaymentSent(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount, string note)',
  'error InvalidToken(address token)',
  'error ZeroAddress()',
  'error InvalidRecipient(address recipient)',
  'error ZeroAmount()',
  'error NoteTooLong(uint256 length, uint256 maximum)',
])

export const paymentSentEvent = parseAbiItem(
  'event PaymentSent(uint256 indexed id, address indexed sender, address indexed recipient, uint256 amount, string note)',
)

export const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

/** Mirrors TrustPay.MAX_NOTE_LENGTH (bytes). The app also reads the live value from the contract. */
export const DEFAULT_MAX_NOTE_BYTES = 140
