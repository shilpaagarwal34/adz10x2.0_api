const express = require('express');

// base 
const baseController = require("@controllers/Base/Base_Controller");
const chatbotController = require("@controllers/Base/Chatbot_Controller");

//  society
const dashbordController = require("@controllers/Society/Dashbord/Dashbord_Controller")
const profileController = require("@controllers/Society/Profile/Profile_Controller");
const societyRegistaratonController = require("@controllers/Society/Auth/Society_Registration_Controller");

const SocietySystemUserController = require("@controllers/Society/Users/Society_User_Controller");
const AdvertisementController = require('@controllers/Society/Advertisement/Advertisement_Controller');
const SocietyPaymentsController = require('@controllers/Society/Payments/Payments_Controller');
const SocietyWalletController = require('@controllers/Society/Wallet/Society_Wallet_Controller');
const SocietyReportController = require('@controllers/Society/Reports/Reports_Controllers');

// company
const companyRegistration = require("@controllers/Company/Auth/Company_Registration_Controller");
const companyProfile = require("@controllers/Company/Profile/Company_Profile_Controller");
const companyDashboard = require("@controllers/Company/Dashboard/Dashbord_Controller");
const CompanySystemUserController = require("@controllers/Company/Users/Company_User_Controller");
const CompanyWalletController = require('@controllers/Company/Wallet/Wallet_Controller');
const PaymentsController = require('@controllers/Company/Payments/Payments_Controller');
const CampaignController = require('@controllers/Company/Campaign/Campaign_Controller');
const CompanyReportController = require('@controllers/Company/Reports/Reports_Controllers');
// admin
const adminDashboardController = require('@controllers/Admin/Dashboard/Dashboard_Controller');
const adminRegController = require("@controllers/Admin/Auth/Registers_Admin_Controller");
const cityController = require("@controllers/Admin/Master/Citys_Controller");
const areaController = require("@controllers/Admin/Master/Areas_Controller");
const SectorController = require('@controllers/Admin/Master/Sectors_Controller');
const CampaignConfiguration_Controller = require('@controllers/Admin/Master/Campaigns_Configuration_Controller'); 
const All_Societs_Controller = require('@controllers/Admin/Society/Society_Controller'); 
const All_Companys_Controller = require('@controllers/Admin/Company/Company_Controller');
const CampaignControllerAdmin = require('@controllers/Admin/Campaign/Campaign_Controller');

const PaymentsControllerAdmin = require('@controllers/Admin/Payments/Payments_Controller');
// admin rolles and permission 
const adminSystemUserController = require("@controllers/Admin/System-Users/System_User_Controller");
const adminGeneralSetting = require('@controllers/Admin/Settings/General_Setting_Controller');
const adminVisualSetting  = require('@controllers/Admin/Settings/Visual_Setting_Controller');
const adminNotificationController = require('@controllers/Admin/Notification/Notification_Controller');
const adminReportController = require('@controllers/Admin/Reports/Reports_Controllers');


const companyNotificationController = require('@controllers/Company/Notification/Company_Notification_Controller');
const societyNotificationController = require('@controllers/Society/Notification/Society_Notification_Controller');

// image upload
const upload = require('@utils/upolad');

const router = express.Router()

// middleware

const authenticateUser = require('@middleware/Admin/Admin_Auth_Middleware');
const authenticateSocietyUser = require('@middleware/Society/Society_Auth_Middleware');
const authenticateCompanyUser = require('@middleware/Company/Company_Auth_Middleware');

// cron job
router.get('/campaign-rejects-date-crossed', CampaignControllerAdmin.campaignRejectsDateCrossed);

router.post('/truncate-all', baseController.truncateAllTables);
router.post('/truncate-all-ids', baseController.truncateAllTablesWithIds);

  router.post('/contact-enquiry', baseController.sendContactEnquiryMail);


//  admin routes
router.get('/admin/notification', authenticateUser, adminNotificationController.adminNotification);
router.get('/company/notification', authenticateCompanyUser, companyNotificationController.companyNotification);
router.get('/society/notification', authenticateSocietyUser, societyNotificationController.societyNotification);

