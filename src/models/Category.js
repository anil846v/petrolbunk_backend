const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },

  type: {
    type: DataTypes.ENUM('EXPENSE', 'INCOME'),
    allowNull: false,
  },

  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },

}, {
  tableName: 'categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',

  indexes: [
    { name: 'uq_category_name_type', unique: true, fields: ['name', 'type'] },
    { name: 'idx_category_type', fields: ['type'] },
    { name: 'idx_category_active', fields: ['is_active'] },
  ],
});

module.exports = Category;