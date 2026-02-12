const { Sequelize } = require('sequelize');

if (process.env.NODE_ENV !== 'PRODUCTION') {
    require('dotenv').config({
        path: 'config/.env',
    });
}

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

// Only export the instance — authentication is handled in server.js
module.exports = sequelize;