router.post('/admin/notification-clear-all', authenticateUser, adminNotificationController.adminNotificationClearAll);
router.post('/company/notification-clear-all', authenticateCompanyUser, companyNotificationController.companyNotificationClearAll);
router.post('/society/notification-clear-all', authenticateSocietyUser, societyNotificationController.societyNotificationClearAll);

router.get('/admin/dashboard', authenticateUser, adminDashboardController.dashboardCountAdmin);
router.get('/admin/live-datatable', authenticateUser,  adminDashboardController.liveDataTableAdmin);
// router.get('/admin/live-datatable-test', authenticateUser,  adminDashboardController.DataTableAdminlive);
router.get('/admin/citys-table',authenticateUser, cityController.cityDataTable);
router.get('/admin/city/:id',authenticateUser, cityController.getCityById); 
router.post('/admin/city', authenticateUser, cityController.createOrUpdateCity);           

router.post('/admin/area', authenticateUser,  areaController.createOrUpdateArea);
router.get('/admin/area/:id', authenticateUser, areaController.getAreaById); 
router.get('/admin/areas-table',authenticateUser,  areaController.areaDataTable);         

router.get('/reports/admin-area/export', authenticateUser, areaController.exportAreaListExcel);
router.get('/reports/admin-city/export', authenticateUser, cityController.exportCityListExcel);

router.post('/admin/sectors', authenticateUser, SectorController.createOrUpdate );
router.get('/admin/sector/:id',authenticateUser, SectorController.getSecotrsById);
router.get('/admin/sectors-table',authenticateUser,  SectorController.secotrsDataTable);

router.post('/admin/campaign-configuration',authenticateUser, CampaignConfiguration_Controller.store);
// router.get('/admin/campaign-configuration/:id', CampaignConfiguration_Controller.getCampaignById);
router.get('/admin/campaign-configuration', authenticateUser, CampaignConfiguration_Controller.getCampaign);

router.get('/admin/societies-table',authenticateUser, All_Societs_Controller.societyDataTable);
router.get('/admin/societie/:id', authenticateUser, All_Societs_Controller.getScoietyID) 
router.post('/admin/assign-manager-society', upload.fields([
    { name: 'aggrement_copy_path', maxCount:1},
]), authenticateUser, All_Societs_Controller.assignManagerSociety);
router.post('/admin/society-slot-add', upload.fields([
]), authenticateUser, All_Societs_Controller.assignAdsSlotSocietyAdmin);
router.get('/admin/society-commission', authenticateUser,All_Societs_Controller.getSocietyCommission);

router.get('/admin-society-profile-slots/:id', All_Societs_Controller.getSocietyProfileSlotAdmin);

router.post('/admin/society-move-pending', authenticateUser, All_Societs_Controller.societyMoveRejeactPending)
router.post('/admin/society-all-edit', authenticateUser, All_Societs_Controller.societyAllowEdit);

// router.post('/admin/system-user',upload.fields([
//     { name: 'user_profile_image_path', maxCount:1}
// ]), authenticateUser, adminSystemUserController.registerAdminSystemUser);

router.get('/admin/companys-table', authenticateUser, All_Companys_Controller.companyDataTable);
router.get('/admin/company/:id', authenticateUser, All_Companys_Controller.getCompanyID);
router.get('/admin/company-commission', All_Companys_Controller.getCompanyCommission);
router.post('/admin/assign-manager-company', upload.fields([
    { name: 'company_aggrement_copy_path', maxCount:1},
]), authenticateUser, All_Companys_Controller.assignManagerCompany);

router.post('/admin/comapny-move-pending', authenticateUser, All_Companys_Controller.comapnyMoveRejeactPending);
router.post('/admin/comapny-all-edit', authenticateUser, All_Companys_Controller.comapnyAllowEdit);

