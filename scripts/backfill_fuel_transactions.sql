follow protype 1 so
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
