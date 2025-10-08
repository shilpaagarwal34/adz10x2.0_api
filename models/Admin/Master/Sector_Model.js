const { DataTypes } = require('sequelize');

const sequelize = require('@config/db');

const Sector = sequelize.define('Sector', {
     id: {
          type:DataTypes.INTEGER,
          primaryKey:true,
          autoIncrement:true
     },
     sector_name: {
          type:DataTypes.STRING,
          allowNull:false
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
     tableName: 'sectors'
});

module.exports = Sector;