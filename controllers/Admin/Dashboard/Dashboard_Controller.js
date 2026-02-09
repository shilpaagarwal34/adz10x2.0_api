const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('../../../models/Company/Campaign/Campaign_Log_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const path = require('path');
const sequelize = require('@config/db');
const { Op, fn, col, where, literal, NUMBER,Sequelize, cast } = require('sequelize');
const moment = require('moment-timezone');


exports.dashboardCountAdmin = async (req, res) => {
  try {
    const { privileges, isSuperAdmin, role_name, id: userId } = req.user;

    // Permission check
    if (!isSuperAdmin && !privileges.includes("dashboard_view")) {
      return res.status(403).json({
        status: 403,
        message: "Sorry, You Have No Permission For This Request",
      });
    }

    // Base conditions
    let societyWhere = { status: "active" };
    let campaignWhere = { status: "active" };
    let companyWhere = { status: "active" };

    // If RM, restrict to their assigned records
    let rmCompanyIds = [];
    if (role_name === "RELATIONSHIP MANAGER") {
      societyWhere.relationship_manager_id = userId;
      companyWhere.relationship_manager_id = userId;

      // Only count approved societies & companies for RM
      societyWhere.kyc_status = "approved";
      companyWhere.kyc_status = "approved";

      // Get all company IDs under this RM
      const rmCompanies = await Company_Registration.findAll({
        attributes: ["id"],
        where: companyWhere,
      });
      rmCompanyIds = rmCompanies.map(c => c.id);

      // Restrict campaigns to only RM's companies
      if (rmCompanyIds.length > 0) {
        campaignWhere.company_id = { [Op.in]: rmCompanyIds };
      } else {
        campaignWhere.company_id = null; // no companies assigned → no campaigns
      }
    }

    // ✅ Societies & Companies counts
    const totalSocieties = await Society_Registration.count({ where: societyWhere });
    const totalCompanies = await Company_Registration.count({ where: companyWhere });

    // ✅ Campaign counts (exclude deleted companies)
    const totalCampaigns = await Campaign.count({
      where: {
        ...campaignWhere,
        campaign_status: { [Op.ne]: 'draft' },
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        }
      },
    });

    // ✅ Campaigns awaiting admin approval (exclude deleted companies)
    const totalCampaignAdmin = await Campaign.count({
      where: {
        ...campaignWhere,
        campaign_status: "pending",
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        },
      },
    });

    // // ✅ Pending society campaigns (already checks active companies)
    // const totalCampaignSociety = await Campaign_Log.count({
    //   where: {
    //     status: "active",
    //     campaign_status: "pending",
    //     admin_approved_status: "approved",
    //     ...(rmCompanyIds.length > 0 ? { company_id: { [Op.in]: rmCompanyIds } } : {}),
    //   },
    // });

        const totalCampaignSociety = await Campaign_Log.count({
      where: {
        status: "active",
        campaign_status: "pending",
        admin_approved_status: "approved",
        ...(rmCompanyIds.length > 0 ? { company_id: { [Op.in]: rmCompanyIds } } : {}),
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        }
      },
    });

    // ✅ Live campaigns (exclude deleted companies)
    const currentIST = moment.tz("Asia/Kolkata").toDate();
    const liveCampaignLogs = await Campaign_Log.findAll({
      where: {
        live_start_date: { [Op.lte]: currentIST },
        live_end_date: { [Op.gte]: currentIST },
        ...(rmCompanyIds.length > 0 ? { company_id: { [Op.in]: rmCompanyIds } } : {}),
      },
    });
    const liveCampaignIds = liveCampaignLogs.map(log => log.campaign_id);

    const totalCampaignLive = await Campaign.count({
      where: {
        ...campaignWhere,
        campaign_status: "approved",
        id: { [Op.in]: liveCampaignIds },
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        }
      },
    });

    // ✅ Completed campaigns (exclude deleted companies)
    const totalCampaignCompleted = await Campaign.count({
      where: {
        ...campaignWhere,
        campaign_status: "completed",
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        }
      },
    });

    // ✅ Payments & Wallets
    const totalCampaignPayments = await Campaign.sum("campaign_amount", {
      where: {
        status: "active",
        campaign_status: "completed",
        company_id: {
          [Op.in]: Sequelize.literal(`(
            SELECT id FROM company_registration
            WHERE status != 'delete'
          )`)
        }
      },
    });

    const totalSocietyPayments = await Society_Wallet_Payment.sum("amount", {
      where: { status: "active", wallet_type: "credit" },
    });

    const totalSocietyPaid = await Society_Withdraw_Payments.sum("withdraw_amount", {
      where: { status: "active", payment_status: "approved" },
    });

    const totalRevenue_Earnings = await Wallet.sum("amount", {
      where: { status: "active", wallet_type: "credit", 
                refund_status: {
                    [Op.ne]: "refund"
                  }
                },
    });

    // ✅ Total Wallet Amount (active & approved companies)
    const result = await sequelize.query(
      `
        SELECT COALESCE(SUM(CAST(wallet_amount AS NUMERIC)), 0) AS total_wallet_amount
        FROM "company_registration"
        WHERE status = :status AND kyc_status = :kyc_status
      `,
      {
        replacements: { status: 'active', kyc_status: 'approved' },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const totalWalletAmount = parseFloat(result[0].total_wallet_amount) || 0;

    // ✅ Derived metrics
    const totalPlatforms_ActualEarning = (totalCampaignPayments || 0) - (totalSocietyPayments || 0);
    const totalSocietyPending = (totalSocietyPayments || 0) - (totalSocietyPaid || 0);

    // ✅ Response
    return res.status(200).json({
      status: 200,
      message: "Dashboard counts fetched successfully",
      data: {
        totalSocieties,
        totalCompanies,
        totalCampaigns,
        totalCampaignAdmin,
        totalCampaignSociety,
        totalCampaignLive,
        totalCampaignCompleted,
        totalCampaignPayments,
        totalSocietyPayments,
        totalSocietyPaid,
        totalSocietyPending,
        totalRevenue_Earnings,
        totalPlatforms_ActualEarning,
        totalWalletAmount,
      },
    });

  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch dashboard counts",
      error: error.message,
    });
  }
};


