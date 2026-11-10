const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  voucher_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },

  transaction_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  category_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  vendor_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
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
  },

  reference_type: {
    type: DataTypes.ENUM('FUEL', 'LOAN', 'MANUAL', 'SHIFT_EXPENSE'),
    allowNull: false,
    defaultValue: 'MANUAL',
  },

  reference_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  created_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  updated_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  indexes: [
    { name: 'idx_transactions_date', fields: ['transaction_date'] },
    { name: 'idx_transactions_category', fields: ['category_id'] },
    { name: 'idx_transactions_vendor', fields: ['vendor_id'] },
    { name: 'idx_transactions_voucher', unique: true, fields: ['voucher_no'] },
    { name: 'idx_transactions_ref', fields: ['reference_type', 'reference_id'] },
  ],
});

module.exports = Transaction;
