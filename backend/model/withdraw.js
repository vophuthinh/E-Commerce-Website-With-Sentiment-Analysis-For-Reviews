const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Withdraw = sequelize.define("Withdraw", {
    seller: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: "Processing",
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: "withdraws",
    timestamps: false,
});

module.exports = Withdraw;
