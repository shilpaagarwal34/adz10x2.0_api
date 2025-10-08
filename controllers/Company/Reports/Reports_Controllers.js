const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const City = require('@models/Admin/Master/City_Model')
const Area = require('@models/Admin/Master/Area_Model')
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model')
const  Company_User = require('@models/Company/Users/Company_User_Model');
const path = require('path');
const { where, literal, Sequelize } = require('sequelize');
const { Op,fn, col } = require('sequelize');
const moment = require('moment-timezone');
const ExcelJS = require('exceljs');
const { raw } = require('express');

exports.spendReportDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const campaign_status = req.query.campaign_status;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            campaign_status: {
              [Op.in]: ['completed', 'reject', 'approved', 'pending']
            }
        };

                    // Initialize date filter only if show_all is not true
    if (req.query.show_all !== 'true') {
        let fromDateStart, toDateEnd;

        // if (req.query.from_date && req.query.to_date) {
        //     // User provided a date range
        //     fromDateStart = moment.tz(req.query.from_date, 'Asia/Kolkata').startOf('day').toDate();
        //     toDateEnd = moment.tz(req.query.to_date, 'Asia/Kolkata').endOf('day').toDate();
        // } else {
        //     // Default to current month
        //     fromDateStart = moment.tz('Asia/Kolkata').startOf('month').toDate();
        //     toDateEnd = moment.tz('Asia/Kolkata').endOf('month').toDate();
        // }

        if (req.query.from_date && req.query.to_date) {
            // Force YYYY-MM-DD format and IST timezone
            fromDateStart = moment.tz(req.query.from_date, "YYYY-MM-DD", "Asia/Kolkata").startOf('day').toDate();
            toDateEnd     = moment.tz(req.query.to_date, "YYYY-MM-DD", "Asia/Kolkata").endOf('day').toDate();
        } else {
            fromDateStart = moment.tz("Asia/Kolkata").startOf('month').toDate();
            toDateEnd     = moment.tz("Asia/Kolkata").endOf('month').toDate();
        }

        

        // Apply the date filter to campaignWhereClause
        whereClause.campaign_date = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        if (campaign_status) {
            whereClause.campaign_status = campaign_status;
        }

    
        const total = await Campaign.count({ where: whereClause });

        const campaigns = await Campaign.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id', 'campaign_name', 'company_id','id_prifix_campaign', 'campaign_date',
                'report_status', 'creative_type', 'campaign_type',
                'campaign_status', 'createdAt', 'status'
            ]
        });

        const formattedCampaigns = await Promise.all(campaigns.map(async item => {
            // ✅ Format createdAt with Date & Time in Asia/Kolkata
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            // ✅ Format campaign_date (if available)
            const campaignDateFormatted = item.campaign_date
                ? moment(item.campaign_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY')
                : '';

          const campaignLogs = await Campaign_Log.findAll({
               where: {
               campaign_id: item.id,
               [Op.or]: [
                    { refund_status: null },
                    { refund_status: { [Op.ne]: 'refund' } }
               ]
               },
               attributes: ['campaign_ads_amount']
               });

            console.log("Logs for campaign_id:", item.id, campaignLogs);


            const totalAdsAmount = campaignLogs.reduce((sum, log) => sum + Number(log.campaign_ads_amount || 0), 0);

            return {
                ...item.toJSON(),
                createdAtFormatted,
                campaignDateFormatted,
                totalAdsAmount
            };
        }));

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns',
            message: 'Campaign fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: err.message
        });
    }
};

