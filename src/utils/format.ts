/**
 * Utility currency and score formatting for The Performance Gap
 */

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0k';
  const isNegative = amount < 0;
  const abs = Math.abs(amount);
  return `${isNegative ? '-' : ''}$${abs.toLocaleString()}k`;
}

export function formatDeltaCurrency(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || isNaN(delta)) return '$0k';
  if (delta > 0) return `+$${delta.toLocaleString()}k`;
  if (delta < 0) return `-$${Math.abs(delta).toLocaleString()}k`;
  return '$0k';
}
