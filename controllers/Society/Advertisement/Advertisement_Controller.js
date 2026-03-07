const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Ads_Slot = require('@models/Society/Auth/Society_Ads_Slot_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Notification = require('@models/Notifications/Notification_Model');
const path = require('path');
const { where, literal, Sequelize } = require('sequelize');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const {
  normalizeMediaType,
  getMediaPlatformConfig,
} = require('@helper/mediaRateHelper');
const AWS = require('aws-sdk');
const ses = new AWS.SES({ apiVersion: '2010-12-01' });

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

const getMinActiveDaysForMediaType = async (mediaType) => {
  const normalizedMediaType = normalizeMediaType(mediaType);
  const defaults = getMediaPlatformConfig(normalizedMediaType);

  const campaignConfig = await Campaign_Configuration.findOne({
    attributes: ['platform_rules'],
    where: { status: 'active' },
    order: [['createdAt', 'ASC']],
  });

  const configured = campaignConfig?.platform_rules?.[normalizedMediaType] || {};
  const configuredDays = Number(configured.min_active_days);
  const fallbackDays = Number(defaults.min_active_days || defaults.duration_days || 1);

  if (Number.isFinite(configuredDays) && configuredDays > 0) {
    return configuredDays;
  }
  return Number.isFinite(fallbackDays) && fallbackDays > 0 ? fallbackDays : 1;
};

exports.getSocietyProfileSlotAdvertisement = async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          status: 400,
          message: "Society ID is required",
        });
      }   
  
      // Fetch ads slots for the society with active status
    const ads_slots = await Ads_Slot.findAll({ 
      where: {society_id:id, status: 'active' } ,
      attributes:['society_id','days','from_time','to_time']
    });

      return res.status(200).json({
        status: 200,
        message: "Ads slots fetched successfully",
        data: ads_slots
      });
  
    } catch (error) {
      return res.status(500).json({
        status: 500,
        message: "Something went wrong",
        error: error.message
      });
    }
};

exports.viewAdvertisement = async (req, res) => {
    try {
        const { id } = req.params; // Campaign log ID

        if (!id) {
            return res.status(400).json({
                status: 400,
                message: 'Campaign log ID is required',
            });
        }
             
          // Fetch campaign with ownership check
          const campaign_logs = await Campaign_Log.findOne({
               where: { id: id, status: 'active' } // if applicable
          });

         if (!campaign_logs) {
            return res.status(404).json({
                status: 404,
                message: 'campaign logs not found or access denied',
            });
        }

          const  campaign = await Campaign.findOne({
                where: { id: campaign_logs.campaign_id }
            });
        
         // Fetch advertisement with ownership check
         const society = await Society_Registration.findOne({
          where: { id: campaign_logs.society_id } // if applicable
        });

        const rel_manager = await Master_Admin.findOne({
           where: { id:society.relationship_manager_id },
           attributes:['user_name','mobile_no','role_name']
        });

        const society_profile = await Society_Profile.findOne({
          where: { society_id: society.id, status: 'active' } // if applicable
    
        });

        // Fetch advertisement with ownership check
        const advertisement = await Advertisements.findOne({
          where: { campaign_log_id: campaign_logs.id, status: 'active' } // if applicable
        });

          // Fetch advertisement with ownership check
        const company = await Company_Registration.findOne({
          where: { id: campaign.company_id, status: 'active' }, // if applicable
          attributes:['id','company_name','id_prifix_company','name','company_profile_photo_path','company_profile_photo_name','address_line_1','address_line_2']
        });

        let modified_by_name = null;

        if (campaign_logs.modified_by && campaign_logs.modified_type) {
          if (campaign_logs.modified_type === 'Admin') {
            const adminUser = await Master_Admin.findOne({ where: { id: campaign_logs.modified_by } });
            if (adminUser) modified_by_name = adminUser.user_name;
          } else if (campaign_logs.modified_type === 'Society_User') {

            const societyUsers = await Society_User.findOne({ where: { id: campaign_logs.modified_by } });
            if (societyUsers) modified_by_name = societyUsers.user_name;
          } else if (campaign_logs.modified_type === 'Society_Admin') {
            const societyUser = await Society_Registration.findOne({ where: { id: campaign_logs.modified_by } });
            if (societyUser) modified_by_name = societyUser.name;
          }
        }

        const formattedUpdatedAt = campaign_logs.updatedAt
          ? moment(campaign_logs.updatedAt).format('D MMM YYYY h:mma')  // Output: 6 May 2025 1:10pm
          : null;

           const formattedcampaign_date = campaign.campaign_date
          ? moment(campaign.campaign_date).format('D MMM YYYY h:mma')  // Output: 6 May 2025 1:10pm
          : null;

          const formatted_approved_date = campaign_logs.approved_date
           ? moment(campaign_logs.approved_date).format('D MMM YYYY H:mma')
           : null;

          const formatted_admin_approved_date = campaign_logs.approved_date_admin
           ? moment(campaign_logs.approved_date_admin).format('D MMM YYYY H:mma')
           : null;

          const formatted_society_approved_date = campaign_logs.society_approved_date
           ? moment(campaign_logs.society_approved_date).format('D MMM YYYY H:mma')
           : null;

            const formatted_cancel_date = campaign_logs.cancel_date
           ? moment(campaign_logs.cancel_date).format('D MMM YYYY H:mma')
           : null;

          let approved_by = '';

          if (campaign_logs.society_approved_status === null || campaign_logs.society_approved_status === '' || campaign_logs.society_approved_status === 'pending') {
              if (campaign_logs.admin_approved_status === 'approved') {
                  approved_by = 'Admin';
              }
          } else if (campaign_logs.admin_approved_status === 'approved' && campaign_logs.society_approved_status === 'approved') {
              approved_by = 'Society';
          }

          let cancelled_by = ''; 

          if (campaign_logs.admin_approved_status === 'reject') {
              cancelled_by = 'Admin';
          } else if (campaign_logs.society_approved_status === 'reject') {
              cancelled_by = 'Society';
          }

          campaign_logs.setDataValue('updatedAtFormatted', formattedUpdatedAt);
          campaign_logs.setDataValue('modified_by_name', modified_by_name);
          campaign_logs.setDataValue('approved_date',formatted_approved_date);
          campaign_logs.setDataValue('admin_approved_date',formatted_admin_approved_date);
          campaign_logs.setDataValue('society_approved_date',formatted_society_approved_date);
          campaign_logs.setDataValue('cancel_date',formatted_cancel_date);
          // campaign_logs.setDataValue('approved_by', approved_by),
          campaign_logs.setDataValue('cancelled_by', cancelled_by),
          campaign.setDataValue('formatted_campaign_date', formattedcampaign_date);
          

        return res.status(200).json({
            status: 200,
            message: 'Campaign Log fetched successfully',
            data: {
              // rel_manager,
               rel_managers:{
                  name:rel_manager.user_name,
                  designation:rel_manager.role_name,
                  mobile_no:rel_manager.mobile_no
               },
               society,
               campaign,
               society_profile,
               campaign_logs,
               advertisement,
               company,
               
            }
        });

    } catch (error) {
        console.error('Error fetching campaign:', error);
        return res.status(500).json({
            status: 500,
            message: 'Internal server error',
            error: error.message
        });
    }
};