router.get('/admin/company-all-wallet-amount', authenticateUser, PaymentsControllerAdmin.walletAdminAmount);
router.get('/admin/company-payments-table', authenticateUser, PaymentsControllerAdmin.paymentsAdminDataTable);
router.get('/admin/company-wallets-table', authenticateUser,  PaymentsControllerAdmin.walletAdminDataTable);
router.get('/admin/campaign-settlement-summary', authenticateUser, PaymentsControllerAdmin.campaignSettlementSummary);
router.get('/admin/campaign-settlement-table', authenticateUser, PaymentsControllerAdmin.campaignSettlementDataTable);
router.post('/admin/campaign-settlement-transfer', authenticateUser, PaymentsControllerAdmin.transferCampaignSettlement);
router.get('/admin/society/withdrawal-payments-table', authenticateUser,  PaymentsControllerAdmin.paymentsWithdrawalAdminDataTable);
router.get('/admin/withdrawa-view/:id', authenticateUser, PaymentsControllerAdmin.paymentsWithdrawalByIdAdmin);
router.post('/admin/society-add-withdrawal-update', upload.fields([
    { name: 'transaction_path', maxCount:1 }
]), authenticateUser, PaymentsControllerAdmin.updateWithdrawalAdmin);

router.post('/admin/general-settings',authenticateUser, adminGeneralSetting.generalSettingAddUpdate);
router.get('/admin/general-settings',authenticateUser,  adminGeneralSetting.getGeneralSetting);
router.get('/admin/visual-settings', authenticateUser, adminVisualSetting.getVisualSetting);
router.get('/visual-settings', adminVisualSetting.getVisualSetting);
router.post('/admin/visual-settings', upload.fields([
    { name: 'full_logo_image_path', maxCount:1},
    { name: 'mini_logo_image_path', maxCount:1},
    { name: 'logo_email_image_path', maxCount:1},
]), authenticateUser, adminVisualSetting.visualSettingAddUpdate);

router.post('/admin/change-password',authenticateUser, adminGeneralSetting.changeAdminPassword);

// admin front route 
router.get('/admin/city', cityController.getCitys);                       
router.get('/admin/areas/:city_id', areaController.getAreas);                       

// company and society reg 

router.get('/all-cities', baseController.getAllCitys);
router.get('/all-area', baseController.getAllAreas);
router.get('/sectors', baseController.getSecotrs);
router.get('/areas/:city_id', baseController.getAreasByCity);
router.get('/check-is-exist', baseController.checkEmailMobile);
router.get('/check-email-exist', baseController.checkEmail);
router.get('/check-mobile-exist', baseController.checkMobile);

//  get all company for admin start
  router.get('/all-company', baseController.getAllCompanys);
  router.get('/all-society', baseController.getAllSociety);

// get all compny for admin end


router.post('/common-delete', baseController.commonDelete);
router.post('/change-status', baseController.commonStatus);

router.post('/login', baseController.login);
router.post('/logout', baseController.logout);
router.post('/login-users', baseController.loginUser);
router.post('/chatbot/query', chatbotController.chatbotQuery);
// router.post('/logins', baseController.Logins);
router.post('/forgot-password', baseController.forgotPassword);
router.post('/change-password', baseController.changePassword);
router.post("/verify-otp", baseController.verifyOTP);
router.post("/resend-otp", baseController.resendOTP);
router.post("/send-login-otp", baseController.sendLoginOtp);
router.post("/verify-login-otp", baseController.verifyLoginOtp);

router.get('/admin/rel-manager', authenticateUser, baseController.relationManagerID);
router.get('/admin-all-campaign-days',baseController.getAllCampaignDays);

router.post('/admin-register', adminRegController.registerAdmin);
router.post('/admin-login', adminRegController.login);
router.post('/admin-logout', authenticateUser, adminRegController.logoutAdmin);
router.post('/admin-forgot-password', adminRegController.forgotAdminPassword);
router.post('/admin-changes-password', adminRegController.changeAdminPassword);

// admin rolls and permissions
router.post('/admin/system-user',upload.fields([
    { name: 'user_profile_image_path', maxCount:1}
]), authenticateUser, adminSystemUserController.registerAdminSystemUser);
router.get('/admin/system-user/:id', authenticateUser, adminSystemUserController.getUserById);
router.get('/admin/system-table', authenticateUser, adminSystemUserController.systemUserDataTable);


// admin Campaign Admin

