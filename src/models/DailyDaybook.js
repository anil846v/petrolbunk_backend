const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DailyDaybook = sequelize.define('DailyDaybook', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  entry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    unique: true,
  },

  /* ── 1. Petrol (MS) ── */
  ms_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 104.50,
  },
  ms_open: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  ms_close: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  ms_sold: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  ms_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  ms_dip_open: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  ms_dip_close: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  ms_dip_diff: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  ms_margin: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 3.50,
  },

  /* ── 2. Diesel (HSD) ── */
  hsd_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 91.20,
  },
  hsd_open: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  hsd_close: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  hsd_sold: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  hsd_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  hsd_dip_open: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  hsd_dip_close: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  hsd_dip_diff: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0,
  },
  hsd_margin: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 3.00,
  },

  /* ── 3. Revenue & Collections ── */
  total_sales: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  cash_collected: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  upi_collected: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  card_collected: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  credit_collected: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  total_collected: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  short_excess: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  total_margin: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },

  /* ── 4. Embedded Daily Expenses ── */
  expenses: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  day_expenses: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  net_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },
  net_profit: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0,
  },

  /* ── 5. Notes & Audit ── */
  notes: {
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
  tableName: 'daily_daybook',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  indexes: [
    { name: 'idx_daybook_entry_date', unique: true, fields: ['entry_date'] },
    { name: 'idx_daybook_created_by', fields: ['created_by'] },
  ],
});

module.exports = DailyDaybook;