exports.advertisementDataTable = async (req, res) => {
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

        // if (search) {
        //     whereClause[Op.or] = [
        //         literal(`CAST("id" AS TEXT) ILIKE '%${search}%'`),
        //         { campaign_type: { [Op.iLike]: `%${search}%` } },
        //         { id_prifix_campaign_ads: { [Op.iLike]: `%${search}%` } },
        //         { creative_type: { [Op.iLike]: `%${search}%` } },
        //         literal(`TO_CHAR("createdAt", 'YYYY-MM-DD') ILIKE '%${search}%'`) ,
        //                   // Search by campaign name
        //         literal(`(
        //             SELECT "campaign_name"
        //             FROM "company_campaigns"
        //             WHERE "company_campaigns"."id" = "Campaign_Log"."campaign_id"
        //         ) ILIKE '%${search}%'`)
        //         ];
        //   }


      if (search) {
          whereClause[Op.or] = [
              literal(`CAST("Campaign_Log"."id" AS TEXT) ILIKE '%${search}%'`),
              { campaign_type: { [Op.iLike]: `%${search}%` } },
              { id_prifix_campaign_ads: { [Op.iLike]: `%${search}%` } },
              { creative_type: { [Op.iLike]: `%${search}%` } },
              literal(`TO_CHAR("Campaign_Log"."createdAt", 'YYYY-MM-DD') ILIKE '%${search}%'`),
              where(
                  literal(`(
                      SELECT "campaign_name"
                      FROM company_campaigns
                      WHERE company_campaigns.id = "Campaign_Log".campaign_id
                  )`),
                  {
                      [Op.iLike]: `%${search}%`
                  }
              )
          ];
      }


        const currentIST = moment.tz('Asia/Kolkata').toDate();
        const liveWindowWhere = {
            status: { [Op.in]: ['active', 'inactive'] },
            ...(utype === 'Society_Admin' && { society_id: uid }),
            ...(utype === 'Society_User' && { society_id: req.user.society_id }),
            live_start_date: { [Op.lte]: currentIST },
            live_end_date: { [Op.gte]: currentIST }
        };

        const liveCampaignLogs = await Campaign_Log.findAll({
            where: liveWindowWhere,
            attributes: ['id']
        });
        const liveCampaignLogIds = liveCampaignLogs.map((log) => log.id);

        const endedLiveLogs = await Campaign_Log.findAll({
            where: {
                status: { [Op.in]: ['active', 'inactive'] },
                ...(utype === 'Society_Admin' && { society_id: uid }),
                ...(utype === 'Society_User' && { society_id: req.user.society_id }),
                campaign_status: 'approved',
                live_end_date: { [Op.lt]: currentIST }
            },
            attributes: ['id']
        });
        const completedByTimeLogIds = endedLiveLogs.map((log) => log.id);
        const approvedExcludedIds = [...new Set([...liveCampaignLogIds, ...completedByTimeLogIds])];

        if (campaign_status === 'live') {
            whereClause.campaign_status = 'approved';
            whereClause.id = liveCampaignLogIds.length
                ? { [Op.in]: liveCampaignLogIds }
                : -1;
          } else if (campaign_status === 'approved') {
              whereClause.campaign_status = 'approved';
              whereClause.society_approved_status = 'approved';
              if (approvedExcludedIds.length) {
                  whereClause.id = { [Op.notIn]: approvedExcludedIds };
              }
          } else if (campaign_status === 'pending') {
              whereClause.campaign_status = 'pending';
              whereClause.admin_approved_status = 'approved';
          } else if (campaign_status === 'reject') {
              whereClause.campaign_status = 'reject';
          } else if (campaign_status === 'completed') {
              whereClause[Op.and] = [
                  ...(whereClause[Op.and] || []),
                  {
                      [Op.or]: [
                          { campaign_status: 'completed' },
                          {
                              campaign_status: 'approved',
                              id: completedByTimeLogIds.length
                                  ? { [Op.in]: completedByTimeLogIds }
                                  : -1
                          }
                      ]
                  }
              ];
          }

        const liveCount = await Campaign_Log.count({
            where: {
                id: liveCampaignLogIds.length ? { [Op.in]: liveCampaignLogIds } : -1,
                campaign_status: 'approved',
                status: { [Op.in]: ['active', 'inactive'] },
                society_id: societyId,
            }
        });

        const approvedCount = await Campaign_Log.count({
            where: {
                // ...whereClause,
                campaign_status: 'approved',
                society_approved_status: 'approved',
                society_id: societyId,
                ...(approvedExcludedIds.length ? { id: { [Op.notIn]: approvedExcludedIds } } : {})
            }
        });

        const pendingCount = await Campaign_Log.count({
            where: {
                // ...whereClause,
                campaign_status: 'pending',
                admin_approved_status:"approved",
                society_id: societyId,
            }
        });

        const cancelledCount = await Campaign_Log.count({
            where: {
                // ...whereClause,
                campaign_status: 'reject',
                society_id: societyId,
            }
        });

        const completedCount = await Campaign_Log.count({
            where: {
                status: { [Op.in]: ['active', 'inactive'] },
                society_id: societyId,
                [Op.or]: [
                    { campaign_status: 'completed' },
                    {
                        campaign_status: 'approved',
                        id: completedByTimeLogIds.length
                            ? { [Op.in]: completedByTimeLogIds }
                            : -1
                    }
                ]
            }
        });

        const total = await Campaign_Log.count({ where: whereClause });

        const campaign_log = await Campaign_Log.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id',
                'id_prifix_campaign_ads',
                'campaign_id',
                'society_id',
                'creative_type',
                'report_status',
                'campaign_type',
                'campaign_status',
                'admin_approved_status',
                'society_approved_status',
                'slot_start_time',
                'slot_end_time',
                'live_start_date',
                'live_end_date',
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

        const formattedCampaigns = campaign_log.map(item => {
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

            const startTimeFormatted = formatISTTime(item.slot_start_time);
            const endTimeFormatted = formatISTTime(item.slot_end_time);

            return {
                ...item.toJSON(),
                createdAtFormatted: `${dayName} ${day}-${month} ${year}`,
                slot_start_time: startTimeFormatted,
                slot_end_time: endTimeFormatted
                // campaign: campaignMap[item.campaign_id] || null
            };
        });

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns_logs',
            message: 'Campaign log fetched successfully',
            total,
            page,
            limit,
            approvedCount,
            liveCount,
            pendingCount,
            cancelledCount,
            completedCount,
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

exports.campaignDataTableSocietyCampinwise = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { company_id, city_id, area_id, search, campaign_status } = req.query;

    const uid = req.user.id;
    const utype = req.user_type;

    let society_id = null;
    if (utype === 'Society_Admin') {
      society_id = uid;
    } else if (utype === 'Society_User') {
      society_id = req.user.society_id;
    }

    // Step 1: If society_id is provided, fetch campaign_ids from Campaign_Log
    let campaignIdFilter = null;
    if (society_id) {
      const logFiltered = await Campaign_Log.findAll({
        attributes: ['campaign_id'],
        where: { society_id }
      });

      campaignIdFilter = logFiltered.map(log => log.campaign_id);
    }

    // Step 2: Prepare base filter for Campaign
    let whereClause = {
      status: { [Op.in]: ['active', 'inactive'] }
    };

    if (city_id) whereClause.campaign_city_id = city_id;
    if (area_id) whereClause.campaign_area_id = area_id;
    if (company_id) whereClause.company_id = company_id;

    const currentIST = moment.tz('Asia/Kolkata').toDate();
    const liveStart = currentIST;
    const liveEnd = currentIST;

    // Step 3: Apply campaign status logic
    if (campaign_status === 'live') {
      const liveLogs = await Campaign_Log.findAll({
        where: {
          ...(society_id && { society_id }),
          campaign_status: 'approved',
          status: { [Op.in]: ['active', 'inactive'] },
          live_start_date: { [Op.lte]: liveEnd },
          live_end_date: { [Op.gte]: liveStart }
        }
      });

      const liveIds = liveLogs.map(log => log.campaign_id);
      whereClause.campaign_status = 'approved';
      whereClause.id = liveIds.length ? { [Op.in]: liveIds } : -1;
    } else if (campaign_status === 'approved') {
      const liveLogs = await Campaign_Log.findAll({
        where: {
          ...(society_id && { society_id }),
          campaign_status: 'approved',
          status: { [Op.in]: ['active', 'inactive'] },
          live_start_date: { [Op.lte]: liveEnd },
          live_end_date: { [Op.gte]: liveStart }
        },
        attributes: ['campaign_id'],
        raw: true
      });
      const endedLogs = await Campaign_Log.findAll({
        where: {
          ...(society_id && { society_id }),
          campaign_status: 'approved',
          status: { [Op.in]: ['active', 'inactive'] },
          live_end_date: { [Op.lt]: currentIST }
        },
        attributes: ['campaign_id'],
        raw: true
      });
      const excludedCampaignIds = [
        ...new Set([
          ...liveLogs.map((log) => log.campaign_id),
          ...endedLogs.map((log) => log.campaign_id)
        ])
      ];

      whereClause.campaign_status = 'approved';
      if (excludedCampaignIds.length) {
        whereClause.id = { [Op.notIn]: excludedCampaignIds };
      }
    } else if (campaign_status === 'completed') {
      const endedLogs = await Campaign_Log.findAll({
        where: {
          ...(society_id && { society_id }),
          campaign_status: 'approved',
          status: { [Op.in]: ['active', 'inactive'] },
          live_end_date: { [Op.lt]: currentIST }
        },
        attributes: ['campaign_id'],
        raw: true
      });
      const endedCampaignIds = [...new Set(endedLogs.map((log) => log.campaign_id))];

      whereClause[Op.or] = [
        { campaign_status: 'completed' },
        ...(endedCampaignIds.length ? [{ id: { [Op.in]: endedCampaignIds } }] : [])
      ];
    } else if (campaign_status) {
      whereClause.campaign_status = campaign_status;
    }

    // Step 4: Apply society_id campaign ID filtering (if not live)
    if (campaign_status !== 'live' && campaignIdFilter) {
      if (whereClause.id) {
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          { id: { [Op.in]: campaignIdFilter } }
        ];
      } else {
        whereClause.id = { [Op.in]: campaignIdFilter };
      }
    }

    // Step 5: Apply search filter
    if (search) {
      whereClause[Op.and] = [
        ...(whereClause[Op.and] || []),
        {
          [Op.or]: [
            literal(`CAST("Campaign"."id" AS TEXT) ILIKE '%${search}%'`),
            { campaign_type: { [Op.iLike]: `%${search}%` } },
            { creative_type: { [Op.iLike]: `%${search}%` } },
            { campaign_name: { [Op.iLike]: `%${search}%` } },
            literal(`TO_CHAR("Campaign"."createdAt", 'YYYY-MM-DD') ILIKE '%${search}%'`)
          ]
        }
      ];
    }

    // Step 6: Total count
    const total = await Campaign.count({ where: whereClause });

    // Step 7: Count campaign IDs with society_id = X (used for all count types except "live")
    let societyCampaignIds = [];
    if (society_id) {
      const allLogs = await Campaign_Log.findAll({
        attributes: ['campaign_id'],
        where: { society_id }
      });
      societyCampaignIds = allLogs.map(log => log.campaign_id);
    }

    // Step 8: Counts
    const pendingCount = await Campaign.count({
      where: {
        campaign_status: 'pending',
        ...(societyCampaignIds.length && { id: { [Op.in]: societyCampaignIds } })
      }
    });

    const cancelledCount = await Campaign.count({
      where: {
        campaign_status: 'cancelled',
        ...(societyCampaignIds.length && { id: { [Op.in]: societyCampaignIds } })
      }
    });

    // Step 9: Live count (live campaigns)
    const liveLogs = await Campaign_Log.findAll({
      where: {
        ...(society_id && { society_id }),
        campaign_status: 'approved',
        status: { [Op.in]: ['active', 'inactive'] },
        live_start_date: { [Op.lte]: liveEnd },
        live_end_date: { [Op.gte]: liveStart }
      }
    });
    const liveIds = [...new Set(liveLogs.map(log => log.campaign_id))];
    const endedLogs = await Campaign_Log.findAll({
      where: {
        ...(society_id && { society_id }),
        campaign_status: 'approved',
        status: { [Op.in]: ['active', 'inactive'] },
        live_end_date: { [Op.lt]: currentIST }
      },
      attributes: ['campaign_id'],
      raw: true
    });
    const endedIds = [...new Set(endedLogs.map((log) => log.campaign_id))];
    const approvedExcludedIds = [...new Set([...liveIds, ...endedIds])];

    const approvedCountWhere = [{ campaign_status: 'approved' }];
    if (societyCampaignIds.length) {
      approvedCountWhere.push({ id: { [Op.in]: societyCampaignIds } });
    }
    if (approvedExcludedIds.length) {
      approvedCountWhere.push({ id: { [Op.notIn]: approvedExcludedIds } });
    }
    const approvedCount = await Campaign.count({
      where: { [Op.and]: approvedCountWhere }
    });

    const completedCountWhere = [{
      [Op.or]: [
        { campaign_status: 'completed' },
        ...(endedIds.length ? [{ id: { [Op.in]: endedIds } }] : [])
      ]
    }];
    if (societyCampaignIds.length) {
      completedCountWhere.push({ id: { [Op.in]: societyCampaignIds } });
    }
    const completedCount = await Campaign.count({
      where: { [Op.and]: completedCountWhere }
    });

    const liveCountWhere = [{
      campaign_status: 'approved',
      id: liveIds.length ? { [Op.in]: liveIds } : -1
    }];
    if (societyCampaignIds.length) {
      liveCountWhere.push({ id: { [Op.in]: societyCampaignIds } });
    }
    const liveCount = await Campaign.count({
      where: { [Op.and]: liveCountWhere }
    });

    // Step 10: Final paginated query
    const campaign = await Campaign.findAll({
      where: whereClause,
      offset,
      limit,
      order: [['id', 'DESC']],
      attributes: [
        'id', 'campaign_name', 'company_id', 'campaign_date',
        'creative_type', 'campaign_type', 'campaign_status',
        'createdAt', 'status',
        [Sequelize.literal(`(
          SELECT "company_name"
          FROM "company_registration"
          WHERE "company_registration"."id" = "Campaign"."company_id"
        )`), 'company_name'],
        [Sequelize.literal(`TO_CHAR("Campaign"."campaign_date", 'DD-MM-YYYY')`), 'campaign_date']
      ]
    });

    return res.status(200).json({
      status: 200,
      table_name: 'company_campaigns',
      message: 'Campaign fetched successfully',
      total,
      page,
      limit,
      approvedCount,
      liveCount,
      pendingCount,
      cancelledCount,
      completedCount,
      data: campaign
    });

  } catch (err) {
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch campaigns",
      error: err.message
    });
  }
};

 exports.advertisementApproved = async (req, res) => {
  try {
    
    const { id , society_approved_status, society_cancel_reason, slot_start_time ,slot_end_time } = req.body;

      const userId = req.user.id;
          const userType = req.user_type;
          let societyId = null;
          let societyUserId = null;

               // ✅ Filter by company_id based on authenticated user
          if (req.user_type === 'Society_Admin') {
               let user = await Society_Registration.findOne({ where: { id: userId } });
               societyId = user.id; // Society_Admin's ID is society_id
          } else if (req.user_type === 'Society_User') {
               let societyUser = await Society_User.findOne({ where: { id: userId } });
               // societyId = societyUser.society_id;
               societyUserId = societyUser.society_id; // Society_User has society_id
          }

    if (!id) {
      return res.status(400).json({ status: 400, message: "ID is required" });
    }

    const campaignLog = await Campaign_Log.findByPk(id);
    if (!campaignLog) {
      return res.status(404).json({ status: 404, message: "Campaign Log not found" });
    }

    const campaign = await Campaign.findOne({
      // Do not hard-block on generic record status here; approval flow depends on campaign_log linkage.
      where: { id: campaignLog.campaign_id },
      attributes: ['id','campaign_date','id_prifix_campaign','media_type']
    });

    if (!campaign) {
      return res.status(404).json({ status: 404, message: "Associated campaign not found or inactive" });
    }

    const updatedFields = {
      society_approved_status,
      modified_by: userId,
      modified_type: userType
    };

    if (society_approved_status === 'reject') {
        updatedFields.society_cancel_reason = society_cancel_reason;
        updatedFields.campaign_status = 'reject';
        updatedFields.slot_start_time = null;
        updatedFields.slot_end_time = null;
        updatedFields.live_start_date = null;
        updatedFields.live_end_date = null;
        updatedFields.cancel_date = moment().tz('Asia/Kolkata').toDate();
        updatedFields.society_approved_status = society_approved_status;

        // ⬇️ Refund Wallet Logic
        const companyId = campaignLog.company_id; // Assuming campaign has company_id
        const company = await Company_Registration.findByPk(companyId);
        const refundAmount = campaignLog.campaign_ads_amount || 0;
        

      if (refundAmount > 0) {
        const gstPercentage = 18;
        const gstAmount = (refundAmount * gstPercentage / 100).toFixed(2);
        const totalAmount = refundAmount;

        let previousBalance = parseFloat(company.wallet_amount || 0);
        let newBalance = previousBalance + parseFloat(totalAmount);

        await Wallet.create({
          company_id: company.id,
          company_user_id: null, // or add user if needed
          wallet_type: 'credit',
          refund_status: "refund",
          amount: refundAmount.toFixed(2),
          total_amount: totalAmount.toFixed(2),
          gst_percentage: gstPercentage,
          gst_amount: gstAmount,
          balance: previousBalance.toFixed(2),
          description: `Fund added for auto refund of campaign #${campaign.id_prifix_campaign}`,
          invoice_id: null,
          transaction_id: 'TXN' + Date.now(),
          invoice_url_path: null,
          created_ip_address: req.ip,
          created_by: company.id,
          created_type: 'Company_Admin'
        });


          // 🔔 Create Notification for Refund
        await Notification.create({
          society_ids: [campaignLog.company_id],
          message: `Your campaign #${campaign.id_prifix_campaign} for ad #${campaignLog.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
          from: 'society',
          to: 'company',
          notify_type: 'individual',
          created_ip_address: req.ip
        });

                  // 🔔 Create Notification for Refund
        await Notification.create({
          society_ids: [campaignLog.society_id],
          message: `Campaign #${campaign.id_prifix_campaign} (Ad #${campaignLog.id_prifix_campaign_ads}) has been rejected by the society.`,
          from: 'society',
          to: 'admin',
          notify_type: 'individual',
          created_ip_address: req.ip
        });


        await Campaign_Log.update(
                    { refund_status:'refund' },
                    { where: { id: campaignLog.id } }
                  );

        // Update Company Wallet
        await Company_Registration.update(
          { wallet_amount: newBalance.toFixed(2) },
          { where: { id: company.id } }
        );
      }

    const society = await Society_Registration.findOne({
      where: { id: campaignLog.society_id, status: 'active' },
      attributes: ['id','society_name','email']
    });


                  const baseUrl = process.env.BASE_URL;
                  const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;
      
                  // Step 2: Now fetch the company based on company_id
                  const companys = await Company_Registration.findOne({
                    where: { id: companyId },
                  });
      
                  if (companys && companys.email) {
                    const emailParams = {
                      Source: process.env.AWS_SES_EMAIL,
                      Destination: {
                        ToAddresses: [companys.email]
                      },
                      Message: {
                        Subject: {
                          Data: "Advertise Rejected"
                        },
                        Body: {
                          Html: {
                            Data: `
                              <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                                <div style="background:#cce0ff; padding:20px; text-align:center;">
                                  <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                                </div>
                                <div style="background:#fff; padding:30px; text-align:left;">
                                  <h2 style="color:#000;">Ad Rejected by Society</h2>
                                  <p>Hi ${companys.company_name},</p>
                                  <p>Your Advertise <strong>${campaignLog.id_prifix_campaign_ads}</strong> Campaign <strong>${campaign.id_prifix_campaign}</strong>  has been rejected by Society <strong>${society.society_name}</strong>. Please check the feedback 
in your dashboard</p>
                              
                                </div>
                                <div style="background:#cce0ff; padding:20px; text-align:center;">
                                  <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                                </div>
                              </div>
                            `
                          }
                        }
                      }
                    };
      
                    // Keep approval/rejection flow successful even if mail provider fails.
                    try {
                      await ses.sendEmail(emailParams).promise();
                    } catch (mailError) {
                      console.error("[advertisementApproved][reject-email]", mailError?.message);
                    }
                  }
      

    }else {
      const hasSlotRange = Boolean(slot_start_time && slot_end_time);
      const minActiveDays = await getMinActiveDaysForMediaType(campaign?.media_type);
      updatedFields.society_cancel_reason = null;
      updatedFields.approved_date = moment().tz('Asia/Kolkata').toDate();
      updatedFields.society_approved_date = moment().tz('Asia/Kolkata').toDate();
      updatedFields.society_approved_status = society_approved_status;
      updatedFields.approved_by = 'Society';

      if (hasSlotRange) {
        const campaignDateIST = moment(campaign.campaign_date).tz('Asia/Kolkata'); // retain timezone
        const liveStartDate = moment.tz(
          `${campaignDateIST.format('YYYY-MM-DD')} ${slot_start_time}`,
          'YYYY-MM-DD HH:mm:ss',
          'Asia/Kolkata'
        );
        // Duration is inclusive of start date, driven by platform min_active_days.
        const liveEndDate = liveStartDate
          .clone()
          .add(Math.max(minActiveDays - 1, 0), 'days');
        updatedFields.slot_start_time = slot_start_time;
        updatedFields.slot_end_time = slot_end_time;
        updatedFields.live_start_date = liveStartDate.toDate();
        updatedFields.live_end_date = liveEndDate.toDate();
      } else {
        // If no slot is provided, start live window from campaign date start (IST).
        const campaignStartDate = moment(campaign.campaign_date)
          .tz('Asia/Kolkata')
          .startOf('day');
        const campaignEndDate = campaignStartDate
          .clone()
          .add(Math.max(minActiveDays - 1, 0), 'days')
          .endOf('day');
        updatedFields.slot_start_time = null;
        updatedFields.slot_end_time = null;
        updatedFields.live_start_date = campaignStartDate.toDate();
        updatedFields.live_end_date = campaignEndDate.toDate();
      }

      // ✅ Set campaign_status to 'approve' only if society has approved
      if (society_approved_status === 'approved') {
        updatedFields.campaign_status = 'approved';
      }
    }

    await Campaign_Log.update(updatedFields, { where: { id } });

    const updatedLog = await Campaign_Log.findByPk(id);

        // 🔁 Check all logs under this campaign
            const campaignLogs = await Campaign_Log.findAll({
              where: { campaign_id: campaign.id },
              attributes: ['campaign_status']
            });

              // Check if all logs are rejected
            const allRejected = campaignLogs.every(log => log.campaign_status === 'reject');
      
            let campaignUpdated = false;
      
            if (allRejected) {
                // ❌ If all logs are rejected, update campaign as 'reject'
                await Campaign.update(
                  { campaign_status: 'reject' },
                  { where: { id: campaign.id } }
                );
                campaignUpdated = true;

                            const baseUrl = process.env.BASE_URL;
                            const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;
                
                                    // Step 1: Get campaign details including company_id
                            const campaignDetails = await Campaign.findOne({
                              where: { id: campaign.id },
                              attributes: ['company_id','id_prifix_campaign'], // Only fetch the company_id
                            });
                
                            // Step 2: Now fetch the company based on company_id
                            const company = await Company_Registration.findOne({
                              where: { id: campaignDetails.company_id },
                            });
                
                            if (company && company.email) {
                              const emailParams = {
                                Source: process.env.AWS_SES_EMAIL,
                                Destination: {
                                  ToAddresses: [company.email]
                                },
                                Message: {
                                  Subject: {
                                    Data: "Campaign Rejected"
                                  },
                                  Body: {
                                    Html: {
                                      Data: `
                                        <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                                          <div style="background:#cce0ff; padding:20px; text-align:center;">
                                            <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                                          </div>
                                          <div style="background:#fff; padding:30px; text-align:left;">
                                            <h2 style="color:#000;">Ad Reject by Admin</h2>
                                            <p>Hi ${company.company_name},</p>
                                            <p>Your Campaign <strong>${campaignDetails.id_prifix_campaign}</strong> has been rejected by Admin. Please check the feedback 
                in your dashboard</p>
                                          </div>
                                          <div style="background:#cce0ff; padding:20px; text-align:center;">
                                            <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                                          </div>
                                        </div>
                                      `
                                    }
                                  }
                                }
                              };
                
                              // Keep API response successful even if mail provider fails.
                              try {
                                await ses.sendEmail(emailParams).promise();
                              } catch (mailError) {
                                console.error("[advertisementApproved][all-rejected-email]", mailError?.message);
                              }
                            }


            } else {
                const hasActive = campaignLogs.some(log => log.campaign_status === 'active');
                const allApprovedOrRejected = campaignLogs.every(log =>
                  ['approved', 'reject'].includes(log.campaign_status)
                );
        
                // let campaignUpdated = false;
        
                // ✅ Update Campaign status ONLY if none are active
                if (!hasActive && allApprovedOrRejected) {
                  await Campaign.update(
                    { campaign_status: 'approved' },
                    { where: { id: campaign.id } }
                  );
                  campaignUpdated = true;


                   const baseUrl = process.env.BASE_URL;
                              const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;
                  
                                      // Step 1: Get campaign details including company_id
                              const campaignDetails = await Campaign.findOne({
                                where: { id: campaign.id },
                                attributes: ['company_id','id_prifix_campaign'], // Only fetch the company_id
                              });
                  
                              // Step 2: Now fetch the company based on company_id
                              const companys = await Company_Registration.findOne({
                                where: { id: campaignDetails.company_id },
                              });
                  
                              if (companys && companys.email) {
                                const emailParams = {
                                  Source: process.env.AWS_SES_EMAIL,
                                  Destination: {
                                    ToAddresses: [companys.email]
                                  },
                                  Message: {
                                    Subject: {
                                      Data: "Campaign Approved"
                                    },
                                    Body: {
                                      Html: {
                                        Data: `
                                          <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                                            <div style="background:#cce0ff; padding:20px; text-align:center;">
                                              <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                                            </div>
                                            <div style="background:#fff; padding:30px; text-align:left;">
                                              <h2 style="color:#000;">Ad Approved by Admin</h2>
                                              <p>Hi ${companys.company_name},</p>
                                              <p>Your submitted campaign <strong>#${campaignDetails.id_prifix_campaign}</strong> has been approved by the ADZ10X admin team.</p>
                                              <p>Thank you for using ADZ10X.</p>
                                            </div>
                                            <div style="background:#cce0ff; padding:20px; text-align:center;">
                                              <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                                            </div>
                                          </div>
                                        `
                                      }
                                    }
                                  }
                                };
                  
                                // Keep API response successful even if mail provider fails.
                                try {
                                  await ses.sendEmail(emailParams).promise();
                                } catch (mailError) {
                                  console.error("[advertisementApproved][all-approved-email]", mailError?.message);
                                }
                              }
                  
                }
            }

        await Notification.create({
          society_ids: [campaignLog.society_id],
          message: `Campaign #${campaign.id_prifix_campaign} (Ad #${campaignLog.id_prifix_campaign_ads}) has been approved by the society.`,
          from: 'society',
          to: 'admin',
          notify_type: 'individual',
          created_ip_address: req.ip
        });

        return res.status(200).json({
          status: 200,
        
          message: "Campaign Log updated successfully",
          data: updatedLog,
          campaign_id: campaign.id,
          campaign_status_updated: campaignUpdated
        });

      } catch (error) {
        return res.status(500).json({
          status: 500,
          message: "Something went wrong",
          error: error.message
        });
      }
  };