router.get('/admin/campaign/view/:id',authenticateUser, CampaignControllerAdmin.viewCampaignAdmin);
router.get('/admin/campaign-society/view/:id',authenticateUser, CampaignControllerAdmin.viewSocietyAdmin);
router.get('/admin/ads-society/view/:id',authenticateUser, CampaignControllerAdmin.viewAdminAdvertisement);
router.post('/admin/ads-society-approved', authenticateUser, CampaignControllerAdmin.advertisementApprovedAdmin);
router.get('/admin/campaign-datatable', authenticateUser, CampaignControllerAdmin.campaignDataTableAdmin);
// router.post('/admin/campaign/advertisement-approved-status', CampaignControllerAdmin.AdvertisementApprovedAdmin);
router.post('/admin/campaign/advertisement-approved-status',authenticateUser, CampaignControllerAdmin.advertisementApprovedAdmin);
router.post('/admin/campaign/all-advertisement-approved-status', authenticateUser, CampaignControllerAdmin.advertisementApprovedAllAdmin);
router.get('/admin/society-profile-ads/:id',authenticateUser,CampaignControllerAdmin.getSocietyProfileAdminSlot);
router.post('/admin/society/advertisement-ads', upload.fields([
    { name: 'upload_ads_src_path', maxCount: 1 },
    { name: 'upload_view_src_path', maxCount: 1 },
    { name: 'upload_reaction_src_path', maxCount:1},
    { name: 'upload_after_24_ads_src_path', maxCount:1},
]),authenticateUser, CampaignControllerAdmin.advertisementADSAdmin);


// admin report
router.get('/admin/society/total-report-table',authenticateUser, adminReportController.totalSocietiesReportDataTable);
router.get('/admin/company-total-report-table',authenticateUser, adminReportController.totalCompanyReportDataTable);
router.get('/admin/total-ads-report-table',authenticateUser, adminReportController.totalAdsApprovalReportsDataTable);
router.get('/admin/total-society-payments-table',authenticateUser, adminReportController.totalPayoutSummaryReportDataTable);
router.get('/admin/total-company-payments-table',authenticateUser, adminReportController.totalWalletPaymentHistoryReportDataTable);
router.get('/admin/total-user-report-table',authenticateUser, adminReportController.adminUserReportDataTable);
router.get('/admin/total-platform-earning-report-table',authenticateUser, adminReportController.totalPlatformEarningReportDataTable);
// router.get('admin/society/report-ads-performance-table',authenticateSocietyUser, SocietyReportController.adsPerformanceReportsDataTable);
// router.get('/society/report-payout-summary-table',authenticateSocietyUser, SocietyReportController.payoutSummaryReportDataTable);
// router.get('/society/report-approval-table',authenticateSocietyUser, SocietyReportController.adsApprovalReportsDataTable);
router.get('/reports/admin-total-society/export',authenticateUser, adminReportController.exportSocietyReportExcel);
router.get('/reports/admin-total-company/export',authenticateUser, adminReportController.exportCompanyReportExcel);
router.get('/reports/admin-total-ads/export',authenticateUser, adminReportController.exportTotalAdsApprovalReport);
router.get('/reports/admin-total-society-payments/export',authenticateUser, adminReportController.exporTotalPayoutSummaryReport);
router.get('/reports/admin-company-payments/export',authenticateUser, adminReportController.exportWalletPaymentHistoryReport);
router.get('/reports/admin-users/export',authenticateUser, adminReportController.exportAdminUserReportExcel );
router.get('/reports/admin-platform-earning/export',authenticateUser, adminReportController.exportPlatformEarningReportExcel );
// router.get('/reports/ads-approval-report/export',authenticateSocietyUser, SocietyReportController.exportAdsApprovalReport );


// society routes

router.get('/society-register',societyRegistaratonController.getSocietyRegistration);
router.post('/society-register',societyRegistaratonController.societyRegistration);

router.get('/society-dashboard',authenticateSocietyUser ,dashbordController.getSocietyDashbord);
router.get('/society-profile-ads',authenticateSocietyUser, profileController.getSocietyProfileSlot);
router.get('/society/media-rate-cards', authenticateSocietyUser, profileController.getSocietyMediaRateCards);
router.post('/society/media-rate-cards', authenticateSocietyUser, profileController.upsertSocietyMediaRateCards);
router.post('/society-profile', authenticateSocietyUser ,profileController.getSocietyProfile);

// router.post('/society-profile')

