require('module-alias/register');
require('dotenv').config();

// Import all models
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Sector = require('@models/Admin/Master/Sector_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Society_User = require('@models/Society/Users/Society_User_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const General_Setting = require('@models/Admin/Settings/General_Model');
const Visual_Setting = require('@models/Admin/Settings/Visual_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const Ads_Slot = require('@models/Society/Auth/Society_Ads_Slot_Model');
const Notification = require('@models/Notifications/Notification_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const Payment_Order = require('@models/Company/Wallet/Payment_Order_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');

// Import seeder to create default admin
const createDefaultAdminUser = require('@seeders/createAdminUser');

async function refreshDatabase() {
  try {
    const models = [
      City, Area, Sector, Society_Registration, Company_Registration,
      Master_Admin, Society_User, Company_User, Campaign_Configuration,
      General_Setting, Visual_Setting, Wallet, Campaign, Campaign_Log,
      Advertisements, Society_Wallet_Payment, Ads_Slot, Notification,
      Company_Profile, Society_Withdraw_Payments, Payment_Order, Society_Profile
    ];

    for (const model of models) {
      try {
        await model.truncate({ restartIdentity: true, cascade: true });
        console.log(`Truncated table: ${model.name}`);
      } catch (err) {
        console.warn(`Could not truncate table: ${model.name}. Skipping. Error: ${err.message}`);
      }
    }

    console.log('All tables truncated successfully');

    // Create default admin
    await createDefaultAdminUser();
    console.log('Default admin user created');

    process.exit(0);
  } catch (error) {
    console.error('Database refresh failed:', error);
    process.exit(1);
  }
}

// Run the refresh
refreshDatabase();
