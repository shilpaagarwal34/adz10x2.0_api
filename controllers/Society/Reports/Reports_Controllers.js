const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const ExcelJS = require('exceljs');
const path = require('path');
const { where, literal, Sequelize } = require('sequelize');
const { Op } = require('sequelize');
const moment = require('moment-timezone');


exports.adsPaymentReportsDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const campaign_status = req.query.campaign_status;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

                    // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.live_start_date = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

        let societyId = null

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
            societyId = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
            societyId = req.user.society_id;
        }
    
        const total = await Campaign_Log.count({ where: whereClause });

        const campaign_log = await Campaign_Log.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'id_prifix_campaign_ads',
                'company_id',
                'campaign_id',
                'society_id',
                'report_status',
                'campaign_status',
                'live_start_date',
                'createdAt',
                'status',
                [Sequelize.literal(`(
                    SELECT company_name
                    FROM company_registration
                    WHERE company_registration.id = "Campaign_Log".company_id
                )`), 'company_name'],
                [Sequelize.literal(`(
                   SELECT campaign_name
                   FROM company_campaigns
                   WHERE company_campaigns.id = "Campaign_Log".campaign_id
                  )`),'campaign_name'],
                [Sequelize.literal(`TO_CHAR("Campaign_Log"."createdAt", 'DD-MM-YYYY')`), 'date']
            ]
        });

        const campaignIds = [...new Set(campaign_log.map(log => log.campaign_id))]; // fixed typo here

        const campaigns = await Campaign.findAll({
            where: {
                id: { [Op.in]: campaignIds }
            }
        });

        const campaignMap = {};
        campaigns.forEach(c => {
            campaignMap[c.id] = c;
        });

    const formattedCampaigns = await Promise.all(campaign_log.map(async (item) => {
    const createdAt = new Date(item.createdAt);
    const dayName = createdAt.toLocaleDateString('en-US', { weekday: 'long' });
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = createdAt.toLocaleDateString('en-US', { month: 'long' });
    const year = createdAt.getFullYear();

    // Convert time with IST timezone using moment
    const formatISTTime = (time) => {
        if (!time) return '';
        return moment.tz(`1970-01-01T${time}`, 'Asia/Kolkata').format('hh:mm A');
    };

    const timeFormatted = createdAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
     });

    // ✅ Format live_start_date from Campaign_Log
    let liveStartDateFormatted = '';
    if (item.live_start_date) {
        liveStartDateFormatted = moment(item.live_start_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
    }

    const payment = await Society_Wallet_Payment.findOne({
               where: { campaign_log_id: item.id },  // Ensure this column exists!
               attributes: ['payment_status', 'amount']
          });

    return {
        ...item.toJSON(),
        createdAtFormatted: `${dayName} ${day}-${month} ${year} ${timeFormatted}`,
        live_start_date_formatted: liveStartDateFormatted || '',
        payment_status: payment ? payment.payment_status : '',
        payment_amount: payment ? payment.amount : '0'
    };
  }));

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns_logs',
            message: 'Campaign log fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: error.message
        });
    }
};