exports.campaignReachReportDataTable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const campaign_status = req.query.campaign_status;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      },
      campaign_status: {
        [Op.in]: ['completed', 'reject', 'approved', 'pending']
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

    if (req.user_type === 'Company_Admin') {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === 'Company_User') {
      whereClause.company_id = req.user.company_id;
    }

    if (campaign_status) {
      whereClause.campaign_status = campaign_status;
    }

    const total = await Campaign_Log.count({ where: whereClause });

    const campaigns = await Campaign_Log.findAll({
      where: whereClause,
      offset,
      limit,
      order: [['id', 'DESC']],
      attributes: [
        'id','id_prifix_campaign_ads','campaign_id','society_id','company_id','company_user_id',
        'campaign_status','live_start_date','live_end_date','campaign_type','creative_type',
        'status','createdAt','updatedAt','approved_by','completed_date','cancel_date',
        'approved_date_admin','society_approved_date','report_status'
      ]
    });

    const formattedCampaigns = await Promise.all(campaigns.map(async item => {
      const createdAtFormatted = moment(item.createdAt)
        .tz('Asia/Kolkata')
        .format('dddd DD-MMMM-YYYY hh:mm A');

      const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['no_view','no_reactions'],
        raw: true,
      });

      const society = await Society_Registration.findOne({
        where: { id: item.society_id },
        attributes: ['society_name','latitude','longitude'],
        raw: true
      });

      const campaign = await Campaign.findOne({
        where: { id: item.campaign_id },
        attributes: ['campaign_name','id_prifix_campaign','campaign_city_id','campaign_area_id'],
        raw: true
      });

      let cityName = '';
      let areaName = '';

      if (campaign) {
        const city = await City.findOne({
          where: { id: campaign.campaign_city_id },
          attributes: ['city_name'],
          raw: true
        });
        const area = await Area.findOne({
          where: { id: campaign.campaign_area_id },
          attributes: ['area_name'],
          raw: true
        });

        cityName = city ? city.city_name : '';
        areaName = area ? area.area_name : '';
      }

      // const location = [cityName, areaName].filter(Boolean).join(', ');
      const locationParts = [cityName, areaName, society?.latitude, society?.longitude];
      const location = locationParts.filter(Boolean).join(', ');

      // ✅ Current Status Logic
      let currentStatus = '';
      let statusDateTime = '';
      let no_view = ads ? ads.no_view || 0 : 0;
      let no_reactions = ads ? ads.no_reactions || 0 : 0;

      if (item.campaign_status === 'reject') {
        currentStatus = 'Rejected';
        statusDateTime = item.cancel_date;
        no_view = '-';
        no_reactions = '-';
      } else {
        const now = moment().tz('Asia/Kolkata');
        let inLivePeriod = false;

        if (item.live_start_date && item.live_end_date) {
          const start = moment(item.live_start_date).tz('Asia/Kolkata');
          const end = moment(item.live_end_date).tz('Asia/Kolkata');
          inLivePeriod = now.isBetween(start, end, null, '[]');
        }

        if (inLivePeriod) {
          if (item.report_status === 'pending') {
            currentStatus = 'Report Pending';
            statusDateTime = now.toDate();
          } else if (item.report_status === 'approved') {
            currentStatus = 'Report Submitted';
            statusDateTime = now.toDate();
          } else {
            currentStatus = 'Pending';
            statusDateTime = item.updatedAt;
          }
        } else {
          if (item.campaign_status === 'completed') {
            currentStatus = 'Completed';
            statusDateTime = item.completed_date;
          } else if (item.campaign_status === 'approved') {
            if (item.approved_by === 'Admin') {
              currentStatus = 'Approved by Admin';
              statusDateTime = item.approved_date_admin;
            } else if (item.approved_by === 'Society') {
              currentStatus = 'Approved by Society';
              statusDateTime = item.society_approved_date;
            } else {
              currentStatus = 'Pending';
              statusDateTime = item.updatedAt;
            }
          } else {
            currentStatus = 'Pending';
            statusDateTime = item.updatedAt;
          }
        }
      }

      const formattedStatusDateTime = statusDateTime
        ? moment(statusDateTime).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '';

      return {
        ...item.toJSON(),
        createdAtFormatted,
        no_view,
        no_reactions,
        society_name: society ? society.society_name || '' : '',
        id_prifix_campaign: campaign ? campaign.id_prifix_campaign || '' : '',
        campaign_name: campaign ? campaign.campaign_name || '' : '',
        location,
        currentStatus,
        statusDateTime: formattedStatusDateTime
      };
    }));

    return res.status(200).json({
      status: 200,
      table_name: 'company_campaigns_logs',
      message: 'Campaign fetched successfully',
      total,
      page,
      limit,
      data: formattedCampaigns
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch campaigns",
      error: err.message
    });
  }
};

exports.walletPaymentHistoryReportDataTable = async (req, res) => {
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
        whereClause.createdAt = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }

        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        if (campaign_status) {
            whereClause.campaign_status = campaign_status;
        }

        const total = await Campaign.count({ where: whereClause });

        const campaigns = await Wallet.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id', 'amount', 'invoice_id','wallet_type', 'razorpay_order_id',
                'order_id', 'razorpay_payment_id','createdAt', 'status'
            ]
        });

        const formattedCampaigns = await Promise.all(campaigns.map(async item => {
            // ✅ Format createdAt with Date & Time in Asia/Kolkata
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            return {
                ...item.toJSON(),
                createdAtFormatted,
            };
        }));
        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns',
            message: 'Campaign fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: err.message
        });
    }
};

