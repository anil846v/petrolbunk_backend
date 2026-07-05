const sequelize = require('../config/database');

const User = require('./User');
const Category = require('./Category');
const Vendor = require('./Vendor');
const FuelType = require('./FuelType');
const FuelSale = require('./FuelSale');
const Loan = require('./Loan');
const LoanTransaction = require('./LoanTransaction');
const Transaction = require('./Transaction');

// ── Transaction associations ────────────────────────────────────────────
Category.hasMany(Transaction, { foreignKey: 'category_id', as: 'transactions', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Transaction.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Vendor.hasMany(Transaction, { foreignKey: 'vendor_id', as: 'transactions', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Transaction.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Transaction, { foreignKey: 'created_by', as: 'createdTransactions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.hasMany(Transaction, { foreignKey: 'updated_by', as: 'updatedTransactions', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

// ── Fuel associations ───────────────────────────────────────────────────
FuelType.hasMany(FuelSale, { foreignKey: 'fuel_type_id', as: 'sales', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
FuelSale.belongsTo(FuelType, { foreignKey: 'fuel_type_id', as: 'fuelType' });

User.hasMany(FuelSale, { foreignKey: 'created_by', as: 'fuelSales', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
FuelSale.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ── Loan associations ───────────────────────────────────────────────────
Vendor.hasMany(Loan, { foreignKey: 'vendor_id', as: 'loans', onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
Loan.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });

User.hasMany(Loan, { foreignKey: 'created_by', as: 'loans', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
Loan.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

Loan.hasMany(LoanTransaction, { foreignKey: 'loan_id', as: 'loanTransactions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
LoanTransaction.belongsTo(Loan, { foreignKey: 'loan_id', as: 'loan' });

module.exports = {
  sequelize,
  User,
  Category,
  Vendor,
  FuelType,
  FuelSale,
  Loan,
  LoanTransaction,
  Transaction,
};