exports.adsPerformanceReportsDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            campaign_status: {
                [Op.in]: ['completed','approved']
            }
        };

            // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.live_start_date = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

        let societyId = null

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
            societyId = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
            societyId = req.user.society_id;
        }
    
        const total = await Campaign_Log.count({ where: whereClause });

        const campaign_log = await Campaign_Log.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'id_prifix_campaign_ads',
                'company_id',
                'campaign_id',
                'society_id',
                'creative_type',
                'report_status',
                'campaign_type',
                'campaign_status',
               //  'admin_approved_status',
               //  'society_approved_status',
                'live_start_date',
               //  'slot_start_time',
               //  'slot_end_time',
                'createdAt',
                'status',
                [Sequelize.literal(`(
                    SELECT company_name
                    FROM company_registration
                    WHERE company_registration.id = "Campaign_Log".company_id
                )`), 'company_name'],
              [Sequelize.literal(`(
                    SELECT sector_name
                    FROM sectors
                    WHERE sectors.id = CAST((
                         SELECT sector
                         FROM company_registration
                         WHERE company_registration.id = "Campaign_Log".company_id
                    ) AS INTEGER)
               )`), 'sector_name'],
                [Sequelize.literal(`(
                   SELECT campaign_name
                   FROM company_campaigns
                   WHERE company_campaigns.id = "Campaign_Log".campaign_id
                  )`),'campaign_name'],
                [Sequelize.literal(`TO_CHAR("Campaign_Log"."createdAt", 'DD-MM-YYYY')`), 'date']
            ]
        });

        const campaignIds = [...new Set(campaign_log.map(log => log.campaign_id))]; // fixed typo here

        const campaigns = await Campaign.findAll({
            where: {
                id: { [Op.in]: campaignIds }
            }
        });

        const campaignMap = {};
        campaigns.forEach(c => {
            campaignMap[c.id] = c;
        });

     const formattedCampaigns = await Promise.all(campaign_log.map(async (item) => {
    const createdAt = new Date(item.createdAt);
    const dayName = createdAt.toLocaleDateString('en-US', { weekday: 'long' });
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = createdAt.toLocaleDateString('en-US', { month: 'long' });
    const year = createdAt.getFullYear();

    // Convert time with IST timezone using moment
    const formatISTTime = (time) => {
        if (!time) return '';
        return moment.tz(`1970-01-01T${time}`, 'Asia/Kolkata').format('hh:mm A');
    };

    const timeFormatted = createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
     });


    const startTimeFormatted = formatISTTime(item.slot_start_time);
    const endTimeFormatted = formatISTTime(item.slot_end_time);

    // ✅ Format live_start_date from Campaign_Log
    let liveStartDateFormatted = '';
    if (item.live_start_date) {
        liveStartDateFormatted = moment(item.live_start_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
    }

    // ✅ Fetch advertisement details based on campaign_log_id
    const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['no_view', 'no_reactions',]
    });

    return {
        ...item.toJSON(),
        createdAtFormatted: `${dayName} ${day}-${month} ${year} ${timeFormatted}`,
        slot_start_time: startTimeFormatted,
        slot_end_time: endTimeFormatted,
        live_start_date_formatted: liveStartDateFormatted || '',
        no_view: ads ? ads.no_view : '0',
        no_reactions: ads ? ads.no_reactions : '0'
    };
}));


        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns_logs',
            message: 'Campaign log fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: error.message
        });
    }
};

exports.payoutSummaryReportDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

            // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.createdAt = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }


        let societyId = null

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
            societyId = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
            societyId = req.user.society_id;
        }
    
        const total = await Society_Withdraw_Payments.count({ where: whereClause });

        const campaign_log = await Society_Withdraw_Payments.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'company_id',
                'paid_date',
                'society_id',
                'invoice_id',
                'withdraw_amount',
                'description',
                'payment_status',
                'transaction_id',
                'remark',
                'createdAt',
                'modified_type',
                'modified_by',
                'status',
            ]
        });

        const campaignIds = [...new Set(campaign_log.map(log => log.campaign_id))]; // fixed typo here

        const campaigns = await Campaign.findAll({
            where: {
                id: { [Op.in]: campaignIds }
            }
        });

        const campaignMap = {};
        campaigns.forEach(c => {
            campaignMap[c.id] = c;
        });

    const formattedCampaigns = await Promise.all(campaign_log.map(async (item) => {
    const createdAt = new Date(item.createdAt);
    const dayName = createdAt.toLocaleDateString('en-US', { weekday: 'long' });
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = createdAt.toLocaleDateString('en-US', { month: 'long' });
    const year = createdAt.getFullYear();

    // Convert time with IST timezone using moment
    const formatISTTime = (time) => {
        if (!time) return '';
        return moment.tz(`1970-01-01T${time}`, 'Asia/Kolkata').format('hh:mm A');
    };

    const timeFormatted = createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
     });

    // ✅ Format live_start_date from Campaign_Log
    let paidDateFormatted = '';
    if (item.paid_date) {
        paidDateFormatted = moment(item.paid_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
    }

    // ✅ Fetch advertisement details based on campaign_log_id
    const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['no_view', 'no_reactions',]
    });

     let adminName = '';
     if (item.modified_type === 'Admin' && item.modified_by) {
     const admin = await Master_Admin.findOne({
          where: { id: item.modified_by },
          attributes: ['user_name']
     });
     adminName = admin ? admin.user_name : '';
     }

    return {
        ...item.toJSON(),
        createdAtFormatted: `${dayName} ${day}-${month} ${year} ${timeFormatted}`,
        paidDatesFormatted: paidDateFormatted || '',
        submited_by: adminName || '',
    };
}));


        return res.status(200).json({
            status: 200,
            table_name: 'society_withdraw_payments',
            message: 'Society withdraw payment fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: error.message
        });
    }
};