exports.campaignSocitylistReportDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            campaign_status: {
                [Op.in]: ['completed', 'reject', 'approved', 'pending']
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

        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        const total = await Campaign_Log.count({ where: whereClause });

        const campaigns = await Campaign_Log.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: ['id','id_prifix_campaign_ads','campaign_id','society_id','company_id','company_user_id','campaign_status','status','createdAt']
        });

        const formattedCampaigns = await Promise.all(campaigns.map(async item => {
            // ✅ Format createdAt with Date & Time in Asia/Kolkata
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');

        // ✅ Fetch Advertisement stats for this Campaign_Log
         

            const society = await Society_Registration.findOne({
                where: { id: item.society_id},
                attributes:['id','society_name','address'],
                raw:true
            });

            const campaign = await Campaign.findOne({
                where: {  id: item.campaign_id},
                attributes: ['campaign_name','id_prifix_campaign','campaign_city_id','campaign_area_id','my_ads_location_longitude','my_ads_location_latitude'],
                raw: true
            });
         // ✅ Fetch City & Area Names
            let cityName = '';
            let areaName = '';

            if (campaign) {
                const city = await City.findOne({
                    where: { id: campaign.campaign_city_id },
                    attributes: ['city_name'],
                    raw: true
                });
                const area = await Area.findOne({
                    where: { id: campaign.campaign_area_id },
                    attributes: ['area_name'],
                    raw: true
                });

                cityName = city ? city.city_name : '';
                areaName = area ? area.area_name : '';
            }

            const location = [cityName, areaName].filter(Boolean).join(', ');

            //     (campaign && campaign.my_ads_location_latitude && campaign.my_ads_location_longitude)
            //         ? `${campaign.my_ads_location_latitude}, ${campaign.my_ads_location_longitude}`
            //         : ''
            // ].filter(Boolean).join(' , ');

            return {
                ...item.toJSON(),
                createdAtFormatted,
                society_name: society.society_name || '',
                society_address: society.address || '',
                id_prifix_campaign: campaign.id_prifix_campaign || '',
                location
            };
        }));

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns_logs',
            message: 'Campaign fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch campaigns",
            error: err.message
        });
    }
};

exports.userReportDataTable = async (req, res) => {
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

        // ✅ Filter by user company
        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        const total = await Company_User.count({ where: whereClause });

        const users = await Company_User.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
        });

        // ✅ Format Result
        const formattedUsers = users.map(item => {
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const loginDateTime = item.login_date_time
                ? moment(item.login_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';

            const logoutDateTime = item.logout_date_time
                ? moment(item.logout_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';

            const activityDetails = `Login: ${loginDateTime} | Logout: ${logoutDateTime}`;

            return {
                date_time: createdAtFormatted,
                user_id: item.id_prifix_company_user || item.id,
                user_name: item.user_name,
                activity_details: activityDetails
            };
        });

        return res.status(200).json({
            status: 200,
            table_name: 'company_user',
            message: 'User Report fetched successfully',
            total,
            page,
            limit,
            data: formattedUsers
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: 500,
            message: "Failed to fetch user report",
            error: err.message
        });
    }
};

