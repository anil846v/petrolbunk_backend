const { sequelize, Category, Vendor, Loan, Transaction, DailyDaybook } = require('../src/models');
const dailyDaybookService = require('../src/services/dailyDaybookService');
const loanService = require('../src/services/loanService');
const loanTransactionService = require('../src/services/loanTransactionService');
const transactionService = require('../src/services/transactionService');

async function seed() {
  console.log('=== Starting Full 1-Month + 4 Loans (2 TAKEN, 2 GIVEN) Data Generation ===');

  // 1. Ensure Vendors
  const [ioclVendor] = await Vendor.findOrCreate({
    where: { name: 'Indian Oil Corporation Ltd' },
    defaults: { name: 'Indian Oil Corporation Ltd', type: 'SUPPLIER', phone: '18002333555' }
  });

  const [sbiVendor] = await Vendor.findOrCreate({
    where: { name: 'State Bank of India' },
    defaults: { name: 'State Bank of India', type: 'SUPPLIER', phone: '18001234' }
  });

  const [sureshVendor] = await Vendor.findOrCreate({
    where: { name: 'Suresh' },
    defaults: { name: 'Suresh', type: 'EMPLOYEE', phone: '9876543210' }
  });

  const [vinayVendor] = await Vendor.findOrCreate({
    where: { name: 'Vinay Transportation' },
    defaults: { name: 'Vinay Transportation', type: 'SERVICE_PROVIDER', phone: '9848022338' }
  });

  console.log('✓ 4 Vendors Verified (IOCL, SBI, Suresh, Vinay Transportation)');

  // 2. Ensure Categories
  const [bathaCat] = await Category.findOrCreate({
    where: { name: 'Driver Batha' },
    defaults: { name: 'Driver Batha', type: 'EXPENSE', is_active: true }
  });

  const [powerCat] = await Category.findOrCreate({
    where: { name: 'Electricity' },
    defaults: { name: 'Electricity', type: 'EXPENSE', is_active: true }
  });

  const [salaryCat] = await Category.findOrCreate({
    where: { name: 'Salaries' },
    defaults: { name: 'Salaries', type: 'EXPENSE', is_active: true }
  });

  const [lubeCat] = await Category.findOrCreate({
    where: { name: 'Lubricants & Engine Oil' },
    defaults: { name: 'Lubricants & Engine Oil', type: 'INCOME', is_active: true }
  });

  const [maintCat] = await Category.findOrCreate({
    where: { name: 'Maintenance & Spares' },
    defaults: { name: 'Maintenance & Spares', type: 'EXPENSE', is_active: true }
  });

  console.log('✓ Categories Verified');

  // 3. Clear existing loans and loan transactions to establish clean 4-loan set
  await Transaction.destroy({ where: { reference_type: 'LOAN' } });
  await Loan.destroy({ where: {} });

  // 4. Create the 4 Loans (2 TAKEN, 2 GIVEN)
  console.log('\n--- Setting up 4 Loans (2 TAKEN, 2 GIVEN) ---');

  // TAKEN 1: IOCL
  const loan1 = await Loan.create({
    vendor_id: ioclVendor.id,
    loan_type: 'TAKEN',
    principal_amount: 617378.00,
    interest_percent: 0,
    start_date: '2026-10-01',
    notes: 'IOCL Dealership Corpus Facility',
    created_by: 1
  });

  // TAKEN 2: State Bank of India
  const loan2 = await Loan.create({
    vendor_id: sbiVendor.id,
    loan_type: 'TAKEN',
    principal_amount: 300000.00,
    interest_percent: 8.5,
    start_date: '2026-10-01',
    notes: 'SBI Working Capital Term Loan',
    created_by: 1
  });

  // GIVEN 1: Suresh
  const loan3 = await Loan.create({
    vendor_id: sureshVendor.id,
    loan_type: 'GIVEN',
    principal_amount: 50000.00,
    interest_percent: 0,
    start_date: '2026-10-01',
    notes: 'Staff emergency medical advance given to Suresh',
    created_by: 1
  });

  // GIVEN 2: Vinay Transportation
  const loan4 = await Loan.create({
    vendor_id: vinayVendor.id,
    loan_type: 'GIVEN',
    principal_amount: 80000.00,
    interest_percent: 0,
    start_date: '2026-10-01',
    notes: 'Fleet fuel credit facility given to Vinay Transport',
    created_by: 1
  });

  console.log('✓ Loan 1 (TAKEN): Indian Oil Corporation Ltd — Principal ₹6,17,378.00');
  console.log('✓ Loan 2 (TAKEN): State Bank of India — Principal ₹3,00,000.00');
  console.log('✓ Loan 3 (GIVEN): Suresh — Principal ₹50,000.00');
  console.log('✓ Loan 4 (GIVEN): Vinay Transportation — Principal ₹80,000.00');

  // 5. Record Repayments for each of the 4 Loans in October
  console.log('\n--- Recording Repayment Transactions for all 4 Loans ---');

  // For Loan 1 (IOCL - TAKEN): EMI paid
  await loanTransactionService.create({
    loan_id: loan1.id,
    type: 'REPAYMENT',
    amount: 24583.00,
    payment_mode: 'BANK',
    transaction_date: '2026-10-05',
    remarks: 'Month 1 IOCL Corpus EMI auto-debit',
  }, 1);
  console.log('✓ Loan 1 Repayment: ₹24,583.00 (IOCL - TAKEN, Day Book EXPENSE)');

  // For Loan 2 (SBI - TAKEN): EMI paid
  await loanTransactionService.create({
    loan_id: loan2.id,
    type: 'REPAYMENT',
    amount: 12500.00,
    payment_mode: 'BANK',
    transaction_date: '2026-10-10',
    remarks: 'SBI Term Loan Monthly EMI',
  }, 1);
  console.log('✓ Loan 2 Repayment: ₹12,500.00 (SBI - TAKEN, Day Book EXPENSE)');

  // For Loan 3 (Suresh - GIVEN): Repayments collected
  await loanTransactionService.create({
    loan_id: loan3.id,
    type: 'REPAYMENT',
    amount: 10000.00,
    payment_mode: 'CASH',
    transaction_date: '2026-10-15',
    remarks: 'Suresh 1st installment cash repayment',
  }, 1);
  await loanTransactionService.create({
    loan_id: loan3.id,
    type: 'REPAYMENT',
    amount: 5000.00,
    payment_mode: 'CASH',
    transaction_date: '2026-10-28',
    remarks: 'Suresh 2nd installment cash repayment',
  }, 1);
  console.log('✓ Loan 3 Repayments: ₹10,000.00 + ₹5,000.00 = ₹15,000.00 (Suresh - GIVEN, Day Book INCOME)');

  // For Loan 4 (Vinay Transportation - GIVEN): Repayments collected
  await loanTransactionService.create({
    loan_id: loan4.id,
    type: 'REPAYMENT',
    amount: 20000.00,
    payment_mode: 'BANK',
    transaction_date: '2026-10-20',
    remarks: 'Vinay Transport fleet installment repayment',
  }, 1);
  await loanTransactionService.create({
    loan_id: loan4.id,
    type: 'REPAYMENT',
    amount: 15000.00,
    payment_mode: 'BANK',
    transaction_date: '2026-10-30',
    remarks: 'Vinay Transport fleet month-end settlement',
  }, 1);
  console.log('✓ Loan 4 Repayments: ₹20,000.00 + ₹15,000.00 = ₹35,000.00 (Vinay - GIVEN, Day Book INCOME)');

  // 6. Seed All 31 Days of Daily Shifts with Daily Expenses
  console.log('\n--- Seeding 31 Days of October Daily Shifts & Shift Expenses ---');

  let msOpen = 10000.00;
  let hsdOpen = 25000.00;

  for (let day = 1; day <= 31; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `2026-10-${dayStr}`;

    const isPostRevision = day >= 16;
    const msPrice = isPostRevision ? 105.10 : 104.50;
    const msMargin = isPostRevision ? 3.60 : 3.50;
    const hsdPrice = isPostRevision ? 91.80 : 91.20;
    const hsdMargin = isPostRevision ? 3.05 : 3.00;

    const isWeekend = (day % 7 === 3 || day % 7 === 4);
    const msSold = parseFloat((isWeekend ? 650 + (day * 3 % 80) : 480 + (day * 5 % 90)).toFixed(2));
    const hsdSold = parseFloat((isWeekend ? 1450 + (day * 7 % 150) : 1100 + (day * 11 % 200)).toFixed(2));

    const msClose = parseFloat((msOpen + msSold).toFixed(2));
    const hsdClose = parseFloat((hsdOpen + hsdSold).toFixed(2));

    const msAmt = parseFloat((msSold * msPrice).toFixed(2));
    const hsdAmt = parseFloat((hsdSold * hsdPrice).toFixed(2));
    const totalSales = parseFloat((msAmt + hsdAmt).toFixed(2));

    // Realistic dips
    const msDipOpen = parseFloat((175 - (day * 0.8 % 15)).toFixed(1));
    const msDipClose = parseFloat((msDipOpen - (msSold / 50)).toFixed(1));
    const hsdDipOpen = parseFloat((230 - (day * 1.2 % 20)).toFixed(1));
    const hsdDipClose = parseFloat((hsdDipOpen - (hsdSold / 40)).toFixed(1));

    // Shift petty cash expenses
    const shiftExpenses = [
      {
        id: Date.now() + Math.random(),
        to: 'Suresh',
        amt: 300,
        cat: 'Driver Batha',
        desc: 'Lorry driver batha',
        category_id: bathaCat.id,
        vendor_id: sureshVendor.id,
      }
    ];

    if (day % 2 === 0) {
      shiftExpenses.push({
        id: Date.now() + Math.random() + 1,
        to: 'Tea & Cleaning',
        amt: 150,
        cat: 'Maintenance & Spares',
        desc: 'Forecourt cleaning, soap & staff tea',
        category_id: maintCat.id,
        vendor_id: null,
      });
    }

    if (day % 4 === 0) {
      shiftExpenses.push({
        id: Date.now() + Math.random() + 2,
        to: 'Electricity / Generator',
        amt: 450,
        cat: 'Electricity',
        desc: 'Generator diesel top-up & power maintenance',
        category_id: powerCat.id,
        vendor_id: null,
      });
    }

    const variance = (day === 10) ? -50 : 0;
    const targetCollection = totalSales + variance;

    const cash = parseFloat((targetCollection * 0.52).toFixed(2));
    const upi = parseFloat((targetCollection * 0.32).toFixed(2));
    const card = parseFloat((targetCollection * 0.10).toFixed(2));
    const credit = parseFloat((targetCollection - (cash + upi + card)).toFixed(2));

    const shiftData = {
      entry_date: date,
      ms_price: msPrice,
      ms_margin: msMargin,
      ms_open: msOpen,
      ms_close: msClose,
      ms_dip_open: msDipOpen,
      ms_dip_close: msDipClose,

      hsd_price: hsdPrice,
      hsd_margin: hsdMargin,
      hsd_open: hsdOpen,
      hsd_close: hsdClose,
      hsd_dip_open: hsdDipOpen,
      hsd_dip_close: hsdDipClose,

      cash_collected: cash,
      upi_collected: upi,
      card_collected: card,
      credit_collected: credit,

      expenses: shiftExpenses,
      notes: `Daily shift logged for ${date}. All meters verified.`,
    };

    await dailyDaybookService.saveDay(shiftData, 1);
    process.stdout.write(`Day ${dayStr}/31 logged (Sales: ₹${totalSales}, Litres: ${(msSold + hsdSold).toFixed(0)}L)\r`);

    msOpen = msClose;
    hsdOpen = hsdClose;
  }

  console.log('\n✓ 31 Days of Daily Shifts Logged Successfully!');

  // 7. Non-Fuel Daybook Transactions
  console.log('\n--- Adding Monthly Non-Fuel Day Book Transactions ---');
  const lubeSales = [
    { date: '2026-10-04', amt: 2200, desc: 'Sold 4T 20W40 5L Bucket' },
    { date: '2026-10-11', amt: 3600, desc: 'Sold Servo Superfleet 15W40 10L' },
    { date: '2026-10-18', amt: 4800, desc: 'Sold Gear Oil & Grease cans' },
    { date: '2026-10-25', amt: 5500, desc: 'Sold Bulk Coolant & 2T Oil Packs' },
  ];

  for (const le of lubeSales) {
    await transactionService.create({
      transaction_date: le.date,
      category_id: lubeCat.id,
      vendor_id: null,
      amount: le.amt,
      payment_mode: 'CASH',
      reference_type: 'MANUAL',
      description: le.desc,
    }, 1);
  }
  console.log(`✓ Added ${lubeSales.length} Lubricant sales records`);

  // Staff Monthly Salary payout
  await transactionService.create({
    transaction_date: '2026-10-31',
    category_id: salaryCat.id,
    vendor_id: sureshVendor.id,
    amount: 15000.00,
    payment_mode: 'BANK',
    reference_type: 'MANUAL',
    description: 'Monthly Staff Salary - Suresh (Forecourt Supervisor)',
  }, 1);
  console.log('✓ Added Monthly Forecourt Salary payment');

  console.log('\n=== Full Dataset Successfully Generated! ===');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});

