const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Campaign = sequelize.define('Campaign',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
      id_prifix_campaign: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     company_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     company_user_id: {
          type: DataTypes.INTEGER,
          allowNull: true
     },
     campaign_type:{
          type: DataTypes.STRING,
          allowNull:true
     },
     media_type:{
          type: DataTypes.STRING,
          allowNull:true
     },
     creative_type:{
          type:DataTypes.STRING,
          allowNull:true
     },
     lead_generation_url: {
          type: DataTypes.TEXT,
          allowNull:true
     },
     survey_url: {
          type: DataTypes.TEXT,
          allowNull:true
     },
     campaign_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     campaign_date:{
          type: DataTypes.DATE,
          allowNull:true
     },
     live_start_date:{
          type: DataTypes.DATE,
          allowNull:true
       },
     live_end_date:{
          type: DataTypes.DATE,
          allowNull:true
     },
     campaign_city_id:{
          type: DataTypes.STRING,
          allowNull:true
     },
     campaign_area_id:{
          type: DataTypes.STRING,
          allowNull: true
     },
     campaign_address:{
          type: DataTypes.TEXT,
          allowNull: true
     },
     my_ads_location_longitude:{
          type: DataTypes.FLOAT,
          allowNull: true
     },
     my_ads_location_latitude:{
          type: DataTypes.FLOAT,
          allowNull: true
     },
     radius_km:{
          type: DataTypes.FLOAT,
          allowNull:true
     },
     search_by_google_location:{
          type: DataTypes.BOOLEAN,
          allowNull: true
     },
     brand_promotions_creative:{
          type: DataTypes.BOOLEAN,
          allowNull:true
     },
     campaign_amount:{
          type: DataTypes.FLOAT,
          allowNull:true
     },
     upload_creative_image_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_creative_image_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     upload_creative_video_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_creative_video_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     creative_text: {
          type: DataTypes.TEXT,
          allowNull:true
     },
     campaign_status: {
          type: DataTypes.ENUM('active','draft','pending','approved', 'completed', 'cancelled','reject','live'),
          defaultValue: 'active',
      },
     report_status: {
          type: DataTypes.ENUM('approved', 'pending', 'onverification'),
          defaultValue: 'pending',
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
     tableName:'company_campaigns'
});

module.exports = Campaign

