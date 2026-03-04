const { DataTypes } = require("sequelize");
const sequelize = require("@config/db");

const Society_Media_Rate_Card = sequelize.define(
  "Society_Media_Rate_Card",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    society_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    media_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    society_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    platform_commission_pct: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 25,
    },
    platform_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    company_rate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    society_terms: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    whatsapp_details: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: null,
    },
    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    availability_days: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    availability_month_days: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    submission_stage: {
      type: DataTypes.ENUM("draft", "submitted"),
      allowNull: false,
      defaultValue: "submitted",
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
      type: DataTypes.ENUM("active", "delete", "inactive"),
      defaultValue: "active",
    },
  },
  {
    timestamps: true,
    tableName: "society_media_rate_cards",
  }
);

module.exports = Society_Media_Rate_Card;
