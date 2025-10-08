const { DataTypes, ENUM } = require('sequelize');
const sequelize = require('@config/db');


const Notification  =  sequelize.define('Notification',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     admin_ids:{
          type:DataTypes.JSON,
          allowNull:true
     },
     society_ids:{
          type:DataTypes.JSON,
          allowNull:true
     },
     company_ids:{  
          type:DataTypes.JSON,
          allowNull:true
     },
     message:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     from:{
          type:DataTypes.STRING,
          allowNull:true
     },
     to:{
          type:DataTypes.STRING,
          allowNull:true
     },
     notify_type:{
          type:ENUM('all','individual'),
          allowNull:true
     },
     read_type:{
          type:DataTypes.ENUM('read','unread'),
          defaultValue:'unread',
     },
     types:{
          type:DataTypes.STRING,
          allowNull:true
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
},{
     timestamps:true,
     tableName:'notifications'
});

module.exports = Notification