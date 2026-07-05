require('dotenv').config();
const app = require('./src/app');
const sequelize = require('./src/config/database');

const PORT = process.env.PORT || 3000;

// Test database connection and start server
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    // alter:false — only creates tables that don't exist, never modifies existing ones
    await sequelize.sync({ alter: false });
    console.log('✓ Database synchronized');

    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