exports.adsApprovalReportsDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
              campaign_status: {
                [Op.in]: ['completed','reject']
            }
        };

                // Initialize date filter only if show_all is not true
        if (req.query.show_all !== 'true') {
            let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

            // Apply the date filter to campaignWhereClause
            whereClause.live_start_date = {
                [Op.between]: [fromDateStart, toDateEnd]
            };
        }

        let societyId = null

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
            societyId = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
            societyId = req.user.society_id;
        }
    
        const total = await Campaign_Log.count({ where: whereClause });

        const campaign_log = await Campaign_Log.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'id_prifix_campaign_ads',
                'company_id',
                'campaign_id',
                'society_id',
                'report_status',
                'campaign_status',
                'society_approved_date',
                'approved_date_admin',
                'live_start_date',
                'completed_date',
                'cancel_date',
                'createdAt',
                'status',
                [Sequelize.literal(`(
                    SELECT company_name
                    FROM company_registration
                    WHERE company_registration.id = "Campaign_Log".company_id
                )`), 'company_name'],
              [Sequelize.literal(`(
                    SELECT sector_name
                    FROM sectors
                    WHERE sectors.id = CAST((
                         SELECT sector
                         FROM company_registration
                         WHERE company_registration.id = "Campaign_Log".company_id
                    ) AS INTEGER)
               )`), 'sector_name'],
                [Sequelize.literal(`(
                   SELECT campaign_name
                   FROM company_campaigns
                   WHERE company_campaigns.id = "Campaign_Log".campaign_id
                  )`),'campaign_name'],
                [Sequelize.literal(`TO_CHAR("Campaign_Log"."createdAt", 'DD-MM-YYYY')`), 'date']
            ]
        });

        const campaignIds = [...new Set(campaign_log.map(log => log.campaign_id))]; // fixed typo here

        const campaigns = await Campaign.findAll({
            where: {
                id: { [Op.in]: campaignIds }
            }
        });

        const campaignMap = {};
        campaigns.forEach(c => {
            campaignMap[c.id] = c;
        });

     const formattedCampaigns = await Promise.all(campaign_log.map(async (item) => {
    const createdAt = new Date(item.createdAt);
    const dayName = createdAt.toLocaleDateString('en-US', { weekday: 'long' });
    const day = createdAt.getDate().toString().padStart(2, '0');
    const month = createdAt.toLocaleDateString('en-US', { month: 'long' });
    const year = createdAt.getFullYear();

    // Convert time with IST timezone using moment
    const formatISTTime = (time) => {
        if (!time) return '';
        return moment.tz(`1970-01-01T${time}`, 'Asia/Kolkata').format('hh:mm A');
    };

    const timeFormatted = createdAt.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
     });

    // ✅ Format live_start_date from Campaign_Log
    let liveStartDateFormatted = '';
    if (item.live_start_date) {
        liveStartDateFormatted = moment(item.live_start_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
    }

     // ✅ Format approved_date_admin
     let approvedDateAdminFormatted = '';
     if (item.approved_date_admin) {
     approvedDateAdminFormatted = moment(item.approved_date_admin)
          .tz('Asia/Kolkata')
          .format('dddd DD-MMMM-YYYY hh:mm A');
     }

     // ✅ Format society_approved_date
     let societyApprovedDateFormatted = '';
     if (item.society_approved_date) {
     societyApprovedDateFormatted = moment(item.society_approved_date)
          .tz('Asia/Kolkata')
          .format('dddd DD-MMMM-YYYY hh:mm A');
     }

      // ✅ Format society_approved_date
     let societycancelDateFormatted = '';
     if (item.cancel_date) {
     societycancelDateFormatted = moment(item.cancel_date)
          .tz('Asia/Kolkata')
          .format('dddd DD-MMMM-YYYY hh:mm A');
     }

      // ✅ Format society_approved_date
     let societycompletedDateFormatted = '';
     if (item.completed_date) {
     societycompletedDateFormatted = moment(item.completed_date)
          .tz('Asia/Kolkata')
          .format('dddd DD-MMMM-YYYY hh:mm A');
     }

    // ✅ Fetch advertisement details based on campaign_log_id
    const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['report_submited_24_before_date', 'report_submited_24_after_date',]
    });

        // ✅ Format report submission dates from Advertisements
    const reportBeforeDateFormatted = ads?.report_submited_24_before_date
        ? moment(ads.report_submited_24_before_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '';
    const reportAfterDateFormatted = ads?.report_submited_24_after_date
        ? moment(ads.report_submited_24_after_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '';

    return {
        ...item.toJSON(),
        createdAtFormatted: `${dayName} ${day}-${month} ${year} ${timeFormatted}`,
        live_start_date_formatted: liveStartDateFormatted || '',
        approved_date_admin_formatted: approvedDateAdminFormatted || '',
        society_approved_date_formatted: societyApprovedDateFormatted || '',
        cancel_formatted: societycancelDateFormatted || '',
        completed_date_formatted: societycompletedDateFormatted || '',
        report_submited_24_before_date_formatted: reportBeforeDateFormatted,
        report_submited_24_after_date_formatted: reportAfterDateFormatted
      };
    }));

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns_logs',
            message: 'Campaign log fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: error.message
        });
    }
};