router.get('/admin-campaign-days',profileController.getCampaignDays);
router.delete('/delete-society-profile-image', profileController.deleteSocietyProfileImage);
router.post('/society-profile-update', upload.fields([
     { name: 'society_profile_img_path', maxCount: 1 },
     { name: 'society_profile_img_1_5_path', maxCount: 5 },
     { name: 'society_whatsapp_img_path', maxCount:1},
     { name: 'pan_card_path', maxCount:1},
     { name: 'gst_certificate_path', maxCount:1},
     { name: 'other_document_path', maxCount:1},
     { name: 'billing_qr_code_path', maxCount:1},
 ]),authenticateSocietyUser , profileController.societyRegistrationUpdateImage);

 router.get('/society/advertisement-datatable', authenticateSocietyUser, AdvertisementController.advertisementDataTable);
  router.get('/society/campaign-all-advertisement-datatable', authenticateSocietyUser, AdvertisementController.campaignDataTableSocietyCampinwise);
 router.get('/society/advertisement-view/:id', AdvertisementController.viewAdvertisement);
 router.post('/society/advertisement-approved-status', authenticateSocietyUser, AdvertisementController.advertisementApproved);
 router.get('/society/advertisement-profile-ads/:id',authenticateSocietyUser,AdvertisementController.getSocietyProfileSlotAdvertisement);
 router.post('/society/advertisement-ads', upload.fields([
    { name: 'upload_ads_src_path', maxCount: 1 },
    { name: 'upload_view_src_path', maxCount: 1 },
    { name: 'upload_reaction_src_path', maxCount:1},
    { name: 'upload_after_24_ads_src_path', maxCount:1},
]),authenticateSocietyUser, AdvertisementController.advertisementADS);

router.get('/society-wallet-amount', authenticateSocietyUser, SocietyPaymentsController.WalletSocietyAmount);
router.post('/society-add-withdrawal', upload.fields([
    { name: 'upload_report_path', maxCount:1},
]), authenticateSocietyUser, SocietyPaymentsController.addWithdrawal);
router.get('/society/withdrawal-payments-table', authenticateSocietyUser, SocietyPaymentsController.paymentsWithdrawalDataTable);
router.get('/society/withdrawa-view/:id', authenticateSocietyUser, SocietyPaymentsController.paymentsWithdrawalById);

router.get('/society/wallet-payments-table', authenticateSocietyUser, SocietyWalletController.walletSocietyDataTable);

// socity users rolls and permissions
router.post('/society/system-users',upload.fields([
    { name: 'society_profile_img_path', maxCount:1}
]), authenticateSocietyUser, SocietySystemUserController.registerSocietyUser);
router.get('/society/system-user/:id', authenticateSocietyUser, SocietySystemUserController.getSocietyUserById);
router.get('/society/system-table', authenticateSocietyUser, SocietySystemUserController.systemSocietyDataTable);
router.post('/society/change-password', authenticateSocietyUser, SocietySystemUserController.changeSocietyPassword);
router.post('/society/logout', SocietySystemUserController.logoutSociety);
router.post('/society/delete-account', authenticateSocietyUser, SocietySystemUserController.deleteSocietyAccount);

// society report
router.get('/society/report-ads-payments-table',authenticateSocietyUser, SocietyReportController.adsPaymentReportsDataTable);
router.get('/society/report-ads-performance-table',authenticateSocietyUser, SocietyReportController.adsPerformanceReportsDataTable);
router.get('/society/report-payout-summary-table',authenticateSocietyUser, SocietyReportController.payoutSummaryReportDataTable);
router.get('/society/report-approval-table',authenticateSocietyUser, SocietyReportController.adsApprovalReportsDataTable);
router.get('/reports/ads-payment/export',authenticateSocietyUser, SocietyReportController.exportAdsPaymentReport);
router.get('/reports/ads-performance/export',authenticateSocietyUser, SocietyReportController.exportAdsPerformanceReport );
router.get('/reports/payout-summary/export',authenticateSocietyUser, SocietyReportController.exportPayoutSummaryReport );
router.get('/reports/ads-approval-report/export',authenticateSocietyUser, SocietyReportController.exportAdsApprovalReport );
// company register

