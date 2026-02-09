const { DataTypes } = require('sequelize');
const sequelize  = require('@config/db');

const Company_User = sequelize.define('Company User', {
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true,
     },
     company_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     id_prifix_company_user: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     company_user_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     user_type: {
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
     mobile_number: {
          type: DataTypes.STRING,
          allowNull:true
     },
     password: {
          type:DataTypes.TEXT,
          allowNull:true,
     },
     role_name: {
          type:DataTypes.STRING,
          allowNull:true
     },
     privileges: {
          type: DataTypes.JSONB,
          allowNull: true,
        },
     address: {
          type:DataTypes.TEXT,
          allowNull:true
     },
     company_profile_img_path: {
          type: DataTypes.TEXT,
          allowNull:true,
      },
      company_profile_img_name: {
          type: DataTypes.TEXT,
          allowNull:true,
      },
     token: {
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
     created_type: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      modified_type: {
          type: DataTypes.STRING,
          allowNull: true,
      },
     created_ip_address: {
          type: DataTypes.STRING,
          allowNull: true
      },
      modified_ip_address: {
          type: DataTypes.STRING,
          allowNull: true
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
     tableName:'company_user'
});
module.exports = Company_User;