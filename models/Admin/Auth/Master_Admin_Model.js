const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const MasterAdmin = sequelize.define("Master Admin",{
     id: {
          type: DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     id_prifix_admin: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     user_type: {
          type: DataTypes.STRING,
          allowNull:true
     },
     user_id: {
          type: DataTypes.STRING,
          allowNull:true
     },
     user_name: {
          type: DataTypes.STRING,
          allowNull:true
     },
     email: {
          type: DataTypes.STRING,
          allowNull:true,
     },
     password: {
          type:DataTypes.TEXT,
          allowNull:true,
     },
     mobile_no: {
          type: DataTypes.STRING,
          allowNull:true
     },
     role_name: {
          type:DataTypes.STRING,
          allowNull:true
     },
     privileges: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
     role_id: {
          type:DataTypes.STRING,
          allowNull:true
     },
     address: {
          type:DataTypes.TEXT,
          allowNull:true
     },
     user_profile_image_path: {
          type:DataTypes.STRING,
          allowNull:true
     },
     user_profile_image_name:{
          type:DataTypes.STRING,
          allowNull:true
     },
     access_token: {
          type:DataTypes.STRING,
          allowNull:true
     },
     last_login:{
          type:DataTypes.STRING,
          allowNull:true
     },
     otp: {
          type:DataTypes.INTEGER,
          allowNull:true
     },
     login_date_time:{
          type: DataTypes.DATE,
          allowNull:true
     },
     logout_date_time:{
          type:DataTypes.DATE,
          allowNull:true
     },
     reset_token: {
          type: DataTypes.STRING,
          allowNull: true
     },
     reset_token_expiry: {
          type: DataTypes.DATE,
          allowNull: true
     },
     created_ip_address: {
          type: DataTypes.STRING,
          allowNull:true
     },
     modified_ip_address: {
          type: DataTypes.STRING,
          allowNull: true
     },
     created_by:{
          type:DataTypes.BIGINT,
          allowNull:true,
     },
     modified_by: {
          type: DataTypes.BIGINT,
          allowNull:true
     },
     status: {
          type: DataTypes.ENUM('active', 'delete', 'inactive'),
          defaultValue: 'active'
     },
},{
     timestamps:true,
     tableName:'master_admin'
});
module.exports = MasterAdmin;