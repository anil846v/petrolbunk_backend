const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FuelType = sequelize.define('FuelType', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  fuel_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },

  code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },

  price_per_litre: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    validate: {
      min: 0,
    },
  },

  commission_type: {
    type: DataTypes.ENUM('AMOUNT', 'PERCENT'),
    allowNull: true,
  },

  commission_value: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },

  from_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },

  to_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

}, {
  tableName: 'fuel_types',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  indexes: [
    { name: 'uq_fuel_period', unique: true, fields: ['fuel_type', 'from_date'] },
    { name: 'idx_fuel_active', fields: ['is_active'] },
    { name: 'idx_fuel_date', fields: ['from_date', 'to_date'] },
  ],
});

module.exports = FuelType;