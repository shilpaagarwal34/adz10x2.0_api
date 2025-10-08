
const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const CampaignConfiguration = sequelize.define('Campaign Configuration', {
     id:{
          type:DataTypes.INTEGER,
          primaryKey:true,
          autoIncrement:true
     },
     brand_promotion:{
          type:DataTypes.INTEGER,
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
     mon: {
          type: DataTypes.BOOLEAN
     },
    tue: {
     type: DataTypes.BOOLEAN
     },
    wed: {
     type: DataTypes.BOOLEAN
     },
    thu: {
     type: DataTypes.BOOLEAN
     },
    fri: {
     type: DataTypes.BOOLEAN
     },
    sat: {
     type: DataTypes.BOOLEAN
     },
    sun: {
     type: DataTypes.BOOLEAN
     },
     from_time:{
          type:DataTypes.TIME,
          allowNull:true
     },
     to_time:{
          type:DataTypes.TIME,
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
     tableName: 'campaign_configuration'
})
module.exports = CampaignConfiguration;