exports.advertisementADS = async (req, res) => {
      try {
        const { id, campaign_id, campaign_log_id, society_id, society_user_id, company_id, no_view,no_reactions, performance_remark  } = req.body;
    
        const userId = req.user.id;
        const userType = req.user_type;
    
        let societyId = null;
        let societyUserId = null;
    
        if (userType === 'Society_Admin') {
          const user = await Society_Registration.findOne({ where: { id: userId } });
          societyId = user?.id || null;
        } else if (userType === 'Society_User') {
          const societyUser = await Society_User.findOne({ where: { id: userId } });
          societyUserId = societyUser?.society_id || null;
        }

        // Handle multiple images dynamically
                const imageFields = [
                    "upload_ads_src_path",
                    "upload_view_src_path",
                    "upload_reaction_src_path",
                    "upload_after_24_ads_src_path"
                ];
                
                let imagePaths = {};
                let imageNames = {};
        
                imageFields.forEach(field => {
                    if (req.files[field] && req.files[field][0]) {
                        imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                        imageNames[field] = path.basename(req.files[field][0].filename);
                    }
                });

          // let campaign = await Campaign.findOne({ where: { id } });
          // let campaign_log = await Campaign_Log.findOne({ where: { id } });

          let campaign = await Campaign.findOne({ where: { id: campaign_id } });
          let campaign_log = await Campaign_Log.findOne({ where: { id: campaign_log_id } });

          let advertisement;

           if('live' in req.body){
             const { id } = req.body;
          
              if (id) {
                // ✅ UPDATE existing ad
                advertisement = await Advertisements.update(
                  {
                    campaign_id,
                    campaign_log_id,
                    society_id,
                    society_user_id,
                    company_id,
                    upload_ads_src_path: imagePaths["upload_ads_src_path"],
                    upload_ads_src_name: imageNames["upload_ads_src_path"],
                    updated_ip_address: req.ip,
                    modified_by: userId,
                    modified_type: userType
                  },
                  {
                      where: { id },
                      returning: true // If using Postgres and want updated record returned
                  }
                );
                            // Fetch updated ad if returning is not supported
                advertisement = await Advertisements.findOne({ where: { id } });

                          // Notify company
                await Notification.create({
                  society_ids: [campaign_log.society_id],
                  message: `Society report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
                  from: 'society',
                  to: 'admin',
                  notify_type: 'individual',
                  created_ip_address: req.ip
                });
                }else {
                  // ✅ Check if an active ad already exists for this campaign_log_id
                let existingAd = await Advertisements.findOne({
                  where: { campaign_log_id: campaign_log_id, status: 'active' }
                });

                if (existingAd) {
                  // ⚠️ Update existing instead of creating duplicate
                  await Advertisements.update(
                    {
                      upload_ads_src_path: imagePaths["upload_ads_src_path"],
                      upload_ads_src_name: imageNames["upload_ads_src_path"],
                      updated_ip_address: req.ip,
                      modified_by: userId,
                      modified_type: userType
                    },
                    { where: { id: existingAd.id } }
                  );

                  advertisement = await Advertisements.findOne({ where: { id: existingAd.id } });

                  await Notification.create({
                     society_ids: [campaign_log.society_id],
                    message: `Society report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
                    from: 'society',
                    to: 'admin',
                    notify_type: 'individual',
                    created_ip_address: req.ip
                  });

                } else {
                         // ✅ Create new ad
                  advertisement = await Advertisements.create({
                    campaign_id,
                    campaign_log_id,
                    society_id,
                    society_user_id,
                    company_id,
                    upload_ads_src_path: imagePaths["upload_ads_src_path"],
                    upload_ads_src_name: imageNames["upload_ads_src_path"],
                    updated_ip_address: req.ip,
                    created_by: userId,
                    created_type: userType
                });
                            // Notify company
                await Notification.create({
                  society_ids: [campaign_log.society_id],
                  message: `Society report created campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
                  from: 'society',
                  to: 'admin',
                  notify_type: 'individual',
                  created_ip_address: req.ip
                });
              }
            }
              
              return res.status(200).json({ status: 200, 
                // message: (id ? "Ad updated successfully." : "Ad created successfully."),
                message: "Sucessfully uploaded advertisement report",
                data: advertisement
              });
          }
          
        if (id) {
          // ✅ Update existing ad
          await Advertisements.update(
            {
              campaign_id,
              campaign_log_id,
              society_id,
              society_user_id,
              company_id,
              upload_ads_src_path: imagePaths["upload_ads_src_path"],
              upload_ads_src_name: imageNames["upload_ads_src_path"],
              no_view,
              no_reactions,
              upload_view_src_path: imagePaths["upload_view_src_path"],
              upload_view_src_name: imageNames["upload_view_src_path"],
              upload_reaction_src_path: imagePaths["upload_reaction_src_path"],
              upload_reaction_src_name: imageNames["upload_reaction_src_path"],
              upload_after_24_ads_src_path: imagePaths["upload_after_24_ads_src_path"],
              upload_after_24_ads_src_name: imageNames["upload_after_24_ads_src_path"],
              performance_remark,
              modified_ip_address: req.ip,
              modified_by:userId,
              modified_type:userType
            },
            {
              where: { id }
            }
          );
          advertisement = await Advertisements.findOne({ where: { id } });

            // Notify company
            await Notification.create({
              society_ids: [campaign_log.society_id],
              message: `Society report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
              from: 'society',
              to: 'admin',
              notify_type: 'individual',
              created_ip_address: req.ip
            });
    
          return res.status(200).json({ status: 200, message: "Sucessfully uploaded advertisement report", data: advertisement });
        } else {
           // ✅ Check if advertisement already exists for this campaign_log_id and active status
          let existingAd = await Advertisements.findOne({
            where: {
              campaign_log_id: campaign_log_id,
              status: 'active'
            }
          });

          if (existingAd) {
            // ⚠️ Update existing instead of creating new
            await Advertisements.update(
              {
                no_view,
                no_reactions,
                performance_remark,
                upload_view_src_path: imagePaths["upload_view_src_path"],
                upload_view_src_name: imageNames["upload_view_src_path"],
                upload_reaction_src_path: imagePaths["upload_reaction_src_path"],
                upload_reaction_src_name: imageNames["upload_reaction_src_path"],
                upload_after_24_ads_src_path: imagePaths["upload_after_24_ads_src_path"],
                upload_after_24_ads_src_name: imageNames["upload_after_24_ads_src_path"],
                modified_ip_address: req.ip,
                modified_by: userId,
                modified_type: userType
              },
              { where: { id: existingAd.id } }
            );

            advertisement = await Advertisements.findOne({ where: { id: existingAd.id } });

            await Notification.create({
               society_ids: [campaign_log.society_id],
              message: `Society report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
              from: 'society',
              to: 'admin',
              notify_type: 'individual',
              created_ip_address: req.ip
            });

            return res.status(200).json({
              status: 200,
              message: "Successfully updated existing advertisement report",
              data: advertisement
            });

          } else {
                  // ✅ Create new ad
            advertisement = await Advertisements.create({
              campaign_id,
              campaign_log_id,
              society_id,
              society_user_id,
              company_id,
              upload_ads_src_path: imagePaths["upload_ads_src_path"],
              upload_ads_src_name: imageNames["upload_ads_src_path"],
              no_view,
              no_reactions,
              upload_view_src_path: imagePaths["upload_view_src_path"],
              upload_view_src_name: imageNames["upload_view_src_path"],
              upload_reaction_src_path: imagePaths["upload_reaction_src_path"],
              upload_reaction_src_name: imageNames["upload_reaction_src_path"],
              upload_after_24_ads_src_path: imagePaths["upload_after_24_ads_src_path"],
              upload_after_24_ads_src_name: imageNames["upload_after_24_ads_src_path"],
              performance_remark,
              created_ip_address: req.ip,
              created_by: userId,
              created_type: userType
            });

                    // Notify company
            await Notification.create({
               society_ids: [campaign_log.society_id],
              message: `Society report created campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
              from: 'society',
              to: 'admin',
              notify_type: 'individual',
              created_ip_address: req.ip
            });

          return res.status(200).json({ status: 200, message: "Sucessfully uploaded advertisement report", data: advertisement });
        }
      }
    
      } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
      }
};