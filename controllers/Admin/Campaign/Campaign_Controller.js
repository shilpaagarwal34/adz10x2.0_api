const AWS = require('aws-sdk');
const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Ads_Slot = require('@models/Society/Auth/Society_Ads_Slot_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const Notification = require('@models/Notifications/Notification_Model');
const path = require('path');
const { where, literal, Sequelize } = require('sequelize');
const { Op, fn, col } = require('sequelize');
const moment = require('moment-timezone');
const {
  normalizeMediaType,
  getMediaPlatformConfig,
} = require('@helper/mediaRateHelper');

// Configure AWS SES

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

exports.getSocietyProfileAdminSlot = async (req, res) => {
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

exports.viewAdminAdvertisement = async (req, res) => {
  try {
    const { id } = req.params; // Campaign log ID

    if (!id) {
      return res.status(400).json({
        status: 400,
        message: 'Campaign log ID is required',
      });
    }

    // Fetch campaign log first
    const campaign_logs = await Campaign_Log.findOne({
      where: { id: id, status: 'active' },
      attributes: [
        'id','id_prifix_campaign_ads', 'campaign_id', 'society_id', 'company_id', 'admin_cancel_reason',
        'society_cancel_reason', 'campaign_ads_amount', 'upload_societies_images_path',
        'upload_societies_images_name', 'societies_text', 'slot_start_time',
        'slot_end_time', 'live_start_date', 'live_end_date', 'view_to_company',
        'campaign_status', 'admin_approved_status', 'society_approved_status',
        'cancel_date','approved_by', 'approved_date', 'approved_date_admin', 'society_approved_date', 'modified_by', 'modified_type', 'updatedAt'
      ]
    });

    if (!campaign_logs) {
      return res.status(404).json({
        status: 404,
        message: 'Campaign logs not found or access denied',
      });
    }

    // Fetch campaign related to campaign_logs
    const campaign = await Campaign.findOne({
      where: { id: campaign_logs.campaign_id, status: 'active' },
      attributes: ['id', 'company_id', 'id_prifix_campaign', 'campaign_type', 'campaign_date', 'creative_type', 'campaign_name', 'campaign_status']
    });

    let formatted_campaign = null;

    if (campaign) {
      const campaignData = campaign.toJSON();

      const formattedDate = campaignData.campaign_date
        ? new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }).format(new Date(campaignData.campaign_date)).replace(',', ' -')
        : null;

      const formattedcampaign_date = campaignData.campaign_date
        ? moment(campaignData.campaign_date).format('D MMM YYYY h:mma')
        : null;

      formatted_campaign = {
        ...campaignData,
        campaign_date: formattedDate,
        formatted_campaign_date: formattedcampaign_date
      };
    }

    // Fetch related data
    const society = await Society_Registration.findOne({
      where: { id: campaign_logs.society_id },
      attributes: ['id','society_name', 'id_prifix_society', 'name','society_profile_img_path','society_profile_img_name','address','relationship_manager_id']
    });

    const company = await Company_Registration.findOne({
      where: { id: campaign_logs.company_id },
      attributes: ['id','company_name', 'id_prifix_company', 'name','company_profile_photo_path','company_profile_photo_name','address_line_1','address_line_2']
    });

    const advertisement = await Advertisements.findOne({
      where: { campaign_log_id: campaign_logs.id, status: 'active' }
    });

    // Determine modified_by_name
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
      ? moment(campaign_logs.updatedAt).format('D MMM YYYY h:mma')
      : null;

    const formatted_approved_date = campaign_logs.approved_date
      ? moment(campaign_logs.approved_date).format('D MMM YYYY h:mma')
      : null;

    const formatted_admin_approved_date = campaign_logs.approved_date_admin
      ? moment(campaign_logs.approved_date_admin).format('D MMM YYYY h:mma')
      : null;
    const formatted_society_approved_date = campaign_logs.society_approved_date
      ? moment(campaign_logs.society_approved_date).format('D MMM YYYY h:mma')
      : null;

    const formatted_cancel_date = campaign_logs.cancel_date
      ? moment(campaign_logs.cancel_date).format('D MMM YYYY h:mma')
      : null;

    // Determine approved_by and cancelled_by
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
    campaign_logs.setDataValue('approved_date', formatted_approved_date);
    campaign_logs.setDataValue('admin_approved_date', formatted_admin_approved_date);
    campaign_logs.setDataValue('society_approved_date', formatted_society_approved_date);
    campaign_logs.setDataValue('cancel_date', formatted_cancel_date);
    // campaign_logs.setDataValue('approved_by', approved_by);
    campaign_logs.setDataValue('cancelled_by', cancelled_by);
    campaign_logs.setDataValue('cancel_reason', campaign_logs.admin_cancel_reason || campaign_logs.society_cancel_reason);

    return res.status(200).json({
      status: 200,
      message: 'Campaign Log fetched successfully',
      data: {
        society,
        company,
        campaign: formatted_campaign,
        campaign_logs,
        advertisement
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

exports.viewCampaignAdmin = async (req, res) => {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).json({
          status: 400,
          message: 'Campaign ID is required',
        });
      }
  
      // Fetch campaign
      const campaign = await Campaign.findOne({ where: { id } });
  
      if (!campaign) {
        return res.status(404).json({
          status: 404,
          message: 'Campaign not found',
        });
      }
  
      // Fetch campaign logs
      const campaign_logs = await Campaign_Log.findAll({
        where: { campaign_id: campaign.id }
      });

      let campaignAdsAmount = 0;

    for (const log of campaign_logs) {
      campaignAdsAmount += parseFloat(log.campaign_ads_amount || 0); // Add safely
    }

      // let totalFlats = 0;

      // for (const log of campaign_logs) {
      //   const society_profile = await Society_Profile.findOne({
      //     where: { society_id: log.society_id, status: 'active' },
      //     attributes: ['number_of_flat']
      //   });

      //   const flatCount = society_profile ? parseInt(society_profile.number_of_flat, 10) : 0;
      //   totalFlats += flatCount;
      
      //   log.dataValues.number_of_flat = society_profile ? society_profile.number_of_flat : null;

      //         // Get society registration details
      //   const societyRegistration = await Society_Registration.findOne({
      //     where: { id: log.society_id },
      //     attributes: ['id', 'society_name', 'name', 'society_profile_img_path', 'society_profile_img_name', 'address', 'relationship_manager_id']
      //   });

      //         // Attach society details to log
      //   log.dataValues.society = societyRegistration || null;

      // }

      let totalFlats = 0;

await Promise.all(
  campaign_logs.map(async (log) => {
    const society_profile = await Society_Profile.findOne({
      where: { society_id: log.society_id, status: 'active' },
      attributes: ['number_of_flat']
    });

    const flatCount = society_profile ? parseInt(society_profile.number_of_flat || 0, 10) : 0;
    totalFlats += flatCount;

    // Attach number_of_flat to each log
    log.dataValues.number_of_flat = society_profile ? society_profile.number_of_flat : null;

    // Get society registration details
    const societyRegistration = await Society_Registration.findOne({
      where: { id: log.society_id },
      attributes: [
        'id',
        'society_name',
        'name',
        'society_profile_img_path',
        'society_profile_img_name',
        'address',
        'relationship_manager_id'
      ]
    });

    log.dataValues.society = societyRegistration || null;
  })
);
  
      // Get city and area names if IDs exist
      const city = campaign.campaign_city_id
        ? await City.findOne({ where: { id: campaign.campaign_city_id }, attributes: ['city_name'] })
        : null;
  
      const area = campaign.campaign_area_id
        ? await Area.findOne({ where: { id: campaign.campaign_area_id }, attributes: ['area_name'] })
        : null;

        // Format campaign_date
        const campaignDate = campaign.campaign_date
        ? new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(new Date(campaign.campaign_date)).replace(',', ' -')
        : null;
  
                // Format createdAt to show AM/PM
        const formattedCreatedAt = campaign.createdAt
        ? new Intl.DateTimeFormat('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true, // Enables AM/PM format
        }).format(new Date(campaign.createdAt)).replace(',', ' -')
        : null;
      // Add city and area name to campaign object
      const enrichedCampaign = {
        ...campaign.toJSON(),
        city_name: city ? city.city_name : null,
        area_name: area ? area.area_name : null,
        campaign_date: campaignDate,
        formatted_created_at: formattedCreatedAt,
        campaign_ads_amount: campaignAdsAmount
      };

         let companyData = null;
      
        if (campaign.created_by) {
          if (campaign.created_type === 'Company_User') {
              const companyUser = await Company_User.findOne({ where: { id: campaign.created_by } });
      
              if (companyUser) {
                  const company = await Company_Registration.findOne({
                      where: { id: companyUser.company_id },
                      attributes: ['name', 'id_prifix_company', 'company_name', 'address_line_1', 'address_line_2', 'company_profile_photo_path', 'company_profile_photo_name']
                  });
      
                  if (company) {
                      companyData = company;
                  }
              }
          } else if (campaign.created_type === 'Company_Admin') {
              const company = await Company_Registration.findOne({
                  where: { id: campaign.created_by },
                  attributes: ['name',  'id_prifix_company', 'company_name', 'address_line_1', 'address_line_2','company_profile_photo_path', 'company_profile_photo_name']
              });
      
              if (company) {
                  companyData = company;
              }
          }
      }
  
      return res.status(200).json({
        status: 200,
        message: 'Campaign fetched successfully',
        data: {
          campaign:enrichedCampaign,
          total_flats: totalFlats,
          company: companyData,
          campaign_logs,
        }
      });
  
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return res.status(500).json({
        status: 500,
        message: 'Internal server error',
        error:error.message
      });
    }
  };

exports.viewSocietyAdmin = async (req, res) => {
    try {
        const { id } = req.params; //  society id

        if(!id) {
            return res.status(400).json({ status:400, message:'Society ID is required' });
        }

        // Fetch Society 
        const society = await Society_Registration.findOne({
                            where:{ id: id},
                        });

        if( !society ) {
            return res.status(404).json({ status:404, message: "Society not found" });
        }

        const society_profile = await Society_Profile.findOne({ 
                where:{ society_id: id },
            });

        if(!society_profile) {
            return res.status(404).json({ status:404, message: "Society profile not found" });
        }

        return res.status(200).json({
            status:200,
            message: 'Society fetched successfully',
            data: {
                society,
                society_profile
            }
        });

    } catch (error) {
        return res.status(500).json({  status:500, message: 'Internal server error', error:error.message});
    }
}

exports.campaignDataTableAdmin = async (req, res) => {
  try {
      const { isSuperAdmin, role_name, id: userId } = req.user;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      const { company_id, city_id, area_id, search, campaign_status } = req.query;

      // Base where clause (common filters only)
      const baseWhereClause = {
          status: {
              [Op.in]: ['active', 'inactive']
          }
      };

      // Add company-based Relationship Manager filtering logic
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            // Step 1: Find all company IDs managed by the current RM
            const managedCompanies = await Company_Registration.findAll({
                where: {
                    relationship_manager_id: userId
                },
                attributes: ['id'],
                raw: true
            });

            const managedCompanyIds = managedCompanies.map(company => company.id);

            // Step 2: Add the company IDs to the base where clause
            baseWhereClause.company_id = {
                [Op.in]: managedCompanyIds
            };
        }

      if (city_id) baseWhereClause.campaign_city_id = city_id;
      if (area_id) baseWhereClause.campaign_area_id = area_id;
      if (company_id) baseWhereClause.company_id = company_id;

      // Main where clause (includes dynamic filters like campaign_status and search)
      const whereClause = { ...baseWhereClause };
      const currentIST = moment.tz('Asia/Kolkata').toDate();
      let liveCampaignIdsCurrent = [];
    // If 'live' status is selected
    if (campaign_status === 'live') {
      const liveCampaignLogs = await Campaign_Log.findAll({
        where: {
          live_start_date: { [Op.lte]: currentIST },
          live_end_date: { [Op.gte]: currentIST }
        }
      });

      // Get campaign_ids from live campaigns
      const campaignIds = [...new Set(liveCampaignLogs.map(log => log.campaign_id).filter(Boolean))];
    
      // Modify whereClause to include only those campaigns that are approved and within live window
      whereClause.campaign_status = 'approved'; // Only 'approved' campaigns
      whereClause.id = { [Op.in]: campaignIds }; // Filter by campaign_id from Campaign_Log
    } else if (campaign_status === 'approved') {
        const liveCampaignLogs = await Campaign_Log.findAll({
          where: {
            live_start_date: { [Op.lte]: currentIST },
            live_end_date: { [Op.gte]: currentIST }
          },
          attributes: ['campaign_id'],
          raw: true
        });
        liveCampaignIdsCurrent = [...new Set(liveCampaignLogs.map(log => log.campaign_id).filter(Boolean))];

        whereClause.campaign_status = 'approved';
        if (liveCampaignIdsCurrent.length > 0) {
          whereClause.id = { [Op.notIn]: liveCampaignIdsCurrent };
        }
    } else if (campaign_status) {
        whereClause.campaign_status = campaign_status;
    }

      if (search) {
        whereClause[Op.or] = [
            literal(`CAST("Campaign"."id" AS TEXT) ILIKE '%${search}%'`),
            { id_prifix_campaign: { [Op.iLike]: `%${search}%` } },
            { campaign_type: { [Op.iLike]: `%${search}%` } },
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
       const todayStart = moment.tz(timezone).startOf('day').toDate();
       const todayEnd = moment.tz(timezone).endOf('day').toDate();
 
       // Get live count based on Campaign_Log
       const liveCampaignLogs = await Campaign_Log.findAll({
           where: {
               live_start_date: { [Op.lte]: todayEnd },
               live_end_date: { [Op.gte]: todayStart }
           }
       });

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

       // Count campaigns with matching campaign_ids
       const liveCount = await Campaign.count({
           where: {
               ...baseWhereClause,
               campaign_status: 'approved',
                id: { [Op.in]: liveCampaignIdsForCount }
           }
       });

      // Counts based on base filters only (avoid search/campaign_status conflicts)
      const approvedCountWhere = { ...baseWhereClause, campaign_status: 'approved' };
      if (liveCampaignIdsForCount.length > 0) {
          approvedCountWhere.id = { [Op.notIn]: [...new Set(liveCampaignIdsForCount.filter(Boolean))] };
      }

      const approvedCount = await Campaign.count({
          where: approvedCountWhere
      });

      const pendingCount = await Campaign.count({
          where: { ...baseWhereClause, campaign_status: 'pending' }
      });

      const cancelledCount = await Campaign.count({
          where: { ...baseWhereClause, campaign_status: 'reject' }
      });

      const completedCount = await Campaign.count({
          where: { ...baseWhereClause, campaign_status: 'completed' }
      });

      const campaign = await Campaign.findAll({
          where: whereClause,
          offset,
          limit,
          order: [['id', 'DESC']],
          attributes: [
              'id', 'campaign_name', 'id_prifix_campaign', 'company_id', 'campaign_date',
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
      res.status(500).json({
          status: 500,
          message: "Failed to fetch campaigns",
          error: err.message
      });
  }
};

  exports.advertisementApprovedAllAdmin = async (req, res) => {
    try {
      const {
        id, // this is Campaign.id
        campaign_status,
        admin_cancel_reason
      } = req.body;

      const userId = req.user.id
      const userType = req.user.role_name || null;
  
      if (!id) {
        return res.status(400).json({ status: 400, message: "Campaign ID is required" });
      }
  
      // Validate Campaign exists
      const campaign = await Campaign.findByPk(id);
      if (!campaign) {
        return res.status(404).json({ status: 404, message: "Campaign not found" });
      }
  
      // Update campaign status
      await Campaign.update(
        { campaign_status, odified_ip_address: req.ip, modified_by:userId , modified_type:userType },
        { where: { id } }
      );
  
      if(campaign_status === 'reject'){
            const baseUrl = process.env.BASE_URL;
            const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;
            

                    // Step 1: Get campaign details including company_id
            const campaignDetails = await Campaign.findOne({
              where: { id: campaign.id },
              attributes: ['company_id'], // Only fetch the company_id
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
                            <h2 style="color:#000;">Ad Rejected by Admin</h2>
                            <p>Hi ${company.company_name},</p>
                            <p>Your Campaign has been rejected by Admin <strong>#${campaign.id_prifix_campaign}</strong>. Please check the feedback 
in your dashboard.</p>
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

              // ✅ Send using AWS SES
              await ses.sendEmail(emailParams).promise();
            }
      }

      // Get all logs related to this campaign
    const campaignLogs = await Campaign_Log.findAll({ where: { campaign_id: id } });

      // Prepare log update data
      let logUpdateData = {
        modified_ip_address: req.ip,
        modified_by:userId,
        modified_type:'Admin'
      };


      if (campaign_status === 'approved') {
        logUpdateData.admin_approved_status = 'approved';
        logUpdateData.campaign_status = 'pending';
        logUpdateData.approved_date = moment().tz('Asia/Kolkata').toDate();
        logUpdateData.approved_date_admin = moment().tz('Asia/Kolkata').toDate();

        // Loop through each log to notify company and society
        for (const log of campaignLogs) {
          // ✅ Notify company
          await Notification.create({
            company_ids: [log.company_id],
            message: `Your campaign #${campaign.id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been approved by admin.`,
            from: 'admin',
            to: 'company',
            notify_type: 'individual',
            created_ip_address: req.ip
          });

          // ✅ Notify society
          await Notification.create({
            society_ids: [log.society_id],
            message: `Your campaign #${campaign.id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been approved by admin.`,
            from: 'admin',
            to: 'society',
            notify_type: 'individual',
            created_ip_address: req.ip
          });

          // ✅ Fetch Society Email
          const society = await Society_Registration.findByPk(log.society_id, {
            attributes: ['email', 'society_name']
          });

          if (society && society.email) {
            const baseUrl = process.env.BASE_URL;
            const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

            const emailParams = {
              Source: process.env.AWS_SES_EMAIL,
              Destination: {
                ToAddresses: [society.email]
              },
              Message: {
                Subject: {
                  Data: "New Advertisement Received"
                },
                Body: {
                  Html: {
                    Data: `
                      <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                          <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                        </div>
                        <div style="background:#fff; padding:30px; text-align:left;">
                          <h2 style="color:#000;">New Advertisement Received</h2>
                          <p>Hi ${society.society_name},</p>
                          <p>A new Advertise ${log.id_prifix_campaign_ads} is available for review. Please login to your dashboard to approve or reject it.</p>
                          <p>Regards,<br/>ADZ10X Admin Team</p>
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

            // ✅ Send the email using AWS SES
            await ses.sendEmail(emailParams).promise();
          }
        }
      }
      else if (campaign_status === 'reject') {
        logUpdateData.admin_approved_status = 'reject';
        logUpdateData.campaign_status = 'reject';
        logUpdateData.cancel_date = moment().tz('Asia/Kolkata').toDate();
        // logUpdateData.society_approved_status = 'reject';
        logUpdateData.admin_cancel_reason = admin_cancel_reason || '';

      }
  
      // Update all Campaign_Log entries for this campaign
      await Campaign_Log.update(logUpdateData, {
        where: { campaign_id: id }
      });

       // ✅ Refund logic if campaign is rejected with GST 

        if (campaign_status === 'reject') {
        let hasRefundLogs = false;
        let refundLogs = [];
        let totalRefundAmount = 0;
        let company = null;

        // Check if any log has refund_status === 'refund'
        for (const log of campaignLogs) {
          if (log.refund_status === 'refund') {
            hasRefundLogs = true;
            refundLogs.push(log);
          } else if (log.refund_status === null) {
            totalRefundAmount += parseFloat(log.campaign_ads_amount || 0);
            if (!company) {
              company = await Company_Registration.findByPk(log.company_id);
            }
          }
        }

        // ✅ CASE 1: If any log has refund_status === 'refund', refund ALL logs individually
        if (hasRefundLogs) {
          for (const log of campaignLogs) {

            // 🔁 Skip logs that are already refunded
            if (log.refund_status === 'refund') {
              continue;
            }

            const company = await Company_Registration.findByPk(log.company_id);
            const refundAmount = parseFloat(log.campaign_ads_amount || 0);

            if (company && refundAmount > 0) {
              const previousBalance = parseFloat(company.wallet_amount || 0);
              const newBalance = previousBalance + refundAmount;

              await Wallet.create({
                company_id: company.id,
                company_user_id: null,
                wallet_type: 'credit',
                refund_status:'refund',
                amount: refundAmount.toFixed(2),
                total_amount: refundAmount.toFixed(2),
                gst_percentage: 0,
                gst_amount: '0.00',
                balance: previousBalance.toFixed(2),
                description: `Fund added for auto refund of campaign #${campaign.id_prifix_campaign} for ads #${log.id_prifix_campaign_ads}`,
                invoice_id: null,
                transaction_id: 'TXN' + Date.now(),
                invoice_url_path: null,
                created_ip_address: req.ip,
                created_by: userId,
                created_type: 'Admin'
              });

              await Company_Registration.update(
                { wallet_amount: newBalance.toFixed(2) },
                { where: { id: company.id } }
              );

              // ✅ Optionally, mark the log as refunded
              await Campaign_Log.update(
                { refund_status: 'refund' },
                { where: { id: log.id } }
              );

                    // 🔔 Notification for Company
              await Notification.create({
                company_ids: [log.company_id],
                message: `Your campaign #${campaign.id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
                from: 'admin',
                to: 'company',
                notify_type: 'individual',
                created_ip_address: req.ip
              });

                    // 🔔 Notification for Society
                if (log.society_id) {
                  await Notification.create({
                    society_ids: [log.society_id],
                    message: `Your campaign #${campaign.id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
                    from: 'admin',
                    to: 'society',
                    notify_type: 'individual',
                    created_ip_address: req.ip
                  });
                }

            }
          }
        }

        // ✅ CASE 2: Single refund when all refund_status === null
        else if (totalRefundAmount > 0 && company) {
          const previousBalance = parseFloat(company.wallet_amount || 0);
          const newBalance = previousBalance + totalRefundAmount;

          await Wallet.create({
            company_id: company.id,
            company_user_id: null,
            wallet_type: 'credit',
            refund_status:'refund',
            amount: totalRefundAmount.toFixed(2),
            total_amount: totalRefundAmount.toFixed(2),
            gst_percentage: 0,
            gst_amount: '0.00',
            balance: previousBalance.toFixed(2),
            description: `Fund added for auto refund of campaign #${campaign.id_prifix_campaign}`,
            invoice_id: null,
            transaction_id: 'TXN' + Date.now(),
            invoice_url_path: null,
            created_ip_address: req.ip,
            created_by: userId,
            created_type: 'Admin'
          });

          await Company_Registration.update(
            { wallet_amount: newBalance.toFixed(2) },
            { where: { id: company.id } }
          );

          // ✅ Update the refund_status of all relevant logs to 'refund'
            await Campaign_Log.update(
              { refund_status: 'refund' },
              { where: { campaign_id: campaign.id, refund_status: null } }
            );
                    // 🔔 One-time Notification for Company
            await Notification.create({
              company_ids: [company.id],
              message: `Your campaign #${campaign.id_prifix_campaign} has been rejected and the total amount has been refunded.`,
              from: 'admin',
              to: 'company',
              notify_type: 'individual',
              created_ip_address: req.ip
            });

                    // 🔔 One-time Notification for all societies involved
            const uniqueSocietyIds = [
              ...new Set(campaignLogs.map(log => log.society_id).filter(Boolean))
            ];

              for (const societyId of uniqueSocietyIds) {
              await Notification.create({
                society_ids: [societyId],
                message: `Your campaign #${campaign.id_prifix_campaign} has been rejected and the total amount has been refunded.`,
                from: 'admin',
                to: 'society',
                notify_type: 'individual',
                created_ip_address: req.ip
              });
            }
        }
      }

      return res.status(200).json({
        status: 200,
        message: "Campaign and related logs updated successfully",
        data: campaignLogs
      });
  
    } catch (error) {
      return res.status(500).json({ status: 500, error: error.message });
    }
  };

  exports.advertisementApprovedAdmin = async (req, res) => {
  try {
    const { id, admin_approved_status, society_approved_status, admin_cancel_reason, slot_start_time, slot_end_time } = req.body;

    const userId = req.user.id || null;
    const roleName = req.user.role_name || null;

    if (!id) {
      return res.status(400).json({ status: 400, message: "ID is required" });
    }

    const campaignLog = await Campaign_Log.findByPk(id);
    if (!campaignLog) {
      return res.status(404).json({ status: 404, message: "Campaign_Log not found" });
    }

    const campaign = await Campaign.findOne({
      where: { id: campaignLog.campaign_id, status: 'active' },
      attributes: ['id','campaign_date','media_type']
    });

    if (!campaign) {
      return res.status(404).json({ status: 404, message: "Associated campaign not found or inactive" });
    }

    const updatedFields = {
      admin_approved_status,
      modified_ip_address: req.ip,
      modified_by: userId,
      modified_type: 'Admin'
    };

     if (admin_approved_status === 'reject') {
        updatedFields.admin_cancel_reason = admin_cancel_reason;
        updatedFields.campaign_status = 'reject';
        updatedFields.slot_start_time = null;
        updatedFields.slot_end_time = null;
        updatedFields.live_start_date = null;
        updatedFields.live_end_date = null;
        updatedFields.cancel_date = moment().tz('Asia/Kolkata').toDate();
        // updatedFields.society_approved_status = society_approved_status;

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
            refund_status:'refund',
            amount: refundAmount.toFixed(2),
            total_amount: totalAmount.toFixed(2),
            gst_percentage: gstPercentage,
            gst_amount: gstAmount,
            balance: previousBalance.toFixed(2),
            description: `Fund added for auto refund of campaign #${campaign.id_prifix_campaign} for ads #${campaignLog.id_prifix_campaign_ads}`,
            invoice_id: null,
            transaction_id: 'TXN' + Date.now(),
            invoice_url_path: null,
            created_ip_address: req.ip,
            created_by: company.id,
            created_type: 'Company_Admin'
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

                // 🔔 Create Notification for Refund
        await Notification.create({
          company_ids: [campaignLog.company_id],
          message: `Your campaign #${campaign.id_prifix_campaign} for ad #${campaignLog.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
          from: 'admin',
          to: 'company',
          notify_type: 'individual',
          created_ip_address: req.ip
        });

                 // 🔔 Create Notification for Refund
        await Notification.create({
          society_ids: [campaignLog.society_id],
          message: `Your campaign #${campaign.id_prifix_campaign} for ad #${campaignLog.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
          from: 'admin',
          to: 'society',
          notify_type: 'individual',
          created_ip_address: req.ip
        });

    }else {
      const minActiveDays = await getMinActiveDaysForMediaType(campaign?.media_type);
     
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

      updatedFields.admin_cancel_reason = null;
      updatedFields.slot_start_time = slot_start_time;
    
      updatedFields.slot_end_time = slot_end_time;
      updatedFields.live_start_date = liveStartDate.toDate();
      updatedFields.live_end_date = liveEndDate.toDate();
      updatedFields.approved_date = moment().tz('Asia/Kolkata').toDate();
      
      updatedFields.admin_approved_status = admin_approved_status;
      updatedFields.society_approved_status = society_approved_status;
      if (society_approved_status) {
        updatedFields.society_approved_date = moment().tz('Asia/Kolkata').toDate();
      }
      updatedFields.approved_by = 'Admin';
      updatedFields.approved_date_admin = moment().tz('Asia/Kolkata').toDate();
      // updatedFields.admin_approved_date = admin_date;
      
      // updatedFields.campaign_status = 'approve';
      
      // ✅ Set campaign_status to 'approve' only if society has approved
      if (admin_approved_status === 'approved') {
        updatedFields.campaign_status = 'pending';
      }

      // ✅ Set campaign_status to 'approve' only if society has approved
      if (society_approved_status === 'approved') {
        updatedFields.campaign_status = 'approved';
      }
    }

    await Campaign_Log.update(updatedFields, { where: { id } });

    if (admin_approved_status === 'approved') {
          await Notification.create({
            society_ids: [campaignLog.society_id],
            message: `Campaign ads #${campaignLog.id_prifix_campaign_ads} has been admin approved.`,
            from: 'admin',
            to: 'society',
            notify_type: 'individual',
            created_ip_address: req.ip
          });

          // ✅ Fetch Society Email
          const society = await Society_Registration.findByPk(campaignLog.society_id, {
            attributes: ['email', 'society_name']
          });

          if (society && society.email) {
            // ⬇️ Send email using your mail utility
        
            const baseUrl = process.env.BASE_URL;
            const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

            const emailParams = {
              Source: process.env.AWS_SES_EMAIL, // Or your configured email sender
              Destination: {
                ToAddresses: [society.email]
              },
              Message: {
                Subject: {
                  Data: "New Advertisement Received"
                },
                Body: {
                  Html: {
                    Data: `
                      <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                          <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                        </div>
                        <div style="background:#fff; padding:30px; text-align:left;">
                          <h2 style="color:#000;">New Advertisement Received</h2>
                          <p>Hi ${society.society_name},</p>
                          <p>A new Advertise <strong>${campaignLog.id_prifix_campaign_ads}</strong> is available for review. Please login to your dashboard to approve or reject it.</p>
                          <p>Regards,<br/>ADZ10X Admin Team</p>
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

            // ⬇️ Send the email (replace this with your AWS SES or nodemailer logic)
            await ses.sendEmail(emailParams).promise(); // Example for AWS SES
          }
  }


     if (society_approved_status === 'approved') {
      await Notification.create({
        society_ids: [campaignLog.society_id],
        message: `Campaign ads #${campaignLog.id_prifix_campaign_ads} has been admin with society approved.`,
        from: 'admin',
        to: 'society',
        notify_type: 'individual',
        created_ip_address: req.ip
      });
    }

    const updatedLog = await Campaign_Log.findByPk(id);

      // 🔁 Check all logs under this campaign
      const campaignLogs = await Campaign_Log.findAll({
        where: { campaign_id: campaign.id },
        attributes: ['campaign_status','society_approved_status']
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

              // ✅ Send using AWS SES
              await ses.sendEmail(emailParams).promise();
            }


        }else{
          const hasActive = campaignLogs.some(log => log.campaign_status === 'active');
          const allApprovedOrRejected = campaignLogs.every(log =>
            ['approved', 'reject'].includes(log.campaign_status)
          );

             // ✅ Check that all logs have society_approved_status either 'approved' or 'reject'
          const allSocietyReviewed = campaignLogs.every(log =>
            ['approved', 'reject'].includes(log.society_approved_status)
          );

        // ✅ Update Campaign status ONLY if none are active
        if (!hasActive && allApprovedOrRejected && allSocietyReviewed) {
          await Campaign.update(
            { campaign_status: 'approved' },
            { where: { id: campaign.id } }
          );
          campaignUpdated = true;

                  // 🔔 Add Notification for Full Campaign Approval
          await Notification.create({
            company_ids: [campaignLog.company_id],
            message: `Your campaign #${campaign.id_prifix_campaign} has been fully approved.`,
            from: 'admin',
            to: 'company',
            notify_type: 'individual',
            created_ip_address: req.ip
          });


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
                            <h2 style="color:#000;">Campaign Approved by Admin</h2>
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

              // ✅ Send using AWS SES
              await ses.sendEmail(emailParams).promise();
            }
        }
      }

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

  exports.advertisementADSAdmin = async (req, res) => {
       try {
         const { id, campaign_id, campaign_log_id, society_id, society_user_id, company_id,campaign_status, view_to_company, no_view,no_reactions, performance_remark,  } = req.body;
    
         const userId = req.user.id || null; // logged-in user ID
         const roleName = req.user.role_name || null; // logged-in user role
         const userType = req.user.role_name || null;

          const campaign = await Campaign.findOne({
            where: { id: campaign_id, status: 'active' },
            attributes: ['id','id_prifix_campaign','campaign_date','campaign_status']
          });

          const campaign_log = await Campaign_Log.findOne({
            where: { id: campaign_log_id, status: 'active' },
          });

          if (!campaign) {
            return res.status(404).json({ status: 404, message: "Associated campaign not found" });
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
                    modified_type: 'Admin',
                    report_submited_24_before_date: moment().tz('Asia/Kolkata').toDate()
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
                  company_ids: [company_id],
                  message: `Admin report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
                  from: 'admin',
                  to: 'company',
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
                  created_ip_address: req.ip,
                  created_by: userId,
                  created_type: 'Admin',
                  report_submited_24_before_date: moment().tz('Asia/Kolkata').toDate()
                });

                  // Notify company
                await Notification.create({
                  company_ids: [company_id],
                  message: `Admin report created campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
                  from: 'admin',
                  to: 'company',
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
            const updateData = {
                campaign_id,
                campaign_log_id,
                society_id,
                society_user_id,
                company_id,
                view_to_company,
                no_view,
                no_reactions,
                performance_remark,
                modified_ip_address: req.ip,
                modified_by: userId,
                modified_type: 'Admin',
                report_submited_24_after_date: moment().tz('Asia/Kolkata').toDate()
            };

            if (imagePaths?.upload_view_src_path) {
              updateData.upload_view_src_path = imagePaths.upload_view_src_path;
              updateData.upload_view_src_name = imageNames.upload_view_src_path;
            }
            if (imagePaths?.upload_reaction_src_path) {
              updateData.upload_reaction_src_path = imagePaths.upload_reaction_src_path;
              updateData.upload_reaction_src_name = imageNames.upload_reaction_src_path;
            }
            if (imagePaths?.upload_after_24_ads_src_path) {
              updateData.upload_after_24_ads_src_path = imagePaths.upload_after_24_ads_src_path;
              updateData.upload_after_24_ads_src_name = imageNames.upload_after_24_ads_src_path;
            }

            // Perform update
            await Advertisements.update(updateData, { where: { id } });

                  // Check and update campaign_status
              if (campaign_status == 'completed' && campaign_log_id) {
                await Campaign_Log.update(
                  { 
                    campaign_status: 'completed',
                    report_status:'approved',
                    completed_date: moment().tz('Asia/Kolkata').toDate()
                  },
                  { where: { id: campaign_log_id } }
                );
              }

            // Check all logs under this campaign
                const campaignLogs = await Campaign_Log.findAll({
                  where: { campaign_id: campaign.id },
                  attributes: ['campaign_status','society_approved_status']
                });

              const hasActive = campaignLogs.some(log => log.campaign_status === 'active');
              const allApprovedOrRejected = campaignLogs.every(log =>
                ['reject','completed'].includes(log.campaign_status)
              );

            let campaignUpdated = false;

            // Update Campaign status ONLY if none are active
            if (!hasActive && allApprovedOrRejected) {
              await Campaign.update(
                { campaign_status: 'completed' },
                { where: { id: campaign.id } }
              );
              campaignUpdated = true;
            }

        if (campaign_status === 'completed') {
          // Settlement is handled by admin manual transfer flow.
          // Do not auto-credit society wallet on ad completion.
          await Notification.create({
            company_ids: [company_id],
            message: `Ad shared #${campaign.id_prifix_campaign} for ad #${campaign_log.id_prifix_campaign_ads} with company successfully.`,
            from: 'admin',
            to: 'company',
            notify_type: 'individual',
            created_ip_address: req.ip
          });

          await Advertisements.update(
              { share_status: 'yes' },
              { where: { id } } // make sure to use the correct advertisement ID
          );
        }

        
          return res.status(200).json({ status: 200, 
            message: campaign_status === 'completed'
          ? "Ad shared with company successfully"
          : "Sucessfully uploaded advertisement report",
            // message: "ADS updated successfully", 
            data: advertisement ,
            // society_wallet_amount_add,
            campaignUpdated:campaignUpdated
          });
         }else {

            // ✅ Check if advertisement already exists for this campaign_log_id and active status
                    let existingAd = await Advertisements.findOne({
                      where: {
                        campaign_log_id: campaign_log_id,
                        status: 'active'
                      }
                    });

            if (existingAd) {
            //  Update existing instead of creating new
            await Advertisements.update(
              {
                no_view,
                no_reactions,
                performance_remark,
                view_to_company,
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

            // await Notification.create({
            //   company_ids: [company_id],
            //   message: `Society report updated campaign #${campaign.id_prifix_campaign} for ads #${campaign_log.id_prifix_campaign_ads}`,
            //   from: 'society',
            //   to: 'admin',
            //   notify_type: 'individual',
            //   created_ip_address: req.ip
            // });

            return res.status(200).json({
              status: 200,
              message: "Successfully updated existing advertisement report",
              data: advertisement
            });

          } else {

           //  Create new ad
             advertisement = await Advertisements.create({
             campaign_id,
             campaign_log_id,
             society_id,
             society_user_id,
             company_id,
             view_to_company,
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
             created_type: 'Admin',
             report_submited_24_before_date: moment().tz('Asia/Kolkata').toDate()
           });

           return res.status(200).json({ status: 200,
             message: "Sucessfully uploaded advertisement report",
             data: advertisement,
             campaignUpdated:campaignUpdated
            });
         }
        }
       } catch (error) {
         return res.status(500).json({ status: 500, error: error.message });
       }
   };
   
exports.campaignRejectsDateCrossed = async (req, res) => {
    try {

        const currentIST = moment().tz('Asia/Kolkata');

            // Example input date (you can make it dynamic from query/body)
        // const specificDate = '06-06-2025';
        const specificDate = moment().tz('Asia/Kolkata').startOf('day').format('YYYY-MM-DD');

        // const specificDate = moment().tz('Asia/Kolkata').format('DD-MM-YYYY');

            // Convert the date to the format YYYY-MM-DD
        const formattedDate = moment(specificDate, 'DD-MM-YYYY').format('YYYY-MM-DD');
        const todayCampaigns = await Campaign.findAll({
                              where: {
                                  [Op.and]: [
                                    where(fn('DATE', col('campaign_date')), formattedDate),
                                    { status: 'active' },
                                    { campaign_status: 'pending' }
                                  ]
                                }
                            });

        const campaignsToProcess = specificDate
                    ? todayCampaigns
                    : [];

                    console.log('campaignsToProcess',campaignsToProcess);
                      

        let updatedCount = 0;
        let autoCompletedLogsCount = 0;
        const affectedCampaignIds = new Set();

        // Step 3: Loop through each campaign
        for (const campaign of campaignsToProcess) {
          const campaignId = campaign.id;
          const id_prifix_campaign = campaign.id_prifix_campaign;

          // Get logs with campaign_status not in final list
          const campaignLogs = await Campaign_Log.findAll({
            where: {
              campaign_id: campaignId,
              campaign_status: { [Op.notIn]: ['approved', 'completed', 'reject'] }
            }
          });

        if (campaignLogs.length === 0) continue;

        let hasRefundLogs = false;
        let totalRefundAmount = 0;
        let company = null;

        for (const log of campaignLogs) {
          if (log.refund_status === 'refund') {
            hasRefundLogs = true;
          } else if (log.refund_status === null) {
            totalRefundAmount += parseFloat(log.campaign_ads_amount || 0);
            if (!company) {
              company = await Company_Registration.findByPk(log.company_id);
            }
          }
        }

        // CASE 1: Partial refund already done, refund others individually
        if (hasRefundLogs) {
          for (const log of campaignLogs) {
            if (log.refund_status === 'refund') continue;

            const refundAmount = parseFloat(log.campaign_ads_amount || 0);
            const company = await Company_Registration.findByPk(log.company_id);
            if (company && refundAmount > 0) {
              const previousBalance = parseFloat(company.wallet_amount || 0);
              const newBalance = previousBalance + refundAmount;

              await Wallet.create({
                company_id: company.id,
                company_user_id: null,
                wallet_type: 'credit',
                refund_status: 'refund',
                amount: refundAmount.toFixed(2),
                total_amount: refundAmount.toFixed(2),
                gst_percentage: 0,
                gst_amount: '0.00',
                balance: previousBalance.toFixed(2),
                description: `Fund added for auto refund of campaign #${id_prifix_campaign} for ads #${log.id_prifix_campaign_ads}`,
                invoice_id: null,
                transaction_id: 'TXN' + Date.now(),
                invoice_url_path: null,
                created_ip_address: req.ip,
                created_by: 0,
                created_type: 'System'
              });

                       // 🔔 Create Notification for Refund
              await Notification.create({
                company_ids: [log.company_id],
                message: `Your campaign #${id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
                from: 'admin',
                to: 'company',
                notify_type: 'individual',
                created_ip_address: req.ip
              });

                      // 🔔 Create Notification for Refund
              await Notification.create({
                society_ids: [log.society_id],
                message: `Your campaign #${id_prifix_campaign} for ad #${log.id_prifix_campaign_ads} has been rejected and the amount has been refunded.`,
                from: 'admin',
                to: 'society',
                notify_type: 'individual',
                created_ip_address: req.ip
              });

              await Company_Registration.update(
                { wallet_amount: newBalance.toFixed(2) },
                { where: { id: company.id } }
              );

              await Campaign_Log.update(
                { refund_status: 'refund' },
                { where: { id: log.id } }
              );
            }
          }
        }

        // CASE 2: All logs not refunded
        else if (totalRefundAmount > 0 && company) {
          const previousBalance = parseFloat(company.wallet_amount || 0);
          const newBalance = previousBalance + totalRefundAmount;

          await Wallet.create({
            company_id: company.id,
            company_user_id: null,
            wallet_type: 'credit',
            refund_status: 'refund',
            amount: totalRefundAmount.toFixed(2),
            total_amount: totalRefundAmount.toFixed(2),
            gst_percentage: 0,
            gst_amount: '0.00',
            balance: previousBalance.toFixed(2),
            description: `Fund added for auto refund of campaign #${id_prifix_campaign}`,
            invoice_id: null,
            transaction_id: 'TXN' + Date.now(),
            invoice_url_path: null,
            created_ip_address: req.ip,
            created_by: 0,
            created_type: 'System'
          });


                         // 🔔 Create Notification for Refund
              await Notification.create({
                company_ids: [company.id],
                message: `Your campaign #${id_prifix_campaign} has been rejected and the amount has been refunded.`,
                from: 'admin',
                to: 'company',
                notify_type: 'individual',
                created_ip_address: req.ip
              });

          await Company_Registration.update(
            { wallet_amount: newBalance.toFixed(2) },
            { where: { id: company.id } }
          );

          await Campaign_Log.update(
            { refund_status: 'refund' },
            { where: { campaign_id: campaignId, refund_status: null } }
          );
        }

        // Step 4: Reject each pending campaign log
        await Campaign_Log.update(
          {
            campaign_status: 'reject',
            admin_approved_status: 'reject',
            society_approved_status: 'reject'
          },
          {
            where: {
              campaign_id: campaignId,
              campaign_status: { [Op.notIn]: ['approved', 'completed', 'reject'] }
            }
          }
        );

        updatedCount++;
        affectedCampaignIds.add(campaignId);
      }

      // Step 5: Auto-complete approved logs whose live window has ended.
      const endedLiveLogs = await Campaign_Log.findAll({
        where: {
          status: { [Op.in]: ['active', 'inactive'] },
          campaign_status: 'approved',
          admin_approved_status: 'approved',
          society_approved_status: 'approved',
          live_end_date: { [Op.lt]: currentIST.toDate() }
        },
        attributes: ['id', 'campaign_id']
      });

      for (const log of endedLiveLogs) {
        const [count] = await Campaign_Log.update(
          {
            campaign_status: 'completed',
            report_status: 'approved',
            completed_date: moment().tz('Asia/Kolkata').toDate()
          },
          {
            where: {
              id: log.id,
              campaign_status: 'approved'
            }
          }
        );

        if (count > 0) {
          autoCompletedLogsCount += 1;
          affectedCampaignIds.add(log.campaign_id);
        }
      }

      // Step 6: Update main Campaign status for affected campaigns.
      for (const campaignId of affectedCampaignIds) {
        const allLogs = await Campaign_Log.findAll({
          where: { campaign_id: campaignId },
          attributes: ['campaign_status']
        });

        const allRejected = allLogs.every(log => log.campaign_status === 'reject');
        const allClosed = allLogs.every(log =>
          ['reject', 'completed'].includes(log.campaign_status)
        );

        if (allRejected) {
          await Campaign.update(
            { campaign_status: 'reject' },
            { where: { id: campaignId } }
          );
        } else if (allClosed) {
          await Campaign.update(
            { campaign_status: 'completed' },
            { where: { id: campaignId } }
          );
        }
      }

    return res.status(200).json({
      status: 200,
      message: `${updatedCount} campaign(s) auto-rejected and ${autoCompletedLogsCount} ad log(s) auto-completed.`
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: 'Something went wrong',
      error: error.message
    });
  }
};
