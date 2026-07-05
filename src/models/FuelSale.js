const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FuelSale = sequelize.define('FuelSale', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  sale_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  fuel_type_id: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  opening_meter: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },

  closing_meter: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },

  // Generated column in MySQL (closing_meter - opening_meter). Read-only:
  // never assign this field, the DB computes and stores it automatically.
  litres_sold: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
    set() {
      throw new Error('litres_sold is a generated column and cannot be set manually');
    },
  },

  sales_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },

  commission_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },

  opening_dip: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },

  closing_dip: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: true,
  },

  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  created_by: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

}, {
  tableName: 'fuel_sales',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,

  indexes: [
    { name: 'uq_sale_day', unique: true, fields: ['sale_date', 'fuel_type_id'] },
    { name: 'idx_fuel_type', fields: ['fuel_type_id'] },
    { name: 'idx_created_by', fields: ['created_by'] },
  ],
});

module.exports = FuelSale;