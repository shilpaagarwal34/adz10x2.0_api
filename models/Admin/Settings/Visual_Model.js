const { DataTypes } = require('sequelize');
const sequelize = require('../../../config/db');

const VisualModel = sequelize.define("VIsual_Settings",{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     full_logo_image_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     full_logo_image_name:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     mini_logo_image_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     mini_logo_image_name:{
          type:DataTypes.TEXT,
          allowNull:true
     },
     logo_email_image_path:{
          type:DataTypes.TEXT,
          allowNull:true
     },
      logo_email_image_name:{
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
     tableName:'visual_settings'
})

module.exports = VisualModel;