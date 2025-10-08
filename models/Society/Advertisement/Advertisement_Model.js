const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Advertisement =  sequelize.define('Advertisement',{
     id:{
          type:DataTypes.INTEGER,
          autoIncrement:true,
          primaryKey:true
     },
     campaign_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     campaign_log_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     society_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     society_user_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     company_id:{
          type:DataTypes.INTEGER,
          allowNull:true
     },
     upload_ads_src_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_ads_src_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     no_view:{
          type: DataTypes.STRING,
          allowNull: true
     },
       view_to_company:{
          type: DataTypes.STRING,
          allowNull: true
     },
     no_reactions:{
          type: DataTypes.STRING,
          allowNull:true
     },
     upload_view_src_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_view_src_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     upload_reaction_src_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_reaction_src_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     performance_remark:{
          type: DataTypes.TEXT,
          allowNull: true
     },
     upload_after_24_ads_src_path:{
          type: DataTypes.STRING,
          allowNull: true
     },
     upload_after_24_ads_src_name:{
          type: DataTypes.STRING,
          allowNull:true
     },
     report_submited_24_before_date:{
          type: DataTypes.DATE,
          allowNull:true
     },
     report_submited_24_after_date:{
          type: DataTypes.DATE,
          allowNull:true
     },
     share_status: {
          type: DataTypes.ENUM('yes', 'no'),
          defaultValue: 'no',
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
     tableName:'advertisements'
});

module.exports = Advertisement