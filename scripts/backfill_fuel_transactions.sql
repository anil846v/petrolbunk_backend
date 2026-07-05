-- Backfill Script: Create Day Book entries for existing Fuel Sales
-- This script creates missing transaction entries for fuel sales that don't have them
-- Run this against your MySQL database

-- Step 1: Ensure "Fuel Sales" category exists
INSERT INTO categories (name, type, is_active, created_at, updated_at)
SELECT 'Fuel Sales', 'INCOME', 1, NOW(), NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM categories WHERE name = 'Fuel Sales' AND type = 'INCOME'
);

-- Step 2: Get the category ID
SET @fuel_category_id = (SELECT id FROM categories WHERE name = 'Fuel Sales' AND type = 'INCOME' LIMIT 1);

-- Step 3: Find the max existing voucher number to generate new ones
SET @max_voucher = (SELECT CAST(SUBSTRING(voucher_no, 4) AS UNSIGNED) FROM transactions ORDER BY id DESC LIMIT 1);
SET @max_voucher = IFNULL(@max_voucher, 0);

-- Step 4: Create missing transaction entries for fuel sales
-- This creates transactions for fuel sales that don't have corresponding entries
-- IMPORTANT: Only commission is recorded as income, not sales amount
INSERT INTO transactions (
    voucher_no,
    transaction_date,
    category_id,
    vendor_id,
    amount,
    payment_mode,
    reference_type,
    reference_id,
    description,
    created_at,
    updated_at
)
SELECT
    CONCAT('TXN-', @max_voucher + ROW_NUMBER() OVER (ORDER BY fs.id)) as voucher_no,
    fs.sale_date as transaction_date,
    @fuel_category_id as category_id,
    NULL as vendor_id,
    fs.commission_amount as amount,
    'CASH' as payment_mode,
    'FUEL' as reference_type,
    fs.id as reference_id,
    CONCAT('Fuel commission — ', ft.fuel_type) as description,
    NOW() as created_at,
    NOW() as updated_at
FROM fuel_sales fs
JOIN fuel_types ft ON ft.id = fs.fuel_type_id
LEFT JOIN transactions t ON t.reference_type = 'FUEL' AND t.reference_id = fs.id
WHERE t.id IS NULL
  AND fs.commission_amount > 0;

-- Step 5: Verify the results
SELECT 
    'Fuel Sales without transactions' as status,
    COUNT(*) as count
FROM fuel_sales fs
LEFT JOIN transactions t ON t.reference_type = 'FUEL' AND t.reference_id = fs.id
WHERE t.id IS NULL;

SELECT 
    'Fuel Sales with transactions created' as status,
    COUNT(*) as count
FROM fuel_sales fs
JOIN transactions t ON t.reference_type = 'FUEL' AND t.reference_id = fs.id
WHERE t.id IS NOT NULL;

-- Step 6: Show sample of created transactions
SELECT 
    t.id,
    t.voucher_no,
    t.transaction_date,
    t.amount,
    t.reference_type,
    fs.sale_date,
    ft.fuel_type
FROM transactions t
JOIN fuel_sales fs ON fs.id = t.reference_id
JOIN fuel_types ft ON ft.id = fs.fuel_type_id
WHERE t.reference_type = 'FUEL'
ORDER BY t.id DESC
LIMIT 10;
