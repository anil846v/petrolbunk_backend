const { sequelize, Category, Vendor, DailyDaybook, Transaction } = require('../src/models');
const dailyDaybookService = require('../src/services/dailyDaybookService');
const transactionService = require('../src/services/transactionService');

async function seed() {
  console.log('--- Starting October 2026 Test Data Dump ---');

  // Verify categories and vendors
  const driverBathaCat = await Category.findOne({ where: { name: 'Driver Batha' } });
  const electricityCat = await Category.findOne({ where: { name: 'Electricity' } });
  const salaryCat = await Category.findOne({ where: { name: 'Salaries' } });
  const lubeCat = await Category.findOne({ where: { name: 'Lubricants & Engine Oil' } });

  const sureshVendor = await Vendor.findOne({ where: { name: 'Suresh' } });
  const vinayVendor = await Vendor.findOne({ where: { name: 'Vinay Transportation' } });

  let msOpen = 10000.00;
  let hsdOpen = 25000.00;

  // Loop through 31 days of October 2026
  for (let day = 1; day <= 31; day++) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `2026-10-${dayStr}`;

    // Mid-month price revision on Oct 16 to test rate variation handling
    const isPostRevision = day >= 16;
    const msPrice = isPostRevision ? 105.10 : 104.50;
    const msMargin = isPostRevision ? 3.60 : 3.50;
    const hsdPrice = isPostRevision ? 91.80 : 91.20;
    const hsdMargin = isPostRevision ? 3.05 : 3.00;

    // Realistic daily sales volumes
    // Weekends (e.g. day % 7 === 3 or 4) slightly higher
    const isWeekend = (day % 7 === 3 || day % 7 === 4);
    const msSold = parseFloat((isWeekend ? 650 + (day * 3 % 80) : 480 + (day * 5 % 90)).toFixed(2));
    const hsdSold = parseFloat((isWeekend ? 1450 + (day * 7 % 150) : 1100 + (day * 11 % 200)).toFixed(2));

    const msClose = parseFloat((msOpen + msSold).toFixed(2));
    const hsdClose = parseFloat((hsdOpen + hsdSold).toFixed(2));

    const msAmt = parseFloat((msSold * msPrice).toFixed(2));
    const hsdAmt = parseFloat((hsdSold * hsdPrice).toFixed(2));
    const totalSales = parseFloat((msAmt + hsdAmt).toFixed(2));

    // Dip simulation
    const msDipOpen = parseFloat((175 - (day * 0.8 % 15)).toFixed(1));
    const msDipClose = parseFloat((msDipOpen - (msSold / 50)).toFixed(1));
    const hsdDipOpen = parseFloat((230 - (day * 1.2 % 20)).toFixed(1));
    const hsdDipClose = parseFloat((hsdDipOpen - (hsdSold / 40)).toFixed(1));

    // Shift petty expenses
    const shiftExpenses = [
      {
        id: Date.now() + Math.random(),
        to: 'Suresh',
        amt: 300,
        cat: 'Driver Batha',
        desc: 'Shift driver batha',
        category_id: driverBathaCat ? driverBathaCat.id : null,
        vendor_id: sureshVendor ? sureshVendor.id : null,
      }
    ];

    if (day % 3 === 0) {
      shiftExpenses.push({
        id: Date.now() + Math.random() + 1,
        to: 'Electricity Board',
        amt: 450,
        cat: 'Electricity',
        desc: 'Station generator fuel & power',
        category_id: electricityCat ? electricityCat.id : null,
        vendor_id: null,
      });
    }

    const totalExp = shiftExpenses.reduce((sum, e) => sum + e.amt, 0);

    // Realistic collection breakdown
    // Day 10 has a small -₹50 variance, other days match 100%
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
      notes: `Shift logged for ${date}. Weather clear.`,
    };

    await dailyDaybookService.saveDay(shiftData, 1);
    process.stdout.write(`Day ${dayStr}/31 logged (Sales: ₹${totalSales}, Litres: ${(msSold + hsdSold).toFixed(0)}L)\r`);

    // Next day opens at this day's closing
    msOpen = msClose;
    hsdOpen = hsdClose;
  }

  console.log('\n--- 31 Days of Daily Shifts Logged Successfully! ---');

  // Insert non-shift Day Book transactions across October
  console.log('--- Seeding Day Book Non-Fuel Transactions ---');

  if (lubeCat) {
    const lubeEntries = [
      { date: '2026-10-05', amt: 2200, desc: 'Sold 4T 20W40 5L Bucket' },
      { date: '2026-10-12', amt: 3600, desc: 'Sold Servo Superfleet 15W40 10L' },
      { date: '2026-10-19', amt: 4800, desc: 'Sold Gear Oil & Grease cans' },
      { date: '2026-10-26', amt: 5500, desc: 'Sold Bulk Coolant & 2T Oil Packs' },
    ];
    for (const le of lubeEntries) {
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
    console.log(`✓ Added ${lubeEntries.length} Lubricant sales income records`);
  }

  if (vinayVendor && electricityCat) {
    await transactionService.create({
      transaction_date: '2026-10-15',
      category_id: electricityCat.id,
      vendor_id: vinayVendor.id,
      amount: 4200.00,
      payment_mode: 'BANK',
      reference_type: 'MANUAL',
      description: 'Tanker decanting freight charges',
    }, 1);
    console.log('✓ Added Vendor Payment to Vinay Transportation');
  }

  if (salaryCat && sureshVendor) {
    await transactionService.create({
      transaction_date: '2026-10-31',
      category_id: salaryCat.id,
      vendor_id: sureshVendor.id,
      amount: 15000.00,
      payment_mode: 'BANK',
      reference_type: 'MANUAL',
      description: 'Monthly Staff Salary - Suresh (Forecourt Supervisor)',
    }, 1);
    console.log('✓ Added Monthly Salary payout for staff');
  }

  console.log('=== All October 2026 Test Data Generated Successfully! ===');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
