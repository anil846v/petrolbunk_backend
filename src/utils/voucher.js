/**
 * Voucher number generation.
 * Strategy: create the row first (get the DB-assigned id), then update
 * voucher_no using that id. This is race-condition-free and human-readable.
 *
 * Format: TXN-YYYYMMDD-000001
 */
const generateVoucherNo = (id) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TXN-${date}-${String(id).padStart(6, '0')}`;
};

module.exports = { generateVoucherNo };
