const { DataTypes } = require('sequelize');
const sequelize = require('@config/db');

const Society_Profile = sequelize.define('SocietyProfile', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    society_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    society_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
   },
    number_of_flat: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    whatsapp_group_name: {  // Fixed Typo
        type: DataTypes.TEXT,
        allowNull: true
    },
    number_of_members: {  // Fixed Typo
        type: DataTypes.TEXT,
        allowNull: true
    },
    society_whatsapp_img_path: { // Fixed Typo
        type: DataTypes.STRING,
        allowNull: true
    },
    society_whatsapp_img_name: { // Fixed Typo
        type: DataTypes.STRING,
        allowNull: true
    },
    address_line_1: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    address_line_2: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    account_holder_name: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    bank_name: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    account_no: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    branch_name: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    bank_ifsc_code: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    billing_address_line_1: {  // Fixed Typo
        type: DataTypes.TEXT,
        allowNull: true
    },
    billing_address_line_2: {  // Fixed Typo
        type: DataTypes.TEXT,
        allowNull: true
    },
    billing_qr_code_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    billing_qr_code_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_1_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_1_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_2_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_2_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_3_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_3_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_4_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_4_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_5_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    society_profile_img_5_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pan_card_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pan_card_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gst_certificate_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gst_certificate_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    other_document_path: {
        type: DataTypes.STRING,
        allowNull: true
    },
    other_document_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    google_page_url: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    ads_per_day: {
        type: DataTypes.INTEGER,
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
}, {
    timestamps: true,
    tableName: 'society_profile',
});

module.exports = Society_Profile;
