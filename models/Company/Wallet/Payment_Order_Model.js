const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const PaymentOrder = sequelize.define('Payment_Order',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     razorpay_order_id: {
          type: DataTypes.TEXT,
          allowNull: false,
          unique: true
     },
     amount: {
          type: DataTypes.INTEGER,
          allowNull: false
     },
     currency: {
          type: DataTypes.STRING,
          defaultValue: 'INR'
     },
     entity: {
          type: DataTypes.STRING,
          allowNull:true
     },
     receipt: {
          type: DataTypes.STRING,
          allowNull: false
     },
     razorpay_order_status: {
          type: DataTypes.STRING,
          allowNull: true
     },
     amount_paid: {
          type: DataTypes.INTEGER,
          defaultValue: 0
     },
     amount_due: {
          type: DataTypes.INTEGER,
          defaultValue: 0
     },
     attempts: {
          type: DataTypes.INTEGER,
          defaultValue: 0
     },
     created_at_razorpay: {
      type: DataTypes.BIGINT 
     },
     offer_id: {
          type: DataTypes.TEXT,
          allowNull: true,
     },
     notes: {
          type: DataTypes.JSON,
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
     tableName:'payment_order_log'
});

module.exports = PaymentOrder;