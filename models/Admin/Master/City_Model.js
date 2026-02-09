
const { DataTypes } = require('sequelize');
const sequelize = require('@config/db')

const City = sequelize.define('City', {
    id: { 
        type: DataTypes.INTEGER,
        autoIncrement:true,
        primaryKey:true
    },
    city_name: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
            notEmpty: true,
        },
    },
    created_ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    modified_ip_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    modified_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    created_type: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    modified_type: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('active', 'delete', 'inactive'),
        defaultValue: 'active',
    },
}, {
    timestamps: true,
    tableName: 'city',
});

module.exports = City;
