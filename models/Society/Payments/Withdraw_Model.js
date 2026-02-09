const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Withdraw = sequelize.define('Withdraw',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     society_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     society_user_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     company_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     company_user_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     withdraw_amount:{
          type: DataTypes.FLOAT,
          allowNull: true,
     },
     invoice_id:{
          type: DataTypes.TEXT,
          allowNull:true
     },
     transaction_id:{
          type: DataTypes.TEXT,
          allowNull:true
     },
     upload_report_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     upload_report_name:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     transaction_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     transaction_name:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     wallet_type:{
          type:DataTypes.STRING,
          allowNull:true
     },
     description:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     remark:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     payment_status: {
          type: DataTypes.ENUM('approved', 'pending', 'reject'),
          defaultValue: 'pending',
     },
     with_gst:{
          type: DataTypes.BOOLEAN,
          allowNull:true
     },
     paid_date: {
          type: DataTypes.DATE,
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
},{
     timestamps:true,
     tableName:'society_withdraw_payments'
});

module.exports = Withdraw;