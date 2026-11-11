import { isAddress, isAddressEqual, zeroAddress, getAddress, type Address } from 'viem'
import { Amount } from '@/onchain-money'

const USDC_DECIMALS = 6

export interface RecipientCheck {
  address?: Address
  error?: string
}

export function checkRecipient(input: string, self: Address | undefined, blocked: { address: Address; reason: string }[]): RecipientCheck {
  const value = input.trim()
  if (!value) return {}
  if (!isAddress(value)) {
    return { error: 'Enter a valid wallet address starting with 0x (42 characters, checksum must match if mixed case).' }
  }
  const address = getAddress(value)
  if (isAddressEqual(address, zeroAddress)) return { error: 'The zero address cannot receive payments.' }
  if (self && isAddressEqual(address, self)) return { error: 'You cannot send a payment to your own wallet.' }
  for (const entry of blocked) {
    if (isAddressEqual(address, entry.address)) return { error: entry.reason }
  }
  return { address }
}

export interface AmountCheck {
  raw?: bigint
  error?: string
}

/** Parse a user-typed USDC amount (6-decimal ERC-20 view). Never rounds. */
export function checkAmount(input: string): AmountCheck {
  const value = input.trim()
  if (!value) return {}
  if (!/^\d*\.?\d*$/.test(value) || value === '.') return { error: 'Enter a number such as 12.50.' }
  try {
    const amount = Amount.parse(value, USDC_DECIMALS)
    if (amount.raw <= 0n) return { error: 'Amount must be greater than zero.' }
    return { raw: amount.raw }
  } catch {
    return { error: 'USDC supports up to 6 decimal places.' }
  }
}

/** Sanitize free typing in an amount field. */
export function sanitizeAmountInput(value: string): string | null {
  const cleaned = value.replace(/,/g, '.')
  return /^\d*\.?\d*$/.test(cleaned) ? cleaned : null
}