exports.exportAdsPaymentReport = async (req, res) => {
  try {

    const safeValue = (value) =>
      value === null || value === undefined || value === '' ? '-' : value;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    const uid = req.user.id;
    const utype = req.user_type;

    if (utype === 'Society_Admin') {
      whereClause.society_id = uid;
    } else if (utype === 'Society_User') {
      whereClause.society_id = req.user.society_id;
    }

            // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.live_start_date = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

    // ✅ Fetch all campaign logs
    const campaignLogs = await Campaign_Log.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id',
        'id_prifix_campaign_ads',
        'campaign_status',
        'live_start_date',
        'createdAt'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ads Payment Report');

    // ✅ Excel Header Row
    worksheet.addRow([
      'Sr. No.',
      'Date & Time',
      'Ads ID',
      'Ads Date',
      'Ads Status',
      'Amount',
      'Payment Status'
    ]);

    let srNo = 1;
    for (const item of campaignLogs) {
      const payment = await Society_Wallet_Payment.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['payment_status', 'amount']
      });

      const createdAtFormatted = item.createdAt
        ? moment(item.createdAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '-';

      const adsDateFormatted = item.live_start_date
        ? moment(item.live_start_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '-';

      worksheet.addRow([
        srNo++,
        safeValue(createdAtFormatted),
        safeValue(item.id_prifix_campaign_ads),
        safeValue(adsDateFormatted),
        safeValue(item.campaign_status),
        safeValue(payment?.amount),
        safeValue(payment?.payment_status)
      ]);
    }

    // ✅ Excel Download Response
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=Ads_Payment_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Failed to export Ads Payment Report',
      error: error.message
    });
  }
};

exports.exportAdsPerformanceReport = async (req, res) => {
  try {
    const safeValue = (value) =>
      value === null || value === undefined || value === '' ? '-' : value;


    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    const uid = req.user.id;
    const utype = req.user_type;

    if (utype === 'Society_Admin') {
      whereClause.society_id = uid;
    } else if (utype === 'Society_User') {
      whereClause.society_id = req.user.society_id;
    }

            // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.live_start_date = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

    const campaign_log = await Campaign_Log.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id',
        'id_prifix_campaign_ads',
        'company_id',
        'campaign_id',
        'society_id',
        'creative_type',
        'campaign_type',
        'live_start_date',
        'createdAt',
        [Sequelize.literal(`(
          SELECT company_name
          FROM company_registration
          WHERE company_registration.id = "Campaign_Log".company_id
        )`), 'company_name'],
        [Sequelize.literal(`(
          SELECT sector_name
          FROM sectors
          WHERE sectors.id = CAST((
            SELECT sector
            FROM company_registration
            WHERE company_registration.id = "Campaign_Log".company_id
          ) AS INTEGER)
        )`), 'sector_name'],
        [Sequelize.literal(`(
          SELECT campaign_name
          FROM company_campaigns
          WHERE company_campaigns.id = "Campaign_Log".campaign_id
        )`), 'campaign_name']
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ads Performance Report');

    worksheet.columns = [
      { header: 'Sr. No.', key: 'sr_no', width: 10 },
      { header: 'Date & Time', key: 'created_at_formatted', width: 25 },
      { header: 'Ads ID', key: 'ads_id', width: 25 },
      { header: 'Ads Date & Time', key: 'live_start_date_formatted', width: 25 },
      { header: 'No. of View', key: 'no_view', width: 15 },
      { header: 'No. of Reactions', key: 'no_reactions', width: 20 },
      { header: 'Company Sector', key: 'sector_name', width: 25 },
      { header: 'Ads Type', key: 'campaign_type', width: 20 },
      { header: 'Creative Type', key: 'creative_type', width: 20 }
    ];

    let srNo = 1;

    for (const item of campaign_log) {
      const createdAtFormatted = moment(item.createdAt).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A');
      const liveStartDateFormatted = item.live_start_date
        ? moment(item.live_start_date).tz('Asia/Kolkata').format('DD-MM-YYYY hh:mm A')
        : '-';

      const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['no_view', 'no_reactions']
      });

      worksheet.addRow({
        sr_no: srNo++,
        created_at_formatted: safeValue(createdAtFormatted),
        ads_id: safeValue(item.id_prifix_campaign_ads),
        live_start_date_formatted: safeValue(liveStartDateFormatted),
        no_view: safeValue(ads?.no_view ?? '0'),
        no_reactions: safeValue(ads?.no_reactions ?? '0'),
        sector_name: safeValue(item.get('sector_name')),
        campaign_type: safeValue(item.campaign_type),
        creative_type: safeValue(item.creative_type)
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Ads_Performance_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 500,
      message: 'Failed to export report',
      error: error.message
    });
  }
};

