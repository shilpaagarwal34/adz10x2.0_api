const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Society_Media_Rate_Card = require('@models/Society/Advertisement/Society_Media_Rate_Card_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Notification = require('@models/Notifications/Notification_Model');
const path = require('path');
const { where, literal, Sequelize } = require('sequelize');
const { Op,fn, col } = require('sequelize');
const moment = require('moment-timezone');
const { MEDIA_TYPES, normalizeMediaType, isValidMediaType, calculateRateBreakup, getMediaPlatformConfig } = require('@helper/mediaRateHelper');

const resolveRequestedSocietyIds = (body = {}) => {
    const ids = new Set();
    const rawArrays = [body.society_ids, body.society_ind_ids, body["society_ids[]"], body["society_ind_ids[]"]];
    rawArrays.forEach((arr) => {
        if (Array.isArray(arr)) {
            arr.forEach((id) => {
                const num = Number(id);
                if (!Number.isNaN(num) && num > 0) ids.add(num);
            });
        } else if (arr !== undefined && arr !== null) {
            const num = Number(arr);
            if (!Number.isNaN(num) && num > 0) ids.add(num);
        }
    });

    Object.keys(body).forEach((key) => {
        const textMatch = key.match(/^societies_text\[(\d+)\]$/);
        const imageMatch = key.match(/^upload_societies_images_path\[(\d+)\]$/);
        const match = textMatch || imageMatch;
        if (match) {
            const num = Number(match[1]);
            if (!Number.isNaN(num) && num > 0) ids.add(num);
        }
    });

    return Array.from(ids);
};

const getActiveRateCardForDate = async (societyId, mediaType, date) => {
    const normalized = normalizeMediaType(mediaType);
    if (!normalized || !isValidMediaType(normalized)) return null;

    const targetDate = date || moment().format("YYYY-MM-DD");
    return Society_Media_Rate_Card.findOne({
        where: {
            society_id: societyId,
            media_type: normalized,
            status: "active",
            effective_from: { [Op.lte]: targetDate },
            [Op.or]: [
                { effective_to: null },
                { effective_to: { [Op.gte]: targetDate } },
            ],
        },
        order: [["effective_from", "DESC"], ["id", "DESC"]],
    });
};

const getPlatformRulesFromConfig = (campaignConfig = null) => {
    const configuredRules = campaignConfig?.platform_rules || {};
    const mergedRules = {};

    MEDIA_TYPES.forEach((mediaType) => {
        const defaults = getMediaPlatformConfig(mediaType);
        const configured = configuredRules?.[mediaType] || {};
        mergedRules[mediaType] = {
            media_type: mediaType,
            label: defaults.label || mediaType,
            min_lead_days: Number(configured.min_lead_days ?? defaults.min_lead_days ?? 0),
            min_active_days: Number(configured.min_active_days ?? defaults.min_active_days ?? defaults.duration_days ?? 0),
        };
    });

    return mergedRules;
};

const fetchEffectivePlatformRules = async () => {
    const campaignConfig = await Campaign_Configuration.findOne({
        attributes: ['platform_rules'],
        where: { status: 'active' },
        order: [['createdAt', 'ASC']],
    });
    return getPlatformRulesFromConfig(campaignConfig);
};

exports.getCompanySocietyMediaRateCards = async (req, res) => {
    try {
        const { society_id, media_type, campaign_date } = req.query;

        if (!society_id) {
            return res.status(400).json({ status: 400, message: "society_id is required" });
        }

        const whereClause = {
            society_id: Number(society_id),
            status: "active",
        };

        if (media_type) {
            const normalized = normalizeMediaType(media_type);
            if (!isValidMediaType(normalized)) {
                return res.status(400).json({ status: 400, message: "Invalid media_type" });
            }
            whereClause.media_type = normalized;
        }

        if (campaign_date) {
            whereClause[Op.and] = [
                { effective_from: { [Op.lte]: campaign_date } },
                {
                    [Op.or]: [
                        { effective_to: null },
                        { effective_to: { [Op.gte]: campaign_date } },
                    ],
                },
            ];
        }

        const cards = await Society_Media_Rate_Card.findAll({
            where: whereClause,
            order: [["media_type", "ASC"], ["effective_from", "DESC"]],
        });
        const platformRules = await fetchEffectivePlatformRules();

        return res.status(200).json({
            status: 200,
            message: "Company media rate cards fetched successfully",
            media_platforms: Object.values(platformRules),
            data: cards,
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: "Failed to fetch company media rate cards",
            error: error.message,
        });
    }
};

exports.viewCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                status: 400,
                message: 'Campaign ID is required',
            });
        }

        let whereClause = { id };

        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
        }

        const campaigns = await Campaign.findOne({
            where: whereClause,
            attributes: {
                exclude: ['created_ip_address', 'modified_ip_address']
            }
        });

        if (!campaigns) {
            return res.status(404).json({
                status: 404,
                message: 'Campaign not found',
            });
        }

        const campaign_logs = await Campaign_Log.findAll({
            where: { campaign_id: campaigns.id },
            attributes: {
                exclude: ['created_ip_address', 'modified_ip_address']
            }
        });

        let totalFlats = 0;

        for (const log of campaign_logs) {
            // Get society_profile
            const society_profile = await Society_Profile.findOne({
                where: { society_id: log.society_id, status: 'active' },
                attributes: ['number_of_flat']
            });

            const flatCount = society_profile ? parseInt(society_profile.number_of_flat, 10) : 0;
            totalFlats += flatCount;
            log.dataValues.number_of_flat = society_profile ? society_profile.number_of_flat : null;

            // Get society_registration details
            const society_details = await Society_Registration.findOne({
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

            log.dataValues.society = society_details || null;
        }

        const city = campaigns.campaign_city_id
            ? await City.findOne({ where: { id: campaigns.campaign_city_id }, attributes: ['city_name'] })
            : null;

        const area = campaigns.campaign_area_id
            ? await Area.findOne({ where: { id: campaigns.campaign_area_id }, attributes: ['area_name'] })
            : null;

        const campaignDate = campaigns.campaign_date
            ? new Intl.DateTimeFormat('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(new Date(campaigns.campaign_date)).replace(',', ' -')
            : null;

        const formattedCreatedAt = campaigns.createdAt
            ? new Intl.DateTimeFormat('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }).format(new Date(campaigns.createdAt)).replace(',', ' -')
            : null;

        let name = null;
        let company_name = null;
        let address_line_1 = null;
        let address_line_2 = null;

        if (campaigns.created_by) {
            if (campaigns.created_type === 'Company_User') {
                const companyUser = await Company_User.findOne({ where: { id: campaigns.created_by } });

                if (companyUser) {
                    const company = await Company_Registration.findOne({
                        where: { id: companyUser.company_id },
                        attributes: ['name', 'company_name', 'address_line_1', 'address_line_2']
                    });

                    if (company) {
                        name = company.name;
                        company_name = company.company_name;
                        address_line_1 = company.address_line_1;
                        address_line_2 = company.address_line_2;
                    }
                }

            } else if (campaigns.created_type === 'Company_Admin') {
                const company = await Company_Registration.findOne({
                    where: { id: campaigns.created_by },
                    attributes: ['name', 'company_name', 'address_line_1', 'address_line_2']
                });

                if (company) {
                    name = company.name;
                    company_name = company.company_name;
                    address_line_1 = company.address_line_1;
                    address_line_2 = company.address_line_2;
                }
            }
        }

        const campaign = {
            ...campaigns.toJSON(),
            city_name: city ? city.city_name : null,
            area_name: area ? area.area_name : null,
            campaign_date: campaignDate,
            formatted_created_at: formattedCreatedAt,
        };

       for (const log of campaign_logs) {
            const formattedUpdatedAt = log.updatedAt
                ? moment(log.updatedAt).format('D MMM YYYY h:mma')
                : null;

            const formatted_approved_date = log.approved_date
                ? moment(log.approved_date).format('D MMM YYYY h:mma')
                : null;

            const formatted_admin_approved_date = log.approved_date_admin
                       ? moment(campaign_logs.approved_date_admin).format('D MMM YYYY H:mma')
                       : null;
            
            const formatted_society_approved_date = log.society_approved_date
            ? moment(campaign_logs.society_approved_date).format('D MMM YYYY H:mma')
            : null;

            const formatted_cancel_date = log.cancel_date
                ? moment(log.cancel_date).format('D MMM YYYY h:mma')
                : null;

            let approved_by = '';
            if (
                log.society_approved_status === null ||
                log.society_approved_status === '' ||
                log.society_approved_status === 'pending'
            ) {
                if (log.admin_approved_status === 'approved') {
                    approved_by = 'Admin';
                }
            } else if (
                log.admin_approved_status === 'approved' &&
                log.society_approved_status === 'approved'
            ) {
                approved_by = 'Society';
            }

            let cancelled_by = '';
            if (log.admin_approved_status === 'reject') {
                cancelled_by = 'Admin';
            } else if (log.society_approved_status === 'reject') {
                cancelled_by = 'Society';
            }

            log.setDataValue('updatedAtFormatted', formattedUpdatedAt);
            log.setDataValue('approved_date', formatted_approved_date);
            log.setDataValue('admin_approved_date',formatted_admin_approved_date);
            log.setDataValue('society_approved_date',formatted_society_approved_date);
            log.setDataValue('cancel_date', formatted_cancel_date);
            // log.setDataValue('approved_by', approved_by);
            log.setDataValue('cancelled_by', cancelled_by);
            log.setDataValue('cancel_reason', log.admin_cancel_reason || log.society_cancel_reason);
        }

        return res.status(200).json({
            status: 200,
            message: 'Campaign fetched successfully',
            data: {
                campaign,
                total_flats: totalFlats,
                company: {
                    name,
                    company_name,
                    address_line_1,
                    address_line_2
                },
                campaign_logs
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
                 where: { id: id, status: 'active' }, // if applicable
                 attributes:['id','campaign_id','id_prifix_campaign_ads','society_id','company_id','admin_cancel_reason','society_cancel_reason','campaign_ads_amount','upload_societies_images_path','upload_societies_images_name','societies_text','campaign_status','society_approved_status','admin_approved_status','approved_by','approved_date','society_approved_date','approved_date_admin','slot_start_time','slot_end_time','live_start_date','live_end_date','modified_by','modified_type','updatedAt']
            });

            const campaign = await Campaign.findOne({
              where: { id: campaign_logs.campaign_id, status: 'active' },
              attributes: ['id', 'company_id', 'id_prifix_campaign', 'campaign_type', 'campaign_date', 'creative_type', 'campaign_name','campaign_status']
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
                    ? moment(campaignData.campaign_date).format('D MMM YYYY h:mma')  // Output: 6 May 2025 1:10pm
                    : null;
            
              formatted_campaign = {
                ...campaignData,
                campaign_date: formattedDate,
                formatted_campaign_date: formattedcampaign_date
              };
            }
  
           if (!campaign_logs) {
              return res.status(404).json({
                  status: 404,
                  message: 'campaign logs not found or access denied',
              });
          }
  
           // Fetch advertisement with ownership check
           const society = await Society_Registration.findOne({
            where: { id: campaign_logs.society_id }, // if applicable
            attributes:['id','society_name','name','society_profile_img_path','society_profile_img_name','address','relationship_manager_id']
          });

            // Fetch advertisement with ownership check
           const society_profile = await Society_Profile.findOne({
            where: { society_id: society.id }, // if applicable
            attributes:['number_of_flat']
          });
          

          const company = await Company_Registration.findOne({
            where: { id: campaign_logs.company_id }, // if applicable
            attributes:['id','company_name','name','company_profile_photo_path','company_profile_photo_name','address_line_1','address_line_2']
          });
  
          const rel_manager = await Master_Admin.findOne({
             where: { id:society.relationship_manager_id}
          });
  
          // const society_profile = await Society_Profile.findOne({
          //   where: { society_id: society.id, status: 'active' } // if applicable
          // });
  
         // Fetch advertisement with ownership check
          const advertisement = await Advertisements.findOne({
            where: { campaign_log_id: campaign_logs.id, status: 'active' } // if applicable
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
          
                    campaign_logs.setDataValue('updatedAtFormatted', formattedUpdatedAt);
                    campaign_logs.setDataValue('modified_by_name', modified_by_name);
                    campaign_logs.setDataValue('cancel_reason', campaign_logs.admin_cancel_reason || campaign_logs.society_cancel_reason);
                    society.setDataValue('number_of_flat', society_profile.number_of_flat);
  
                    
                    // const formattedUpdatedAt = campaign_logs.updatedAt
                    //     ? moment(campaign_logs.updatedAt).format('D MMM YYYY h:mma')
                    //     : null;
                  
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
                  
                    //   campaign_logs.setDataValue('updatedAtFormatted', formattedUpdatedAt);
                      campaign_logs.setDataValue('modified_by_name', modified_by_name);
                      campaign_logs.setDataValue('approved_date', formatted_approved_date);
                      campaign_logs.setDataValue('admin_approved_date', formatted_admin_approved_date);
                      campaign_logs.setDataValue('society_approved_date', formatted_society_approved_date);
                      campaign_logs.setDataValue('cancel_date', formatted_cancel_date);
                    //   campaign_logs.setDataValue('approved_by', approved_by);
                      campaign_logs.setDataValue('cancelled_by', cancelled_by);
                      campaign_logs.setDataValue('cancel_reason', campaign_logs.admin_cancel_reason || campaign_logs.society_cancel_reason);
                  

          return res.status(200).json({
              status: 200,
              message: 'Campaign Log fetched successfully',
              data: {
                 society,
                 company,
                 campaign:formatted_campaign,
                 rel_managers:{
                  name:rel_manager.user_name,
                  designation:rel_manager.role_name,
                  mobile_no:rel_manager.mobile_no
               },
                //  society_profile,
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

exports.campaignDataTable = async (req, res) => {
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
     
        // ✅ Filter by company_id based on authenticated user
        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id; // Company_Admin's ID is company_id
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id; // Company_User has company_id
        }

        // Search filter
        if (campaign_status) {
            whereClause.campaign_status = campaign_status;
        }

        if (search) {
            whereClause[Op.or] = [
                literal(`CAST("id" AS TEXT) ILIKE '%${search}%'`),
                { campaign_type: { [Op.iLike]: `%${search}%` } },
                { creative_type: { [Op.iLike]: `%${search}%` } },
                { campaign_name: { [Op.iLike]: `%${search}%` } },
                literal(`TO_CHAR("createdAt", 'YYYY-MM-DD') ILIKE '%${search}%'`)
            ];
        }

        const approvedCount = await Campaign.count({
            where: { ...whereClause, campaign_status: 'approved' }
            });
    
            const pendingCount = await Campaign.count({
            where: { ...whereClause, campaign_status: 'pending' }
            });

            const cancelledCount = await Campaign.count({
            where: { ...whereClause, campaign_status: 'reject' }
            });

            const draftCount = await Campaign.count({
            where: { ...whereClause, campaign_status: 'draft' }
            });

            const completedCount = await Campaign.count({
            where: { ...whereClause, campaign_status: 'completed' }
            });

        const total = await Campaign.count({ where: whereClause });

        const campaign = await Campaign.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: ['id',  'campaign_name','company_id','report_status', 'creative_type', 'campaign_type', 'campaign_status', 'createdAt', 'status']
        });

        const formattedCampaigns = campaign.map(item => {
            const createdAt = new Date(item.createdAt);
            const dayName = createdAt.toLocaleDateString('en-US', { weekday: 'long' });
            const day = createdAt.getDate().toString().padStart(2, '0');
            const month = createdAt.toLocaleDateString('en-US', { month: 'long' });
            const year = createdAt.getFullYear();

            return {
                ...item.toJSON(),
                createdAtFormatted: `${dayName} ${day}-${month} ${year}`
            };
        });

        return res.status(200).json({
            status: 200,
            table_name: 'company_campaigns',
            message: 'Campaign fetched successfully',
            total,
            page,
            limit,
            draftCount,
            approvedCount,
            pendingCount,
            cancelledCount,
            completedCount,
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

exports.getCampaignType = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user_type;
        let comapnyId = null;

        // Identify company ID from user type
        if (userType === "Company_Admin") {
            const user = await Company_Registration.findOne({ where: { id: userId } });
            comapnyId = user.id;
        } else if (userType === "Company_User") {
            const companyUser = await Company_User.findOne({ where: { id: userId } });
            comapnyId = companyUser.company_id;
        }

        // Fetch company settings
        const companyData = await Company_Registration.findOne({
            where: { id: comapnyId },
            attributes: ['brand_promotion', 'lead_generation', 'survey']
        });

        const { brand_promotion, lead_generation, survey } = companyData;

        let campaign

        if(!companyData){

            // Fetch campaign data since none of the fields are set
            campaign = await Campaign_Configuration.findOne({
                where: { status: 'active' },
                order: [['id', 'ASC']],
                attributes: ['brand_promotion', 'lead_generation', 'survey']
            });
    
            if (!campaign) {
                return res.status(404).json({ status: 404, message: 'Campaign not found' });
            }
        }


        return res.status(200).json({
            status: 200,
            message: 'Campaign fetched successfully',
            data: campaign || companyData
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 500, message: 'Internal server error', error: err.message });
    }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

exports.getSocietiesWithinRadius = async (req, res) => {
    try {
        const {
            campaign_city_id,
            campaign_area_id,
            my_ads_location_latitude,
            my_ads_location_longitude,
            // campaign_date,
            campaignDate: campaign_date,   // rename here
            day,
            radius_km,
            media_type
        } = req.body;
        const platformRules = await fetchEffectivePlatformRules();

     
        let campaigns = [];
        let campaignsWithLogs = [];

        // 1. Fetch campaigns by campaign_date (if provided)
        if (campaign_date) {
      
            const campaigns = await Campaign.findAll({
                where: where(fn('DATE', col('campaign_date')), campaign_date),
                attributes: ['id', 'company_id', 'campaign_date']
            });

            // if (campaigns.length === 0) {
            //     return res.status(404).json({ status: 404, message: "No campaigns found for the given date" });
            // }

            const campaignIds = campaigns.map(c => c.id);

            const campaignLogs = await Campaign_Log.findAll({
                where: {
                    campaign_id: {
                        [Op.in]: campaignIds
                    },
                },
                attributes: ['id', 'campaign_id', 'society_id']
            });

            campaignsWithLogs = campaigns.map(campaign => {
                const logsForCampaign = campaignLogs.filter(log => log.campaign_id === campaign.id);
                return {
                    ...campaign.dataValues,
                    logs: logsForCampaign
                };
            });
        }

        // 2. Filter societies (kyc_status = approved is set by admin; account_status kept in sync on approve)
        const whereCondition = { 
            status: "active",
            [Op.or]: [
                { account_status: "approved" },
                { kyc_status: "approved" }
            ]
        };
        if (campaign_city_id) whereCondition.city_id = campaign_city_id;
        if (campaign_area_id) whereCondition.area_id = campaign_area_id;

        const societies = await Society_Registration.findAll({
            where: whereCondition,
            // attributes: ['id', 'longitude', 'latitude', 'city_id', 'area_id']
        });

        const applyRadiusFilter = my_ads_location_latitude && my_ads_location_longitude && radius_km;
        const societiesWithinRadius = [];

        for (const society of societies) {
            if (applyRadiusFilter) {
                if (!society.latitude || !society.longitude) continue;

                const distance = calculateDistance(
                    parseFloat(my_ads_location_latitude),
                    parseFloat(my_ads_location_longitude),
                    parseFloat(society.latitude),
                    parseFloat(society.longitude)
                );

                if (distance > parseFloat(radius_km)) continue;
            }

            const profile = await Society_Profile.findOne({
                where: { society_id: society.id },
                // attributes: ['id', 'society_id', 'ads_per_day']
            });

            // 🔢 Count how many times this society is used in campaign logs
            let used = 0;
            if (campaignsWithLogs.length > 0) {
                campaignsWithLogs.forEach(c => {
                    used += c.logs.filter(log => log.society_id === society.id).length;
                });
            }

            const allowed = profile?.ads_per_day ?? 0;
            const disable = used >= allowed;
            let disable_message = disable ? `Ad limit (${allowed}) reached for this society on ${campaign_date}` : '';

            let media_rate = null;
            if (media_type && isValidMediaType(media_type)) {
                const activeRateCard = await getActiveRateCardForDate(
                    society.id,
                    media_type,
                    campaign_date
                );

                if (activeRateCard) {
                    media_rate = {
                        id: activeRateCard.id,
                        media_type: activeRateCard.media_type,
                        society_rate: Number(activeRateCard.society_rate) || 0,
                        platform_commission_pct: Number(activeRateCard.platform_commission_pct) || 0,
                        platform_rate: Number(activeRateCard.platform_rate) || 0,
                        company_rate: Number(activeRateCard.company_rate) || 0,
                        effective_from: activeRateCard.effective_from,
                        effective_to: activeRateCard.effective_to,
                    };
                } else {
                    media_rate = null;
                    disable_message = disable_message
                        ? `${disable_message} | Selected media slot is not offered by this society`
                        : "Selected media slot is not offered by this society";
                }
            }

            // All media platforms this society offers (for display on company portal)
            const offeredCards = await Society_Media_Rate_Card.findAll({
                where: { society_id: society.id, status: 'active' },
                attributes: ['media_type'],
                raw: true,
            });
            const offered_media_types = [...new Set((offeredCards || []).map((c) => c.media_type).filter(Boolean))];

            societiesWithinRadius.push({
                society,
                profile,
                used,
                allowed,
                disable: disable || (media_type && !media_rate),
                disable_message,
                media_rate,
                offered_media_types,
            });
        }

        if (societiesWithinRadius.length === 0) {
            return res.status(404).json({ status: 404, message: "No societies found" });
        }

        res.status(200).json({
            status: 200,
            message: "Societies fetched successfully",
            total: societiesWithinRadius.length,
            city_id: campaign_city_id || null,
            area_id: campaign_area_id || null,
            media_platforms: Object.values(platformRules),
            selected_media_constraints: media_type ? platformRules[normalizeMediaType(media_type)] || null : null,
            // campaigns: campaignsWithLogs,
            data: societiesWithinRadius
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 500, message: "Failed to fetch societies", error: error.message });
    }
};

exports.createOrUpdateCampaign = async (req, res) => {
    try {
        const {
            id, campaign_type, creative_type, lead_generation_url, survey_url, campaign_name, campaign_date,campaign_city_id, 
            campaign_area_id,campaign_address, my_ads_location_latitude, my_ads_location_longitude, radius_km,
            search_by_google_location, brand_promotions_creative, campaign_amount, creative_text,campaign_ads_amount, campaign_status, societies_text, media_type
        } = req.body;

        const userId = req.user.id;
        const userType = req.user_type;
        let comapnyId = null;
        let comapnyUserId = null;

        // Determine company and user IDs
        if (userType === "Company_Admin") {
            let user = await Company_Registration.findOne({ where: { id: userId } });
            comapnyId = user.id;
        }   

        if (userType === "Company_User") {
            let companyUser = await Company_User.findOne({ where: { id: userId } });
            comapnyId = companyUser.company_id;
            comapnyUserId = companyUser.id;
        }

        const normalizedMediaType = normalizeMediaType(media_type);
        if (normalizedMediaType && !isValidMediaType(normalizedMediaType)) {
            return res.status(400).json({
                status: 400,
                message: "Invalid media_type selected",
            });
        }

        const platformRules = await fetchEffectivePlatformRules();
        const selectedPlatformRule = normalizedMediaType
            ? platformRules[normalizedMediaType] || null
            : null;

        if (normalizedMediaType && campaign_date) {
            const minLeadDays = Number(selectedPlatformRule?.min_lead_days || 0);
            const minAllowedDate = moment().startOf("day").add(minLeadDays, "days");
            const chosenDate = moment(campaign_date).startOf("day");

            if (!chosenDate.isValid()) {
                return res.status(400).json({
                    status: 400,
                    message: "Invalid campaign_date",
                });
            }

            if (chosenDate.isBefore(minAllowedDate)) {
                return res.status(400).json({
                    status: 400,
                    message: `Campaign start date for selected platform must be at least ${minLeadDays} day(s) from today`,
                    min_allowed_date: minAllowedDate.format("YYYY-MM-DD"),
                    platform_constraints: selectedPlatformRule,
                });
            }
        }

        const selectedSocietyIds = resolveRequestedSocietyIds(req.body);
        const pricingBySociety = {};
        let resolvedCampaignAmount = Number(campaign_amount) || 0;

        if (normalizedMediaType && isValidMediaType(normalizedMediaType) && selectedSocietyIds.length > 0) {
            let runningTotal = 0;
            for (const societyId of selectedSocietyIds) {
                const activeRateCard = await getActiveRateCardForDate(societyId, normalizedMediaType, campaign_date);
                const breakup = activeRateCard
                    ? {
                        society_rate: Number(activeRateCard.society_rate) || 0,
                        platform_commission_pct: Number(activeRateCard.platform_commission_pct) || 0,
                        platform_rate: Number(activeRateCard.platform_rate) || 0,
                        company_rate: Number(activeRateCard.company_rate) || 0,
                    }
                    : calculateRateBreakup(0, normalizedMediaType);

                pricingBySociety[societyId] = breakup;
                runningTotal += breakup.company_rate;
            }
            resolvedCampaignAmount = Number(runningTotal.toFixed(2));
        }

        const buildSocietyPricingPayload = (societyId) => {
            const pricing = pricingBySociety[Number(societyId)];
            if (!pricing) {
                return {
                    campaign_ads_amount: Number(campaign_ads_amount) || 0,
                    media_type: normalizedMediaType || null,
                    society_rate_snapshot: null,
                    platform_commission_pct_snapshot: null,
                    platform_rate_snapshot: null,
                    company_rate_snapshot: null,
                };
            }

            return {
                campaign_ads_amount: pricing.company_rate,
                media_type: normalizedMediaType,
                society_rate_snapshot: pricing.society_rate,
                platform_commission_pct_snapshot: pricing.platform_commission_pct,
                platform_rate_snapshot: pricing.platform_rate,
                company_rate_snapshot: pricing.company_rate,
            };
        };

        let campaign;
        let CampaignLogs = []; // Initialize empty array to store logs

        if (id) {
        // Try to find existing campaign by ID
        campaign = await Campaign.findOne({ where: { id } });

        if (campaign) {
            let finalCampaignStatus = campaign.campaign_status;

            if (campaign.campaign_status === 'pending') {
                return res.status(400).json({
                    status: 400,
                    message: 'Campaign already created and is pending'
                });
            }

            // Deduct wallet only if campaign is in draft
            if (req.body.campaign_status === 'pending') {
                const company = await Company_Registration.findOne({ where: { id: comapnyId } });

                if (!company) {
                    return res.status(400).json({ status: 400, message: 'Company not found' });
                }

                if (company.wallet_amount >= resolvedCampaignAmount) {
                    let previousBalance = company.wallet_amount;
                    company.wallet_amount -= resolvedCampaignAmount;
                    await company.save();

                    await Wallet.create({
                        company_id: comapnyId,
                        company_user_id: comapnyUserId,
                        wallet_type: "debit",
                        amount: resolvedCampaignAmount,
                        total_amount: resolvedCampaignAmount,
                        gst_percentage: 0,
                        gst_amount: 0,
                        balance: previousBalance,
                        transaction_id: 'TXN' + Date.now(),
                        // description: `Fund debited for Campaign ID ${campaign.id}`,
                        description: `Fund debited for Campaign #${campaign.id_prifix_campaign}`,
                        invoice_id: null,
                        invoice_url_path: null,
                        created_ip_address: req.ip,
                        created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                        created_type: userType
                    });

                    finalCampaignStatus = 'pending';
                } else {
                    finalCampaignStatus = 'draft';
                }
            }

            // Update the campaign
          campaign = await campaign.update({
                company_id: comapnyId,
                company_user_id: comapnyUserId,
                campaign_type,
                creative_type,
                lead_generation_url,
                survey_url,
                campaign_name,
                campaign_amount: resolvedCampaignAmount,
                campaign_date,
                media_type: normalizedMediaType || null,
                campaign_area_id,
                campaign_address,
                my_ads_location_latitude,
                my_ads_location_longitude,
                radius_km,
                search_by_google_location,
                brand_promotions_creative,
                creative_text,
                campaign_status: finalCampaignStatus,
                modified_ip_address: req.ip,
                modified_type: userType,
                modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
            });

            let userMessage = 'Campaign updated successfully';
            if (finalCampaignStatus === 'draft') {
                userMessage = 'Insufficient wallet balance. Campaign saved as draft';
            }

            let creativeImage = null;
            let creativeVideo = null;
            const CampaignLogs = [];

            const usedSocietyIds = new Set();

// ✅ Step A: From req.body.society_ids (if any)
if (Array.isArray(req.body.society_ids)) {
    req.body.society_ids.forEach(id => {
        const num = parseInt(id);
        if (!isNaN(num)) usedSocietyIds.add(num);
    });
}
console.log('Step A - From req.body.society_ids:', req.body.society_ids);

// ✅ Step B: From req.body.society_ind_ids (used as base)
if (Array.isArray(req.body.society_ind_ids)) {
    req.body.society_ind_ids.forEach(id => {
        const num = parseInt(id);
        if (!isNaN(num)) usedSocietyIds.add(num);
    });
}
console.log('Step B - From req.body.society_ind_ids:', req.body.society_ind_ids);

// ✅ Step C: From societies_text[ID] keys
const textKeys = [];
for (const key in req.body) {
    const match = key.match(/^societies_text\[(\d+)\]$/);
    if (match) {
        const socId = parseInt(match[1]);
        if (!isNaN(socId)) usedSocietyIds.add(socId);
        textKeys.push(`${key}: ${req.body[key]}`);
    }
}
console.log('Step C - From societies_text keys:', textKeys);

// ✅ Step D: From upload_societies_images_path[ID] keys
const imageKeys = [];
for (const key in req.body) {
    const match = key.match(/^upload_societies_images_path\[(\d+)\]$/);
    if (match) {
        const socId = parseInt(match[1]);
        if (!isNaN(socId)) usedSocietyIds.add(socId);
        imageKeys.push(`${key}: ${req.body[key]}`);
    }
}
console.log('Step D - From upload_societies_images_path keys:', imageKeys);

// ✅ Final Combined Set
const finalUsedSocietyIds = Array.from(usedSocietyIds);
const societyIds = [...finalUsedSocietyIds];
console.log('✅ All collected society IDs (usedSocietyIds):', finalUsedSocietyIds);

// ✅ Fetch existing logs
const existingLogs = await Campaign_Log.findAll({
    where: { campaign_id: campaign.id },
    attributes: ['society_id']
});
const existingSocietyIds = existingLogs.map(log => log.society_id);
console.log('📦 Existing society_ids in DB:', existingSocietyIds);

// ✅ Find IDs to delete
const toDeleteSocietyIds = existingSocietyIds.filter(id => !usedSocietyIds.has(id));
console.log('🗑️ Society IDs to delete:', toDeleteSocietyIds);

// ✅ Delete
if (toDeleteSocietyIds.length > 0) {
    await Campaign_Log.destroy({
        where: {
            campaign_id: campaign.id,
            society_id: toDeleteSocietyIds
        }
    });
    console.log('✅ Deleted society_ids:', toDeleteSocietyIds);
}


            


            // Function to handle file uploads and logs
            const processFileForSocieties = async (file, societyIds) => {
                const imagePath = `uploads/${file.filename}`;
                const imageName = file.filename;

                for (const socId of societyIds) {
                    const existingLog = await Campaign_Log.findOne({
                        where: { campaign_id: campaign.id, society_id: socId }
                    });

                    let logData = {
                        campaign_id: campaign.id,
                        company_id: comapnyId,
                        company_user_id: comapnyUserId,
                        society_id: socId,
                        campaign_type,
                        creative_type,
                        lead_generation_url,
                        survey_url,
                        campaign_name,
                        campaign_date,
                        campaign_area_id,
                        ...buildSocietyPricingPayload(socId),
                        my_ads_location_latitude,
                        my_ads_location_longitude,
                        radius_km,
                        search_by_google_location,
                        brand_promotions_creative,
                        creative_text,
                        campaign_status: finalCampaignStatus,
                        societies_text: req.body.societies_text || null,
                        upload_societies_images_path: imagePath,
                        upload_societies_images_name: imageName,
                    };

                    if (existingLog) {
                        await existingLog.update({
                            ...logData,
                            modified_ip_address: req.ip,
                            modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                            modified_type: userType,
                        });
                        CampaignLogs.push(existingLog);
                    } else {
                        const newLog = await Campaign_Log.create({
                            ...logData,
                            created_ip_address: req.ip,
                            created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                            created_type: userType,
                        });
                        CampaignLogs.push(newLog);
                    }
                }
            };

            // Handle files
            // const societiesText = req.body.societies_text || [];
              let societiesText = [];

            if (req.body.societies_text) {
            if (typeof req.body.societies_text === 'string') {
                try {
                const parsed = JSON.parse(req.body.societies_text);
                societiesText = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                societiesText = [];
                }
            } else if (Array.isArray(req.body.societies_text)) {
                societiesText = req.body.societies_text;
            }
            }

            if (Array.isArray(req.files)) {
                for (const file of req.files) {
                    const fieldName = file.fieldname;
                    if (fieldName === "upload_creative_image_path") {
                        creativeImage = file;
                    } else if (fieldName === "upload_creative_video_path") {
                        creativeVideo = file;
                    } else if (fieldName.startsWith("upload_societies_images_path[")) {
                        const match = fieldName.match(/^upload_societies_images_path\[(\d+)\]$/);
                        if (match) {
                            const socId = match[1];
                            await processFileForSocieties(file, [socId]);
                        }
                    }
                }

                // Process common creative image/video for all societies
                if (creativeImage && societyIds.length > 0) {
                    await processFileForSocieties(creativeImage, societyIds);
                }

                if (creativeVideo && societyIds.length > 0) {
                    await processFileForSocieties(creativeVideo, societyIds);
                }
            }

            // Process societies text without images
            // const hasSocietiesText = societiesText.some(text => text && text.trim() !== "");
           const hasSocietiesText = Array.isArray(societiesText) && societiesText.some(text => text && text.trim() !== "");

            const rawCreativeText = req.body.brand_promotions_creative;
            const creativeTextTrimmed = typeof rawCreativeText === "string" ? rawCreativeText.trim() : "";
            const useCommonText = creativeTextTrimmed !== "" && creativeTextTrimmed.toLowerCase() !== "false";
            const commonText = useCommonText ? (societiesText[0] && societiesText[0].toLowerCase() !== "false" ? societiesText[0] : creativeTextTrimmed) : null;

            if (hasSocietiesText && (!Array.isArray(req.files) || req.files.length === 0)) {
            if(commonText){
                    for (let i = 0; i < societyIds.length; i++) {
                    const socId = societyIds[i];
                    const text = useCommonText ? commonText : societiesText[i];

                    if (text && text.trim() !== "") {
                        const existingLog = await Campaign_Log.findOne({
                            where: { campaign_id: campaign.id, society_id: socId }
                        });

                        let logData = {
                            campaign_id: campaign.id,
                            company_id: comapnyId,
                            company_user_id: comapnyUserId,
                            society_id: socId,
                            campaign_type,
                            creative_type,
                            lead_generation_url,
                            survey_url,
                            campaign_name,
                            campaign_date,
                            campaign_area_id,
                            ...buildSocietyPricingPayload(socId),
                            my_ads_location_latitude,
                            my_ads_location_longitude,
                            radius_km,
                            search_by_google_location,
                            brand_promotions_creative,
                            creative_text,
                            campaign_status: finalCampaignStatus,
                            societies_text: text,
                            upload_societies_images_path: null,
                            upload_societies_images_name: null,
                        };

                        if (existingLog) {
                            await existingLog.update({
                                ...logData,
                                modified_ip_address: req.ip,
                                modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                                modified_type: userType,
                            });
                            CampaignLogs.push(existingLog);
                        } else {
                            const newLog = await Campaign_Log.create({
                                ...logData,
                                created_ip_address: req.ip,
                                created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                                created_type: userType,
                            });
                            CampaignLogs.push(newLog);
                        }
                    }
                }
            }else {
                for (let i = 0; i < societiesText.length; i++) {
                        const text = societiesText[i];
                        if (text && text.trim() !== "") {
                            // Map i as index for societyIds
                            const socId =i;

                            const existingLog = await Campaign_Log.findOne({
                            where: { campaign_id: campaign.id, society_id: socId }
                        });

                        let logData = {
                            campaign_id: campaign.id,
                            company_id: comapnyId,
                            company_user_id: comapnyUserId,
                            society_id: socId,
                            campaign_type,
                            creative_type,
                            lead_generation_url,
                            survey_url,
                            campaign_name,
                            campaign_date,
                            campaign_area_id,
                            ...buildSocietyPricingPayload(socId),
                            my_ads_location_latitude,
                            my_ads_location_longitude,
                            radius_km,
                            search_by_google_location,
                            brand_promotions_creative,
                            creative_text,
                            campaign_status: finalCampaignStatus,
                            societies_text: text,
                            upload_societies_images_path: null,
                            upload_societies_images_name: null,
                        };

                        if (existingLog) {
                            await existingLog.update({
                                ...logData,
                                modified_ip_address: req.ip,
                                modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                                modified_type: userType,
                            });
                            CampaignLogs.push(existingLog);
                        } else {
                            const newLog = await Campaign_Log.create({
                                ...logData,
                                created_ip_address: req.ip,
                                created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                                created_type: userType,
                            });
                            CampaignLogs.push(newLog);
                        }
                        }
                    }
            }
        }
                if (campaign.campaign_status === 'pending') {
                await Notification.create({
                    company_ids: [comapnyId], // Uncomment if needed
                    message: `Campaign #${campaign.id_prifix_campaign} has been created by the company and is awaiting approval.`,
                    from: 'company',
                    to: 'admin',
                    notify_type: 'individual',
                    created_ip_address: req.ip
                });
            }

            return res.status(200).json({
                status: 200,
                message: userMessage,
                data: {
                    campaign,
                    logs: CampaignLogs
                }
            });
        }
    }
                // Before campaign is created
        let finalCampaignStatus = campaign_status;
        let shouldCreateDebit = false;
        let previousBalance

        if (campaign_status === 'pending') {
            const company = await Company_Registration.findOne({ where: { id: comapnyId } });

            if (!company) {
                return res.status(400).json({ status: 400, message: 'Company not found' });
            }

            if (company.wallet_amount >= resolvedCampaignAmount) {
                previousBalance = company.wallet_amount;
                // Deduct wallet balance
                company.wallet_amount -= resolvedCampaignAmount;
                await company.save();
                shouldCreateDebit = true; // mark for later
                finalCampaignStatus = 'pending';
            } else {
                // Insufficient funds — downgrade to draft
                finalCampaignStatus = 'draft';
            }
        }

        let userMessage = 'Campaign created successfully';
        if (finalCampaignStatus === 'draft') {
            userMessage = 'Insufficient wallet balance. Campaign saved as draft';
        }

        if (campaign_status === 'draft'){
            userMessage = 'Campaign saved as draft';
        }

        // Create a new campaign if no ID is provided or if campaign not found
        const newCampaign = await Campaign.create({
            company_id: comapnyId,
            company_user_id: comapnyUserId,
            campaign_type,
            creative_type,
            lead_generation_url,
            survey_url,
            campaign_amount: resolvedCampaignAmount,
            campaign_name,
            campaign_date,
            media_type: normalizedMediaType || null,
            campaign_city_id,
            campaign_area_id,
            campaign_address,
            my_ads_location_latitude,
            my_ads_location_longitude,
            radius_km,
            search_by_google_location,
            brand_promotions_creative,
            creative_text,
            campaign_status:finalCampaignStatus,
            created_ip_address: req.ip,
            created_type: userType,
            created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
        });

        const formattedId = newCampaign.id < 10 ? `0${newCampaign.id}` : `${newCampaign.id}`;
        const generatedPrefixCampaign = `ADZ10XCP${formattedId}`;
        await newCampaign.update({ id_prifix_campaign: generatedPrefixCampaign });

                // ✅ Then create the wallet debit entry linked to campaign
        if (shouldCreateDebit) {
            await Wallet.create({
                company_id: comapnyId,
                company_user_id: comapnyUserId,
                wallet_type: "debit",
                amount: resolvedCampaignAmount,
                total_amount: resolvedCampaignAmount,
                gst_percentage: 0,
                gst_amount: 0,
                balance: previousBalance,
                transaction_id: 'TXN' + Date.now(),
                // description: `Fund debited for Campaign ID ${newCampaign.id}`,
                description: `Fund debited for Campaign #${generatedPrefixCampaign}`,
                campaign_id: newCampaign.id, // ✅ link to campaign
                invoice_id: null,
                invoice_url_path: null,
                created_ip_address: req.ip,
                created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                created_type: userType
            });
        }

        const societyIds = req.body.society_ids || [];

        
        const processFileForSocieties = async (file, societyIds) => {
            const imagePath = `uploads/${file.filename}`;
            const imageName = file.filename;
        
            // Iterate over all society IDs and create a log entry for each society
            for (const socId of societyIds) {
                const log = await Campaign_Log.create({
                    campaign_id: newCampaign.id,
                    company_id: comapnyId,
                    company_user_id: comapnyUserId,
                    society_id: socId,
                    campaign_type,
                    creative_type,
                    lead_generation_url,
                    survey_url,
                    campaign_name,
                    campaign_date,
                    campaign_area_id,
                    ...buildSocietyPricingPayload(socId),
                    my_ads_location_latitude,
                    my_ads_location_longitude,
                    radius_km,
                    search_by_google_location,
                    brand_promotions_creative,
                    creative_text,
                    campaign_status,
                    societies_text,
                    upload_societies_images_path: imagePath,
                    upload_societies_images_name: imageName,
                    created_ip_address: req.ip,
                    created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                    created_type: userType,
                });
        
                // Push the log to the CampaignLogs array
                CampaignLogs.push(log);
            }
        };
        
        let creativeImage = null;
        let creativeVideo = null;

        if (Array.isArray(req.files)) {
            for (const file of req.files) {
                const fieldName = file.fieldname;
                console.log(`Processing field: ${fieldName}`);
        
                // Check if it's the creative image path
                if (fieldName === "upload_creative_image_path") {
                    creativeImage = file;
                }
                
                // Check if it's the creative video path
                else if (fieldName === "upload_creative_video_path") {
                    creativeVideo = file;
                } 
                
                // Check if it's a society image path (uploads for multiple society images)
                else if (fieldName.startsWith("upload_societies_images_path")) {
                    const match = fieldName.match(/^upload_societies_images_path\[(\d+)\]$/);
                    if (match) {
                        const socId = match[1];  // Extract society ID from the fieldname
                        await processFileForSocieties(file, [socId]); // Process society image
                    }
                }
            }
        
            // If creative image exists, process it for all society IDs
            if (creativeImage && societyIds.length > 0) {
                await processFileForSocieties(creativeImage, societyIds);
            }
        
            // If creative video exists, process it for all society IDs
            if (creativeVideo && societyIds.length > 0) {
                await processFileForSocieties(creativeVideo, societyIds);
            }
        }

           let societiesText = [];

            if (req.body.societies_text) {
            if (typeof req.body.societies_text === 'string') {
                try {
                const parsed = JSON.parse(req.body.societies_text);
                societiesText = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                societiesText = [];
                }
            } else if (Array.isArray(req.body.societies_text)) {
                societiesText = req.body.societies_text;
            }
            }
        
            // const hasSocietiesText = societiesText.some(text => text && text.trim() !== "");

            const hasSocietiesText = Array.isArray(societiesText) && societiesText.some(text => text && text.trim() !== "");


            const rawCreativeText = req.body.brand_promotions_creative;
            const creativeText = typeof rawCreativeText === "string" ? rawCreativeText.trim() : "";

            const useCommonText = creativeText !== "" && creativeText.toLowerCase() !== "false";

            // Now determine the common text if any
            const commonText = useCommonText ? (societiesText[0] && societiesText[0].toLowerCase() !== "false" ? societiesText[0] : creativeText) : null;
                   console.log('commonText',commonText);
                    
                    // ✅ Handle societies_text separately (only if present)
        if (hasSocietiesText) {
            if (commonText) {
                // Common text for all societies
                for (let i = 0; i < societyIds.length; i++) {
                    const socId = societyIds[i];
                    const log = await Campaign_Log.create({
                        campaign_id: newCampaign.id,

                        company_id: comapnyId,
                        company_user_id: comapnyUserId,
                        society_id: socId,
                        campaign_type,
                        creative_type,
                        lead_generation_url,
                        survey_url,
                        campaign_name,
                        campaign_date,
                        campaign_area_id,
                        ...buildSocietyPricingPayload(socId),
                        my_ads_location_latitude,
                        my_ads_location_longitude,
                        radius_km,
                        search_by_google_location,
                        brand_promotions_creative,
                        creative_text,
                        campaign_status,
                        societies_text: commonText,  // common text here
                        upload_societies_images_path: null,
                        upload_societies_images_name: null,
                        created_ip_address: req.ip,
                        created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                        created_type: userType,
                    });

                    CampaignLogs.push(log);
                }
            } else {    
                // Individual text for societies
                for (let i = 0; i < societiesText.length; i++) {
                    const text = societiesText[i];
                    if (text && text.trim() !== "") {
                        // Map i as index for societyIds
                        const socId =i;

                        const log = await Campaign_Log.create({
                            campaign_id: newCampaign.id,
                            company_id: comapnyId,
                            company_user_id: comapnyUserId,
                            society_id: socId,
                            campaign_type,
                            creative_type,
                            lead_generation_url,
                            survey_url,
                            campaign_name,
                            campaign_date,
                            campaign_area_id,
                            ...buildSocietyPricingPayload(socId),
                            my_ads_location_latitude,
                            my_ads_location_longitude,
                            radius_km,
                            search_by_google_location,
                            brand_promotions_creative,
                            creative_text,
                            campaign_status,
                            societies_text: text, // specific text here
                            upload_societies_images_path: null,
                            upload_societies_images_name: null,
                            created_ip_address: req.ip,
                            created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
                            created_type: userType,
                        });

                        CampaignLogs.push(log);
                    }
                }
            }
        }

        //  const formattedId = newCampaign.id < 10 ? `0${newCampaign.id}` : `${newCampaign.id}`;
        //  const  generatedPrefixCampaign = `ADZ10XCP${formattedId}`;

        await newCampaign.update({ id_prifix_campaign: generatedPrefixCampaign });

         for (const log of CampaignLogs) {
                const formattedLogId = log.id < 10 ? `0${log.id}` : `${log.id}`;
                const generatedPrefixCampaignLog = `ADZ10XADS${formattedLogId}`;

                await log.update({ id_prifix_campaign_ads: generatedPrefixCampaignLog });
            }

       if (newCampaign.campaign_status === 'pending') {
            await Notification.create({
                company_ids: [comapnyId], // Uncomment if needed
                message: `Campaign #${newCampaign.id_prifix_campaign} has been created by the company and is awaiting approval.`,
                from: 'company',
                to: 'admin',
                notify_type: 'individual',
                created_ip_address: req.ip
            });
        }

        return res.status(201).json({
            status: 201,
            message: userMessage,
            data: {
                newCampaign,
                logs: CampaignLogs
            }
        });
    } catch (error) {
        console.error('Error in createOrUpdateCampaign:', error);
        return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: error.message
        });
    }
};