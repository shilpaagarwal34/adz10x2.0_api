const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Ads_Slot = sequelize.define('Ads Slot', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    society_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    society_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    days: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_checked: {
        type: DataTypes.BOOLEAN
    },
    from_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    to_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    created_ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    modified_ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_type: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    modified_type: {
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
    status: {
        type: DataTypes.ENUM('active', 'delete', 'inactive'),
        defaultValue: 'active',
    }
}, {
    timestamps: true,
    tableName: 'society_ads_slot_log'
});

module.exports = Ads_Slot;