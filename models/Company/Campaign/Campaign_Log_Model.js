const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Campaign_Log = sequelize.define('Campaign_Log',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     campaign_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
      id_prifix_campaign_ads: {
          type:DataTypes.TEXT,
          allowNull:true   
     },
     society_id:{
          type: DataTypes.INTEGER,
          allowNull: true
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
     creative_type:{
          type:DataTypes.STRING,
          allowNull:true
     },
     societies_text:{
        type: DataTypes.TEXT,
        allowNull:true
     },
     upload_societies_images_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_societies_images_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     slot_start_time: {
          type: DataTypes.TIME,
          allowNull: true
      },
      slot_end_time: {
          type: DataTypes.TIME,
          allowNull: true
      },
     society_approved_status: {
          type: DataTypes.ENUM('active','pending','approved', 'completed', 'cancelled','reject','live'),
          defaultValue: 'pending',
      },
      admin_approved_status: {
          type: DataTypes.ENUM('active','pending','approved', 'completed', 'cancelled','reject','live'),
          defaultValue: 'pending',
      },
       campaign_status: {
          type: DataTypes.ENUM('active','pending','approved', 'completed', 'cancelled','reject','live','draft'),
          defaultValue: 'active',
      },
      refund_status:{
          type: DataTypes.STRING,
          allowNull:true
      },
      report_status: {
          type: DataTypes.ENUM('approved', 'pending', 'onverification'),
          defaultValue: 'pending',
      },
      approved_date:{
          type: DataTypes.DATE,
          allowNull:true
      },
      cancel_date:{
          type: DataTypes.DATE,
          allowNull:true
      },
      completed_date:{
        type: DataTypes.DATE,
        allowNull:true
      },
       approved_date_admin:{
          type: DataTypes.DATE,
          allowNull:true
      },
       society_approved_date:{
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
        campaign_ads_amount:{
            type: DataTypes.FLOAT,
            allowNull:true
       },
      society_cancel_reason: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      admin_cancel_reason: {
          type: DataTypes.TEXT,
          allowNull: true
      },
      approved_by: {
          type: DataTypes.STRING,
          allowNull: true,
      },
      view_to_company: {
         type:DataTypes.BOOLEAN,
         allowNull:true
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
     tableName:'company_campaigns_logs'
});

module.exports = Campaign_Log

