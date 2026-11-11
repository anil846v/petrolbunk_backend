const sequelize = require('../src/config/database');

async function runMigration() {
  try {
    const [columns] = await sequelize.query("SHOW COLUMNS FROM users LIKE 'profile_image'");
    if (columns.length === 0) {
      await sequelize.query("ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NULL AFTER role");
      console.log('✅ Column profile_image added successfully to users table.');
    } else {
      console.log('ℹ️ Column profile_image already exists in users table.');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

runMigration();