exports.exportSpendReport = async (req, res) => {
  try {
    const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

    
        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            campaign_status: {
              [Op.in]: ['completed', 'reject', 'approved', 'pending']
            }
        };

    if (req.user_type === 'Company_Admin') {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === 'Company_User') {
      whereClause.company_id = req.user.company_id;
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

    const campaigns = await Campaign.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id', 'campaign_name', 'company_id','id_prifix_campaign', 'campaign_date',
        'report_status', 'creative_type', 'campaign_type',
        'campaign_status', 'createdAt', 'status'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Spend Report');

    worksheet.addRow([
      'Date & Time',
      'Campaign ID',
      'Campaign Date',
      'Campaign Status',
      'Amount'
    ]);

    for (const item of campaigns) {
      const createdAtFormatted = item.createdAt
        ? moment(item.createdAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '-';

      const campaignDateFormatted = item.campaign_date
        ? moment(item.campaign_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY')
        : '-';

      const campaignLogs = await Campaign_Log.findAll({
        where: {
          campaign_id: item.id,
          [Op.or]: [
            { refund_status: null },
            { refund_status: { [Op.ne]: 'refund' } }
          ]
        },
        attributes: ['campaign_ads_amount']
      });

      const totalAdsAmount = campaignLogs.reduce((sum, log) => sum + Number(log.campaign_ads_amount || 0), 0);

      worksheet.addRow([
        safeValue(createdAtFormatted),
        safeValue(item.id_prifix_campaign),
        safeValue(campaignDateFormatted),
        safeValue(item.campaign_status),
        safeValue(totalAdsAmount.toFixed(2))
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=Spend_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Spend Report',
      error: err.message
    });
  }
};

exports.exportCampaignReachReport = async (req, res) => {
  try {
    const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      },
      campaign_status: {
        [Op.in]: ['completed', 'reject', 'approved', 'pending']
      }
    };

    if (req.user_type === 'Company_Admin') {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === 'Company_User') {
      whereClause.company_id = req.user.company_id;
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

    const campaigns = await Campaign_Log.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id', 'id_prifix_campaign_ads', 'campaign_id', 'society_id', 'company_id',
        'company_user_id', 'campaign_status', 'campaign_type', 'creative_type',
        'status', 'createdAt', 'updatedAt', 'approved_by', 'completed_date',
        'cancel_date', 'approved_date_admin', 'society_approved_date',
        'live_start_date', 'live_end_date', 'report_status'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Campaign Reach Report');

    // ✅ Excel Header Row
    worksheet.addRow([
      'Date & Time',
      'Campaign ID',
      'Location',
      'Society Name',
      'Ads Heading',
      'Ads Type',
      'Creative Type',
      'No. of View',
      'No. of Reactions',
      'Current Status',
      'Status Date & Time'
    ]);

    for (const item of campaigns) {
      const createdAtFormatted = moment(item.createdAt)
        .tz('Asia/Kolkata')
        .format('dddd DD-MMMM-YYYY hh:mm A');

      const ads = await Advertisements.findOne({
        where: { campaign_log_id: item.id },
        attributes: ['no_view', 'no_reactions'],
        raw: true
      });

      const society = await Society_Registration.findOne({
        where: { id: item.society_id },
        attributes: ['society_name','latitude','longitude'],
        raw: true
      });

      const campaign = await Campaign.findOne({
        where: { id: item.campaign_id },
        attributes: [
          'campaign_name', 'id_prifix_campaign', 'campaign_city_id',
          'campaign_area_id', 'my_ads_location_longitude', 'my_ads_location_latitude'
        ],
        raw: true
      });

      let cityName = '';
      let areaName = '';

      if (campaign) {
        const city = await City.findOne({
          where: { id: campaign.campaign_city_id },
          attributes: ['city_name'],
          raw: true
        });
        const area = await Area.findOne({
          where: { id: campaign.campaign_area_id },
          attributes: ['area_name'],
          raw: true
        });

        cityName = city ? city.city_name : '';
        areaName = area ? area.area_name : '';
      }

      // const location = [cityName, areaName].filter(Boolean).join(', ');
      const locationParts = [cityName, areaName, society?.latitude, society?.longitude];
      const location = locationParts.filter(Boolean).join(', ');

      // ✅ Current Status Logic
      let currentStatus = '';
      let statusDateTime = '';
      let no_view = ads ? ads.no_view || 0 : 0;
      let no_reactions = ads ? ads.no_reactions || 0 : 0;

      if (item.campaign_status === 'reject') {
        currentStatus = 'Rejected';
        statusDateTime = item.cancel_date;
        no_view = '-';
        no_reactions = '-';
      } else {
        const now = moment().tz('Asia/Kolkata');
        let inLivePeriod = false;

        if (item.live_start_date && item.live_end_date) {
          const start = moment(item.live_start_date).tz('Asia/Kolkata');
          const end = moment(item.live_end_date).tz('Asia/Kolkata');
          inLivePeriod = now.isBetween(start, end, null, '[]');
        }

        if (inLivePeriod) {
          if (item.report_status === 'pending') {
            currentStatus = 'Report Pending';
            statusDateTime = now.toDate();
          } else if (item.report_status === 'approved') {
            currentStatus = 'Report Submitted';
            statusDateTime = now.toDate();
          } else {
            currentStatus = 'Pending';
            statusDateTime = item.updatedAt;
          }
        } else {
          if (item.campaign_status === 'completed') {
            currentStatus = 'Completed';
            statusDateTime = item.completed_date;
          } else if (item.campaign_status === 'approved') {
            if (item.approved_by === 'Admin') {
              currentStatus = 'Approved by Admin';
              statusDateTime = item.approved_date_admin;
            } else if (item.approved_by === 'Society') {
              currentStatus = 'Approved by Society';
              statusDateTime = item.society_approved_date;
            } else {
              currentStatus = 'Pending';
              statusDateTime = item.updatedAt;
            }
          } else {
            currentStatus = 'Pending';
            statusDateTime = item.updatedAt;
          }
        }
      }

      const formattedStatusDateTime = statusDateTime
        ? moment(statusDateTime).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : '-';

      worksheet.addRow([
        safeValue(createdAtFormatted),
        safeValue(campaign?.id_prifix_campaign),
        safeValue(location),
        safeValue(society?.society_name),
        safeValue(campaign?.campaign_name),
        safeValue(item.campaign_type),
        safeValue(item.creative_type),
        safeValue(no_view),
        safeValue(no_reactions),
        safeValue(currentStatus),
        safeValue(formattedStatusDateTime)
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=Campaign_Reach_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Campaign Reach Report',
      error: err.message
    });
  }
};

exports.exportWalletPaymentHistoryReport = async (req, res) => {
  try {
    const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    if (req.user_type === 'Company_Admin') {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === 'Company_User') {
      whereClause.company_id = req.user.company_id;
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

    const campaigns = await Wallet.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id', 'amount', 'invoice_id','wallet_type', 'razorpay_order_id',
        'order_id', 'razorpay_payment_id', 'createdAt', 'status'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Wallet Payment Report');

    // ✅ Excel Header Row
    worksheet.addRow([
      'Date & Time',
      'Payment ID',
      'Type',
      'Transaction ID',
      'Amount',
      'Receipt ID'
    ]);

    for (const item of campaigns) {
      const createdAtFormatted = moment(item.createdAt)
        .tz('Asia/Kolkata')
        .format('dddd DD-MMMM-YYYY hh:mm A');

      worksheet.addRow([
        safeValue(createdAtFormatted),
        safeValue(item.razorpay_payment_id),
        safeValue(item.wallet_type),
        safeValue(item.razorpay_order_id),
        safeValue(item.amount),
        safeValue(item.invoice_id)
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Wallet_Payment_Report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Wallet Payment Report',
      error: err.message
    });
  }
};

exports.exportCampaignSocietyListReport = async (req, res) => {
  try {
    const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    if (req.user_type === 'Company_Admin') {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === 'Company_User') {
      whereClause.company_id = req.user.company_id;
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
    const campaigns = await Campaign_Log.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
      attributes: [
        'id', 'id_prifix_campaign_ads', 'campaign_id', 'society_id',
        'company_id', 'company_user_id', 'createdAt', 'status','campaign_status'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Campaign Society Report');

    // ✅ Excel Header Row
    worksheet.addRow([
      'Campaign ID',
      'Location',
      'Society List',
      'Ads Status'
    ]);

    for (const item of campaigns) {
      const campaign = await Campaign.findOne({
        where: { id: item.campaign_id },
        attributes: [
          'campaign_name', 'id_prifix_campaign', 'campaign_city_id',
          'campaign_area_id', 'my_ads_location_longitude', 'my_ads_location_latitude'
        ],
        raw: true
      });

      let cityName = '';
      let areaName = '';

      if (campaign) {
        const city = await City.findOne({
          where: { id: campaign.campaign_city_id },
          attributes: ['city_name'],
          raw: true
        });
        const area = await Area.findOne({
          where: { id: campaign.campaign_area_id },
          attributes: ['area_name'],
          raw: true
        });

        cityName = city ? city.city_name : '';
        areaName = area ? area.area_name : '';
      }

      const location = [cityName, areaName].filter(Boolean).join(', ');

      const society = await Society_Registration.findOne({
        where: { id: item.society_id },
        attributes: ['society_name', 'address'],
        raw: true
      });

      const societyDetails = society
        ? `${society.society_name}`
        : '';

      worksheet.addRow([
        safeValue(campaign?.id_prifix_campaign),
        safeValue(location),
        safeValue(societyDetails),
        safeValue(item.campaign_status)
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Campaign_Society_Report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Campaign Society Report',
      error: err.message
    });
  }
};

exports.exportuserReportDataTable = async (req, res) => {
    try {
        const safeValue = (value) => value === null || value === undefined || value === '' ? '-' : value;

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

        // ✅ Filter by company
        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        const users = await Company_User.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('User Report');

        // ✅ Add Header Row
        worksheet.addRow(['Date & Time', 'User ID', 'User Name', 'Activity Details']);

        // ✅ Add Data Rows
        users.forEach(item => {
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');
            const loginDateTime = item.login_date_time
                ? moment(item.login_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';
            const logoutDateTime = item.logout_date_time
                ? moment(item.logout_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';
            const activityDetails = `Login: ${loginDateTime} | Logout: ${logoutDateTime}`;

            worksheet.addRow([
            safeValue(createdAtFormatted),
            safeValue(item.id_prifix_company_user || item.id),
            safeValue(item.user_name),
            safeValue(activityDetails)
            ]);
        });

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', 'attachment; filename=User_Report.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: 500,
            message: "Failed to export User Report",
            error: err.message
        });
    }
};
