const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vendor = sequelize.define('Vendor', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },

  type: {
    type: DataTypes.ENUM('CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'LOAN', 'OTHER', 'SERVICE_PROVIDER'),
    allowNull: false,
    defaultValue: 'OTHER',
  },

  phone: {
    type: DataTypes.STRING(15),
    allowNull: true,
  },

  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },

  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  gst: {
    type: DataTypes.STRING(15),
    allowNull: true,
    unique: true,
  },

  bank_name: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },

  account_no: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },

  ifsc_code: {
    type: DataTypes.STRING(11),
    allowNull: true,
  },

  phonepe: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },

  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

}, {
  tableName: 'vendors',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  indexes: [
    { name: 'uq_vendor_name_phone', unique: true, fields: ['name', 'phone'] },
    { name: 'idx_vendor_type', fields: ['type'] },
    { name: 'idx_vendor_phone', fields: ['phone'] },
    { name: 'idx_vendor_active', fields: ['is_active'] },
  ],
});

module.exports = Vendor;