exports.liveDataTableAdmin = async (req, res) => {
  try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { company_id, city_id, area_id, search, campaign_status } = req.query;
       const { isSuperAdmin, role_name, id: userId } = req.user;

      // Base where clause (common filters only)
      const baseWhereClause = {
          status: {
              [Op.in]: ['active', 'inactive']
          }
      };

      if (company_id) baseWhereClause.company_id = company_id;

            // Add RM filter if user is Relationship Manager
      if (!isSuperAdmin && role_name === 'RELATIONSHIP MANAGER') {
            baseWhereClause.company_id = {
                [Op.in]: Sequelize.literal(`(
                SELECT id FROM company_registration 
                WHERE relationship_manager_id = ${userId}
                )`)
            };
        }

      // Main where clause (includes dynamic filters like campaign_status and search)
      const whereClause = { ...baseWhereClause };
      const currentIST = moment.tz('Asia/Kolkata').toDate();
    // If 'live' status is selected
    if (campaign_status === 'live') {
     
      const liveCampaignLogs = await Campaign_Log.findAll({
        where: {
          status: { [Op.ne]: 'delete' },
          live_start_date: { [Op.lte]: currentIST },
          live_end_date: { [Op.gte]: currentIST }
        }
      });

      // Get campaign_ids from live campaigns
      const campaignIds = liveCampaignLogs.map(log => log.campaign_id);
    
      // Modify whereClause to include only those campaigns that are approved and within live window
      whereClause.campaign_status = 'approved'; // Only 'approved' campaigns
      whereClause.id = { [Op.in]: campaignIds }; // Filter by campaign_id from Campaign_Log
    } 

      if (search) {
        whereClause[Op.or] = [
            literal(`CAST("Campaign"."id" AS TEXT) ILIKE '%${search}%'`),
            { campaign_type: { [Op.iLike]: `%${search}%` } },
            { id_prifix_campaign: { [Op.iLike]: `%${search}%` } },
            { creative_type: { [Op.iLike]: `%${search}%` } },
            { campaign_name: { [Op.iLike]: `%${search}%` } },

            // Search by created date in format '15 May 2025'
            literal(`TO_CHAR("Campaign"."createdAt", 'DD Mon YYYY') ILIKE '%${search}%'`),

            // Search by created date in format '15 May 2025' full month name
            literal(`TO_CHAR("Campaign"."createdAt", 'DD Month YYYY') ILIKE '%${search}%'`),

            // Search by campaign date in format '19-05-2025'
            literal(`TO_CHAR("Campaign"."campaign_date", 'DD-MM-YYYY') ILIKE '%${search}%'`),

            // Search by company name
            literal(`(
                SELECT "company_name"
                FROM "company_registration"
                WHERE "company_registration"."id" = "Campaign"."company_id"
            ) ILIKE '%${search}%'`)
        ];
    }

      // Count total with filters
      const total = await Campaign.count({ where: whereClause });

       // Set timezone for live count
       const timezone = 'Asia/Kolkata';
 
       // Use currentIST again for accurate count
      const liveCampaignLogsForCount = await Campaign_Log.findAll({
          where: {
              live_start_date: { [Op.lte]: currentIST },
              live_end_date: { [Op.gte]: currentIST }
          }
      });
 
       // Get campaign_ids from live campaigns
      //  const liveCampaignIds = liveCampaignLogs.map(log => log.campaign_id);
       const liveCampaignIdsForCount = liveCampaignLogsForCount.map(log => log.campaign_id);


       // RM Code start
           const liveWhere = {
                    ...baseWhereClause,
                    campaign_status: 'approved',
                    id: { [Op.in]: liveCampaignIdsForCount }
                };

                // Apply RM filter to live count also
                if (!isSuperAdmin && role_name === 'RELATIONSHIP MANAGER') {
                liveWhere.company_id = {
                        [Op.in]: Sequelize.literal(`(
                        SELECT id FROM company_registration 
                        WHERE relationship_manager_id = ${userId}
                        )`)
                    };
                }
            const liveCount = await Campaign.count({ where: liveWhere });
        // RM Code end

      const campaign = await Campaign.findAll({
          where: whereClause,
          offset,
          limit,
          order: [['id', 'DESC']],
          attributes: [
              'id', 'campaign_name','id_prifix_campaign', 'company_id', 'campaign_date',
              'creative_type', 'campaign_type', 'campaign_status',
              'createdAt', 'status',
              [Sequelize.literal(`(
                  SELECT "company_name"
                  FROM "company_registration"
                  WHERE "company_registration"."id" = "Campaign"."company_id"
              )`), 'company_name'],
              [Sequelize.literal(`TO_CHAR("Campaign"."campaign_date", 'DD-MM-YYYY')`), 'campaign_date'],
               // Add formatted createdAt
              [Sequelize.literal(`TO_CHAR("Campaign"."createdAt", 'FMDay DD-Mon-YYYY')`), 'createdAtFormatted']
          ]
      });

      return res.status(200).json({
          status: 200,
          table_name: 'company_campaigns',
          message: 'Campaign fetched successfully',
          total,
          page,
          limit,
          liveCount,
          data: campaign
      });
  } catch (err) {
      res.status(500).json({
          status: 500,
          message: "Failed to fetch campaigns",
          error: err.message
      });
  }
};
