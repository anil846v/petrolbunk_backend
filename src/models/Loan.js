const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Loan = sequelize.define('Loan', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  vendor_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  loan_type: {
    type: DataTypes.ENUM('GIVEN', 'TAKEN'),
    allowNull: false,
  },

  principal_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0.01,
    },
  },

  interest_percent: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0,
  },

  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  status: {
    type: DataTypes.ENUM('ACTIVE', 'CLOSED'),
    allowNull: false,
    defaultValue: 'ACTIVE',
  },

  created_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

}, {
  tableName: 'loans',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,

  indexes: [
    { name: 'idx_loan_vendor', fields: ['vendor_id'] },
    { name: 'idx_loan_status', fields: ['status'] },
    { name: 'idx_loan_type', fields: ['loan_type'] },
  ],
});

module.exports = Loan;