const { DataTypes } = require("sequelize");
const sequelize = require("@config/db");

const Company_Registration = sequelize.define('Company_Registration', {
     id:{
          type: DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
      id_prifix_company: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     company_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
   },
     user_type:{
          type: DataTypes.STRING,
          allowNulll: false
     },
     company_name: {
          type: DataTypes.STRING,
          allowNull:false,
          validate: { notEmpty:true}
     },
     company_brand_name:{
          type: DataTypes.TEXT,
          allowNull:true,
        //   validate: { notEmpty:true },
     },
     company_profile_photo_path:{
          type:DataTypes.STRING,
          allowNull:true
     },
     company_profile_photo_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     name:{
          type:DataTypes.STRING,
          allowNull:false,
     },
     email:{
          type:DataTypes.STRING,
          allowNull:false
     },
     password:{
          type:DataTypes.TEXT,
          allowNull:false
     },
     token: { 
          type: DataTypes.TEXT, // Store authentication token
          allowNull: true,
      },
      mobile_number: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      otp: {
        type: DataTypes.INTEGER,
        allowNull:true
      },
      is_otp_verified: {
        type:DataTypes.ENUM('0','1'),
        defaultValue:'0'
      },
      wallet_amount:{
        type:DataTypes.STRING,
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
      address_line_1: {
          type: DataTypes.TEXT,
          allowNull: false,
          validate: { notEmpty: true },
      },
      address_line_2: {
          type: DataTypes.TEXT,
         allowNull:true,
      },
      sector:{
          type:DataTypes.STRING,
          allowNull:true,
      },
      account_status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected','completed'),
          defaultValue: 'pending',
      },
      kyc_status: {
          type: DataTypes.ENUM('pending', 'approved', 'rejected','completed'),
          defaultValue: 'pending',
       },
       company_aggrement_copy_path: {
          type: DataTypes.TEXT,
          allowNull: true,
      },
      company_aggrement_copy_name: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
      is_agree_terms_condition: {
          type: DataTypes.BOOLEAN, 
          defaultValue: false,
       },
       relationship_manager_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    //    reletionship_manager_id: {
    //       type: DataTypes.INTEGER,
    //       allowNull: true,
    //   },
      brand_promotion:{
        type:DataTypes.STRING,
        allowNull:true
      },
      lead_generation:{
        type:DataTypes.INTEGER,
        allowNull:true
      },
      survey:{
         type:DataTypes.INTEGER,
         allowNull:true
      },
       remark:{
         type:DataTypes.TEXT,
         allowNull:true
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
},{
     timestamps:true,
     tableName: 'company_registration'
});
module.exports = Company_Registration;