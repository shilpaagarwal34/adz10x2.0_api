const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Company_Profile = sequelize.define('CompanyProfile', {
     id: {
         type: DataTypes.INTEGER,
         autoIncrement: true,
         primaryKey: true
     },
     company_id: {
         type: DataTypes.INTEGER,
         allowNull: false
     },
     company_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
   },
     website: {
          type: DataTypes.TEXT,
          allowNull:true,
     },
     company_email_id: {
         type: DataTypes.STRING,
         allowNull: true,
     },
     company_mobile_number: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      account_holder_name: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      bank_name: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      account_no: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      branch_name: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      bank_ifsc_code: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      billing_address_line_1: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      billing_address_line_2: {
          type: DataTypes.TEXT,
          allowNull: true
      },
     pan_card_path: {
         type: DataTypes.STRING,
         allowNull: true
     },
     pan_card_name: {
         type: DataTypes.STRING,
         allowNull: true
     },
     gst_certificate_path: {
         type: DataTypes.STRING,
         allowNull: true
     },
     gst_certificate_name: {
         type: DataTypes.STRING,
         allowNull: true
     },
     other_document_path: {
         type: DataTypes.STRING,
         allowNull: true
     },
     other_document_name: {
         type: DataTypes.STRING,
         allowNull: true
     },
     party_name : {
        type: DataTypes.TEXT,
        allowNull: true
     },
     gst_number:{
        type: DataTypes.TEXT,
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
     tableName: 'company_profile',
 });
 
 module.exports = Company_Profile;