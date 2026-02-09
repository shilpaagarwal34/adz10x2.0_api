const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Wallet = sequelize.define('Wallet',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     company_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     
     company_user_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     wallet_type:{
          type:DataTypes.STRING,
          allowNull:true
     },
     description:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     amount:{
          type: DataTypes.FLOAT,
          allowNull: true,
     },
     total_amount:{
          type:  DataTypes.FLOAT,
          allowNull: true
     },
     gst_percentage:{
          type: DataTypes.FLOAT,
          allowNull:true
     },
     gst_amount:{
          type: DataTypes.FLOAT,
          allowNull: true,
     },
     balance:{
          type: DataTypes.FLOAT,
          allowNull:true
     },
     invoice_id:{
          type: DataTypes.TEXT,
          allowNull:true
     },
     order_id: {
          type: DataTypes.TEXT,
          allowNull: true,
     },
     razorpay_order_id: {
               type: DataTypes.TEXT,
               allowNull: true,
     },
     razorpay_payment_id: {
          type: DataTypes.TEXT,
          allowNull: true,
     },
     transaction_id:{
          type: DataTypes.TEXT,
          allowNull:true
     },
     invoice_url_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     payment_status: {
          type: DataTypes.ENUM('approved', 'pending', 'reject'),
          defaultValue: 'pending',
     },
     refund_status:{
          type: DataTypes.STRING,
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
     tableName:'company_wallet_payment_log'
});

module.exports = Wallet;