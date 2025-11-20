const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME || 'new-nodejs',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
    }
);

sequelize
    .authenticate()
    .then(() => console.log('MySQL connected...'))
    .catch((err) => console.error('Connection error:', err));

module.exports = sequelize;