router.post('/company-register',companyRegistration.companyRegistration);
router.get('/comapny-dashboard',authenticateCompanyUser,companyDashboard.getCompanyDashbord);
router.get('/comapny-profile', authenticateCompanyUser, companyProfile.getCompanyProfile);
router.post('/company-profile-update',upload.fields([
    { name: 'company_profile_photo_path', maxCount:1 },
    { name: 'pan_card_path', maxCount:1 },
    { name: 'gst_certificate_path', maxCount:1 },
    { name: 'other_document_path', maxCount:1 }
]), authenticateCompanyUser, companyProfile.companyProfileUpdate);

// / company users rolls and permissions
router.post('/company/system-users',upload.fields([
    { name: 'company_profile_img_path', maxCount:1}
]), authenticateCompanyUser, CompanySystemUserController.registerCompanyUser);
router.get('/company/system-user/:id', authenticateCompanyUser, CompanySystemUserController.getCompanyUserById);
router.get('/company/system-table', authenticateCompanyUser, CompanySystemUserController.systemCompanyDataTable);
router.post('/company/change-password', authenticateCompanyUser, CompanySystemUserController.changeCompanyPassword);
router.post('/company/delete-account', authenticateCompanyUser, CompanySystemUserController.deleteCompanyAccount);

router.post('/wallet', authenticateCompanyUser, CompanyWalletController.wallet_Add);
router.post('/wallet-validation', authenticateCompanyUser, CompanyWalletController.wallet_Add_Validation);
router.get('/wallet-amount', authenticateCompanyUser, CompanyWalletController.walletAmount);
router.get('/wallet-datatable', authenticateCompanyUser, CompanyWalletController.walletDataTable);
router.get('/payments-datatable', authenticateCompanyUser, PaymentsController.paymentsDataTable);


router.get('/payments-datatable-test',  PaymentsController.paymentsDataTableTest);

router.post('/create-order', authenticateCompanyUser, CompanyWalletController.createOrder);
router.post('/verify-payment',authenticateCompanyUser, CompanyWalletController.verifyPayment);
router.post('/create-orders', CompanyWalletController.createOrders);

router.post('/create-company-campaign',
    upload.any(), // Accepts all fields, including dynamic ones
    authenticateCompanyUser,CampaignController.createOrUpdateCampaign
  );

router.get('/company/campaign/view/:id', authenticateCompanyUser, CampaignController.viewCampaign);
router.get('/company/ads-view/:id',authenticateCompanyUser, CampaignController.viewAdvertisement);
router.get('/company/campaign-datatable', authenticateCompanyUser, CampaignController.campaignDataTable);

router.post('/get-societies-within-radius',  CampaignController.getSocietiesWithinRadius);
router.get('/get-campaign-type', authenticateCompanyUser, CampaignController.getCampaignType);
router.get('/company/media-rate-cards', authenticateCompanyUser, CampaignController.getCompanySocietyMediaRateCards);

// society report
router.get('/company/report-spend-table',authenticateCompanyUser, CompanyReportController.spendReportDataTable);
router.get('/company/report-wallet-history-table',authenticateCompanyUser, CompanyReportController.walletPaymentHistoryReportDataTable);
router.get('/company/report-campaign-reach-table',authenticateCompanyUser, CompanyReportController.campaignReachReportDataTable);
router.get('/company/report-society-list-table',authenticateCompanyUser, CompanyReportController.campaignSocitylistReportDataTable);
router.get('/company/report-user-table',authenticateCompanyUser, CompanyReportController.userReportDataTable);

router.get('/reports/company/export-spend',authenticateCompanyUser, CompanyReportController.exportSpendReport);
router.get('/reports/company/export-campaign-reach',authenticateCompanyUser, CompanyReportController.exportCampaignReachReport);
router.get('/reports/company/export-campaign-society-list',authenticateCompanyUser, CompanyReportController.exportCampaignSocietyListReport);
router.get('/reports/company/export-wallet-history',authenticateCompanyUser, CompanyReportController.exportWalletPaymentHistoryReport);
router.get('/reports/company/export-users',authenticateCompanyUser, CompanyReportController.exportuserReportDataTable);
router.get('/reports/company-user', authenticateCompanyUser, CompanyReportController.exportuserReportDataTable)

module.exports = router;