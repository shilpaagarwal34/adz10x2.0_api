
const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const GeneralModel = sequelize.define("General_Settings",{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     email:{
          type:DataTypes.STRING,
          allowNull:true
     },
     mobile_no:{
          type:DataTypes.STRING,
          allowNull:true
     },
     address:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     facebook_url:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     linkedin_url:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     instagram_url:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     twitter_url:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     skype_url:{
          type:DataTypes.TEXT,
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
},{
     timestamps:true,
     tableName:'general_settings'
});

module.exports = GeneralModel;