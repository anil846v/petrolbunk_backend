const sequelize = require('../config/database');

const User = require('./User');
const Category = require('./Category');
const Vendor = require('./Vendor');
const Loan = require('./Loan');
const Transaction = require('./Transaction');
const DailyDaybook = require('./DailyDaybook');

// ── Daily Daybook associations ──────────────────────────────────────────
User.hasMany(DailyDaybook, { foreignKey: 'created_by', as: 'dailyDaybooks', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
DailyDaybook.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
DailyDaybook.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// ── Transaction associations ────────────────────────────────────────────
Category.hasMany(Transaction, { foreignKey: 'category_id', as: 'transactions', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Transaction.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Vendor.hasMany(Transaction, { foreignKey: 'vendor_id', as: 'transactions', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Transaction.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Transaction, { foreignKey: 'created_by', as: 'createdTransactions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.hasMany(Transaction, { foreignKey: 'updated_by', as: 'updatedTransactions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// ── Loan associations ───────────────────────────────────────────────────
Vendor.hasMany(Loan, { foreignKey: 'vendor_id', as: 'loans', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Loan.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Loan, { foreignKey: 'created_by', as: 'loans', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Loan.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Single unified transaction relationship for loans
Loan.hasMany(Transaction, { foreignKey: 'reference_id', constraints: false, scope: { reference_type: 'LOAN' }, as: 'transactions' });
Transaction.belongsTo(Loan, { foreignKey: 'reference_id', constraints: false, as: 'loan' });

module.exports = {
  sequelize,
  User,
  Category,
  Vendor,
  Loan,
  Transaction,
  DailyDaybook,
};