exports.exportPayoutSummaryReport = async (req, res) => {
    try {
        const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

        const whereClause = {
            status: { [Op.in]: ['active', 'inactive'] }
        };

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
        }

            // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        // Apply the date filter to campaignWhereClause
        whereClause.createdAt = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }
        const records = await Society_Withdraw_Payments.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            attributes: [
                'invoice_id', 'withdraw_amount', 'description', 'payment_status',
                'paid_date', 'transaction_id', 'remark', 'createdAt',
                'modified_type', 'modified_by'
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payout Summary');

        // Header row
        worksheet.addRow([
            'Sr. No.',
            'Date & Time',
            'Invoice No.',
            'Amount',
            'Submitted By',
            'Descriptions',
            'Payment Status',
            'Paid Date',
            'Transaction ID',
            'Remark'
        ]);

        let srNo = 1;

        for (const item of records) {
            let adminName = '-';

            if (item.modified_type === 'Admin' && item.modified_by) {
                const admin = await Master_Admin.findOne({
                    where: { id: item.modified_by },
                    attributes: ['user_name']
                });
                adminName = admin ? admin.user_name : '-';
            }

            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const paidDateFormatted = item.paid_date
                ? moment(item.paid_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';

            worksheet.addRow([
                srNo++,
                safeValue(createdAtFormatted),
                safeValue(item.invoice_id),
                safeValue(item.withdraw_amount),
                safeValue(adminName),
                safeValue(item.description),
                safeValue(item.payment_status),
                safeValue(paidDateFormatted),
                safeValue(item.transaction_id),
                safeValue(item.remark)
            ]);
        }

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=Payout Summary.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            message: "Failed to export payout summary",
            error: error.message
        });
    }
};

exports.exportAdsApprovalReport = async (req, res) => {
    try {
        const safeValue = (value) =>  value === null || value === undefined || value === '' ? '-' : value;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        const uid = req.user.id;
        const utype = req.user_type;

        if (utype === 'Society_Admin') {
            whereClause.society_id = uid;
        } else if (utype === 'Society_User') {
            whereClause.society_id = req.user.society_id;
        }

                // Initialize date filter only if show_all is not true
        if (req.query.show_all !== 'true') {
            let fromDateStart, toDateEnd;

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

            // Apply the date filter to campaignWhereClause
            whereClause.live_start_date = {
                [Op.between]: [fromDateStart, toDateEnd]
            };
        }

        const campaign_log = await Campaign_Log.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'id_prifix_campaign_ads',
                'campaign_id',
                'report_status',
                'campaign_status',
                'society_approved_date',
                'approved_date_admin',
                'live_start_date',
                'completed_date',
                'cancel_date',
                'createdAt'
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Ads Approval Report');

        // ✅ Header Row
        worksheet.addRow([
            'Sr. No.',
            'Date & Time',
            'Ads ID',
            'Ads Heading',
            'Pending Date',
            'Approved Date',
            'Live Date',
            'Report Submitted (Before 24Hrs)',
            'Completed',
            'Cancelled',
            'Report Submitted (After 24Hrs)'
        ]);

        let srNo = 1;

        for (const item of campaign_log) {
            const ads = await Advertisements.findOne({
                where: { campaign_log_id: item.id },
                attributes: ['report_submited_24_before_date', 'report_submited_24_after_date']
            });

            const formatDate = (date) =>
                date ? moment(date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A') : '-';

            worksheet.addRow([
                srNo++,
                safeValue(formatDate(item.createdAt)),
                safeValue(item.id_prifix_campaign_ads),
                safeValue(item.campaign_id ? `Campaign ${item.campaign_id}` : ''),
                safeValue(formatDate(item.society_approved_date)),
                safeValue(formatDate(item.approved_date_admin)),
                safeValue(formatDate(item.live_start_date)),
                safeValue(formatDate(ads?.report_submited_24_before_date)),
                safeValue(formatDate(item.completed_date)),
                safeValue(formatDate(item.cancel_date)),
                safeValue(formatDate(ads?.report_submited_24_after_date))
            ]);
        }

        // ✅ Excel Download Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Ads_Approval_Report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 500,
            message: 'Failed to export ads approval report',
            error: error.message
        });
    }
};