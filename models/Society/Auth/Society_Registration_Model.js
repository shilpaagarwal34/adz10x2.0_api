const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Society_Registration = sequelize.define('SocietyRegistration', {
     id: { 
         type: DataTypes.INTEGER,
         autoIncrement:true,
         primaryKey:true
     },
      id_prifix_society: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     society_name: {
         type: DataTypes.TEXT,
         allowNull:false,
         validate: { notEmpty: true },
     },
     society_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
   },
     user_type: {
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue: null,
        validate: { notEmpty: true },
     },
     name: {
         type: DataTypes.STRING,
         allowNull: false,
         validate: { notEmpty: true },
     },
     email: {
          type: DataTypes.STRING,
          allowNull:false,
          validate: { notEmpty: true, isEmail: true },
      },
      password: { 
          type: DataTypes.TEXT,  // Store hashed password
          allowNull: false,
        //   validate: { notEmpty: true },
      },
      token: { 
          type: DataTypes.TEXT, // Store authentication token
          allowNull: true,
      },
      mobile_number: {
          type: DataTypes.STRING,
          allowNull: false,
        //   validate: { notEmpty: true, isNumeric:true },
      },
      otp: {
        type: DataTypes.INTEGER,
        allowNull:true
      },
      is_otp_verified: {
        type:DataTypes.ENUM('0','1'),
        defaultValue:'0'
      },
       society_wallet_amount:{
        type:DataTypes.FLOAT,
        allowNull:true
      },
      city_id: {
          type: DataTypes.INTEGER,
          allowNull:false,
          validate: { notEmpty: true },
      },
      area_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: { notEmpty: true },
      },
      pincode: {
          type: DataTypes.INTEGER,
          allowNull:false,
          validate: { notEmpty: true, isNumeric: true },
      },
      address: {
          type: DataTypes.TEXT,
          allowNull: true,
        //   validate: { notEmpty: true },
      },
      latitude: {
          type: DataTypes.DECIMAL,
          allowNull: true,
      },
      longitude: {
          type: DataTypes.DECIMAL,
          allowNull: true,
      },
      society_profile_img_path: {
          type: DataTypes.TEXT,
          allowNull:true,
      },
      society_profile_img_name: {
          type: DataTypes.TEXT,
          allowNull:true,
      },
      relationship_manager_id: {
          type: DataTypes.INTEGER,
          allowNull: true,
      },
      account_status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected','completed'),
          defaultValue: 'pending',
      },
      amount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
          validate: { notEmpty: true },
      },
      kyc_status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected','completed'),
          defaultValue: 'pending',
       },
       aggrement_copy_path: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      aggrement_copy_name:{
            type: DataTypes.TEXT,
            allowNull:true
      },
      society_commission:{
        type:DataTypes.STRING,
        allowNull:true
      },
      society_brand_promotion:{
        type:DataTypes.INTEGER,
        allowNull:true
      },
      society_lead_generation:{
         type:DataTypes.INTEGER,
         allowNull:true
      },
      society_survey:{
         type:DataTypes.INTEGER,
         allowNull:true
      },
       remark:{
         type:DataTypes.TEXT,
         allowNull:true
      },
      is_agree_terms_condition: {
          type: DataTypes.BOOLEAN, 
          defaultValue: false,
      },
      approved_by: {
          type: DataTypes.BIGINT,
          allowNull: true,
     },
     rejected_by: {
          type: DataTypes.BIGINT,
          allowNull: true,
     },
     approved_reject_date_time: {
          type: DataTypes.DATE,
          allowNull: true,
     },
     allow_edit:{
          type: DataTypes.BOOLEAN,
          allowNull:true,
          defaultValue:true
      },
     login_date_time:{
          type: DataTypes.DATE,
          allowNull:true
     },
     logout_date_time:{
          type:DataTypes.DATE,
          allowNull:true
     },
     created_ip_address: {
         type: DataTypes.STRING,
         allowNull: true,
     },
     modified_ip_address: {
         type: DataTypes.STRING,
         allowNull: true,
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
     },
 }, {
     timestamps: true,
     tableName: 'society_registration',
 });

module.exports = Society_Registration;
