const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Message = sequelize.define('Message', {
    conversationId: {
        type: DataTypes.STRING,
    },
    text: {
        type: DataTypes.TEXT,
    },
    sender: {
        type: DataTypes.STRING,
    },
    images: {
        type: DataTypes.TEXT,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'messages',
    timestamps: false,
});
module.exports = Message;
