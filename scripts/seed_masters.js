const { Category, Vendor, Loan, Transaction, User } = require('../src/models');
const sequelize = require('../src/config/database');

const runSeed = async () => {
  try {
    console.log('--- Seeding Petrol Bunk Master Categories, Vendors & IOCL Loans ---');

    // 1. Categories
    const categoriesData = [
      // Expenses
      { name: 'Salaries & Wages', type: 'EXPENSE' },
      { name: 'Electricity & Power', type: 'EXPENSE' },
      { name: 'Land Rent', type: 'EXPENSE' },
      { name: 'Station Maintenance', type: 'EXPENSE' },
      { name: 'Transport & Freight', type: 'EXPENSE' },
      { name: 'Driver Batha', type: 'EXPENSE' },
      { name: 'Police / Govt', type: 'EXPENSE' },
      { name: 'IOCL / Company', type: 'EXPENSE' },
      { name: 'Office & Stationery', type: 'EXPENSE' },
      { name: 'Loan Repayment', type: 'EXPENSE' },
      { name: 'Other Expenses', type: 'EXPENSE' },

      // Income
      { name: 'Fuel Sales', type: 'INCOME' },
      { name: 'Lubricants & Engine Oil', type: 'INCOME' },
      { name: 'Air & Nitrogen Machine', type: 'INCOME' },
      { name: 'Scrap & Empty Barrels', type: 'INCOME' },
      { name: 'Loan Disbursement', type: 'INCOME' },
    ];

    for (const cat of categoriesData) {
      await Category.findOrCreate({
        where: { name: cat.name, type: cat.type },
        defaults: { is_active: true },
      });
    }
    console.log(`✓ Categories seeded (${categoriesData.length} categories)`);

    // 2. Vendors
    const vendorsData = [
      { name: 'Indian Oil Corporation Ltd (IOCL)', type: 'SUPPLIER', phone: '1800-233-3555' },
      { name: 'APCPDCL Electricity', type: 'SERVICE_PROVIDER', phone: '1912' },
      { name: 'Gilbarco Veeder-Root Dispensers', type: 'SERVICE_PROVIDER', phone: '080-40001000' },
      { name: 'Vinay Transportation', type: 'SERVICE_PROVIDER', phone: '9848022334' },
      { name: 'Nataraj (Financier)', type: 'LOAN', phone: '9849112233' },
      { name: 'Manoja (Partner)', type: 'LOAN', phone: '9440123456' },
      { name: 'Ganga (Proprietor)', type: 'LOAN', phone: '9900112233' },
      { name: 'Suresh (Senior Pump Attendant)', type: 'EMPLOYEE', phone: '8985112233' },
      { name: 'Naveen (Shift Supervisor)', type: 'EMPLOYEE', phone: '7799112233' },
      { name: 'Dairy Milk Fleet', type: 'CUSTOMER', phone: '9441223344' },
    ];

    const createdVendors = {};
    for (const v of vendorsData) {
      const [record] = await Vendor.findOrCreate({
        where: { name: v.name },
        defaults: { type: v.type, phone: v.phone, is_active: true },
      });
      createdVendors[v.name] = record;
    }
    console.log(`✓ Vendors seeded (${vendorsData.length} parties)`);

    // 3. User check
    const adminUser = await User.findOne({ where: { role: 'admin' } }) || await User.findOne();
    const adminId = adminUser ? adminUser.id : 1;

    // 4. Seed IOCL Corpus Fund Loan
    const ioclVendor = createdVendors['Indian Oil Corporation Ltd (IOCL)'];
    if (ioclVendor) {
      const [ioclLoan, loanCreated] = await Loan.findOrCreate({
        where: { vendor_id: ioclVendor.id, loan_type: 'TAKEN' },
        defaults: {
          principal_amount: 617378.90,
          interest_percent: 0,
          start_date: '2025-07-01',
          status: 'ACTIVE',
          notes: 'IOCL Dealership Corpus Fund & Equipment Finance Facility (Monthly auto-debit ₹24,583)',
          created_by: adminId,
        },
      });

      console.log(`✓ IOCL Corpus Fund Loan set up (ID: ${ioclLoan.id}, Principal: ₹6,17,378.90)`);

      // Seed monthly EMI repayments matching the SAP statement
      const loanCategory = await Category.findOne({ where: { name: 'Loan Repayment', type: 'EXPENSE' } }) 
        || await Category.findOne({ where: { type: 'EXPENSE' } });

      const emiDates = [
        { date: '2025-07-05', amt: 24583, month: '202507' },
        { date: '2025-08-05', amt: 24583, month: '202508' },
        { date: '2025-09-05', amt: 24583, month: '202509' },
        { date: '2025-10-05', amt: 24583, month: '202510' },
        { date: '2025-11-05', amt: 24583, month: '202511' },
      ];

      for (let i = 0; i < emiDates.length; i++) {
        const item = emiDates[i];
        const vchNo = `VCH-IOCL-CORPUS-${item.month}`;
        const [txn] = await Transaction.findOrCreate({
          where: { voucher_no: vchNo },
          defaults: {
            transaction_date: item.date,
            category_id: loanCategory.id,
            vendor_id: ioclVendor.id,
            amount: item.amt,
            payment_mode: 'BANK',
            reference_type: 'LOAN',
            reference_id: ioclLoan.id,
            description: `[REPAYMENT] EMI for Corpus Fund Month${item.month} (IOCL Auto-Debit)`,
            created_by: adminId,
          },
        });
      }
      console.log(`✓ Seeded 5 monthly IOCL Corpus EMIs (₹24,583/mo) into Day Book transactions table`);
    }

    // 5. Seed Nataraj Partner Loan
    const natarajVendor = createdVendors['Nataraj (Financier)'];
    if (natarajVendor) {
      const [natarajLoan] = await Loan.findOrCreate({
        where: { vendor_id: natarajVendor.id, loan_type: 'TAKEN' },
        defaults: {
          principal_amount: 450000.00,
          interest_percent: 0,
          start_date: '2025-04-24',
          status: 'ACTIVE',
          notes: 'Capital loan for initial station setup and fuel tanker deposit',
          created_by: adminId,
        },
      });
      console.log(`✓ Nataraj Partner Loan set up (ID: ${natarajLoan.id}, Principal: ₹4,50,000.00)`);
    }

    console.log('--- ALL MASTERS, CATEGORIES, VENDORS, AND IOCL LOANS SUCCESSFULLY SEEDED! ---');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

runSeed();

