const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoanTransaction = sequelize.define('LoanTransaction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  loan_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  type: {
    type: DataTypes.ENUM('DISBURSEMENT', 'REPAYMENT'),
    allowNull: false,
  },

  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0.01,
    },
  },

  payment_mode: {
    type: DataTypes.ENUM('CASH', 'BANK', 'UPI'),
    allowNull: false,
    defaultValue: 'CASH',
  },

  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

}, {
  tableName: 'loan_transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,

  indexes: [
    { name: 'idx_loantxn_loan', fields: ['loan_id'] },
    { name: 'idx_loantxn_date', fields: ['transaction_date'] },
    { name: 'idx_loantxn_type', fields: ['type'] },
  ],
});

module.exports = LoanTransaction;