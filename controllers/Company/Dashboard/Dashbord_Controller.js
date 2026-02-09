const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const { Op } = require('sequelize');
const { where, literal, Sequelize } = require('sequelize');
const moment = require('moment-timezone');

exports.getCompanyDashbord = async (req, res) => {
  try {
   
    const userType = req.user_type;
    let companyId = null;

    console.log("User Type:", userType);
    console.log("Resolved Company ID:", companyId);


    if (userType === "Company_Admin") {
      companyId = req.user.id;
    } else if (userType === "Company_User") {
      companyId = req.user.company_id;
    }


    const users = await Company_Registration.findOne({ where: { id: companyId } });

    const currentUser = userType === 'Company_User' ? req.user.user_name : users.name;


    // Relationship Manager
    const relationship_managers = await Master_Admin.findOne({
      where: {
        id: users.relationship_manager_id,
        status: { [Op.in]: ['active', 'inactive'] }
      }
    });

    const currentIST = moment().tz('Asia/Kolkata').toDate();

    const baseWhere = {
      company_id: companyId,
      status: { [Op.in]: ['active', 'inactive'] }
    };

    // Helper to enrich campaign logs with campaign_date and society info
    async function enrichCampaigns(campaignLogs) {
      if (!campaignLogs.length) return [];

      // Get all campaign IDs
      const campaignIds = campaignLogs.map(log => log.campaign_id);
      const campaigns = await Campaign.findAll({
        where: { id: { [Op.in]: campaignIds } },
        attributes: ['id', 'campaign_date'],
        raw: true
      });

      // Map campaign_id => campaign_date formatted
      const campaignMap = {};
      campaigns.forEach(c => {
        campaignMap[c.id] = moment(c.campaign_date).format('DD MMM YYYY');
      });

      // Get unique society IDs from campaign logs
      const societyIds = [...new Set(campaignLogs.map(log => log.society_id))];
      const societies = await Society_Registration.findAll({
        where: { id: { [Op.in]: societyIds } },
        attributes: ['id', 'society_name', 'address', 'society_profile_img_path'],
        raw: true
      });

      // Map society_id => society info
      const societyMap = {};
      societies.forEach(s => {
        societyMap[s.id] = {
          society_name: s.society_name,
          address: s.address,
          society_img_path: s.society_profile_img_path
        };
      });

      return campaignLogs.map(log => ({
        ...log,
        campaign_date: campaignMap[log.campaign_id] || null,
        society_info: societyMap[log.society_id] || {
          society_name: '',
          address: '',
          society_img_path: ''
        }
      }));
    }

    // --- LIVE CAMPAIGNS ---
    const liveCampaignLogs = await Campaign_Log.findAll({
      where: {
        ...baseWhere,
        live_start_date: { [Op.lte]: currentIST },
        live_end_date: { [Op.gte]: currentIST },
        campaign_status: 'approved'
      },
      raw: true
    });
    const enrichedLive = await enrichCampaigns(liveCampaignLogs);

    // --- COUNTS ---
    const approvedCount = await Campaign.count({ where: { ...baseWhere, campaign_status: 'approved' } });
    const pendingCount = await Campaign.count({ where: { ...baseWhere, campaign_status: 'pending' } });
    const draftCount = await Campaign.count({ where: { ...baseWhere, campaign_status: 'draft' } });
    const liveCount = enrichedLive.length;

    // --- PENDING CAMPAIGNS ---
    const pendingLogs = await Campaign_Log.findAll({
      where: {
        ...baseWhere,
        campaign_status: 'pending',
        admin_approved_status: "approved"
      },
      raw: true
    });
    const enrichedPending = await enrichCampaigns(pendingLogs);

    // --- APPROVED CAMPAIGNS ---
    const approvedLogs = await Campaign_Log.findAll({
      where: {
        ...baseWhere,
        campaign_status: 'approved'
      },
      raw: true
    });
    const enrichedApproved = await enrichCampaigns(approvedLogs);

    // --- FINAL RESPONSE ---
    res.json({
      data: {
        status: 200,
        message: "success",
        company: {
          company_name: users.company_name,
          // name: users.name,
          name: currentUser,
          address_line_1: users.address_line_1,
          address_line_2: users.address_line_2,
          company_profile_photo_path: users.company_profile_photo_path
        },
        counter: {
          pending: pendingCount,
          live: liveCount,
          approved: approvedCount,
          draft: draftCount
        },
        live_campaigns: enrichedLive,
        pending_campaigns: enrichedPending,
        approved_campaigns: enrichedApproved,
        relationship_manager: {
          name: relationship_managers?.user_name || '',
          designation: relationship_managers?.role_name || '',
          mobile_no: relationship_managers?.mobile_no || '',
          whatsapp_no: ''
        }
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getCompanyDashbords = async (req, res) => {
     try {
           const whereClause = {
               status: {
                          [Op.in]: ['active', 'inactive']
               }
             };

              const whereClauseLive = {
               status: {
                          [Op.in]: ['active', 'inactive']
               }
             };

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

          let users = await Company_Registration.findOne({ where: { id: comapnyId } });
          
          const relationship_managers = await Master_Admin.findOne({ Where: { id:users.relationship_manager_id, status: {
                                                  [Op.in]: ['active', 'inactive']
                                        } } })
                            
          const currentIST = moment.tz('Asia/Kolkata').toDate();

          // ✅ Filter by company_id based on authenticated user
        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id; 
            whereClauseLive.company_id = req.user.id;
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id;
            whereClauseLive.company_id = req.user.company_id;
        }

              const liveCampaignLogs = await Campaign_Log.findAll({
                where: {
                  live_start_date: { [Op.lte]: currentIST },
                  live_end_date: { [Op.gte]: currentIST },
                  company_id:comapnyId,
                  campaign_status: 'approved',
                },
                raw: true
              });
        
              // Get campaign_ids from live campaigns
              const campaignIds = liveCampaignLogs.map(log => log.campaign_id);
            
              // Modify whereClause to include only those campaigns that are approved and within live window
              whereClauseLive.campaign_status = 'approved'; // Only 'approved' campaigns

              whereClauseLive.id = { [Op.in]: campaignIds }; // Filter by campaign_id from Campaign_Log

          // Use currentIST again for accurate count
              const liveCampaignLogsForCount = await Campaign_Log.findAll({
                  where: {
                      live_start_date: { [Op.lte]: currentIST },
                      live_end_date: { [Op.gte]: currentIST }
                  }
              });
         
              //  const liveCampaignIds = liveCampaignLogs.map(log => log.campaign_id);
               const liveCampaignIdsForCount = liveCampaignLogsForCount.map(log => log.campaign_id);
        
               // Count campaigns with matching campaign_ids
               const liveCount = await Campaign.count({
                   where: {
                       ...whereClause,
                       campaign_status: 'approved',
                        id: { [Op.in]: liveCampaignIdsForCount }
                   }
               });

          const approvedCount = await Campaign.count({
          where: { ...whereClause, campaign_status: 'approved' }
          });

          const pendingCount = await Campaign.count({
          where: { ...whereClause, campaign_status: 'pending' }
          });

          const draftCount = await Campaign.count({
          where: { ...whereClause, campaign_status: 'draft' }
          });

          const pending = await Campaign_Log.findAll({
                           where: {
                               ...whereClause,
                               campaign_status: 'pending',
                               admin_approved_status:"approved",
                               company_id: comapnyId,
                           },
                           include: [{
                                model: Campaign,
                                attributes: ['campaign_date']
                            }]
                       });

          const approved = await Campaign_Log.findAll({
                           where: {
                               ...whereClause,
                               campaign_status: 'approved',
                            //    admin_approved_status:"approved",
                               company_id: comapnyId,
                           }
                       });

          res.json({
               data:{
                    status: 200,
                    message: "success",
                    company: {
                         company_name: users.company_name,
                         name: users.name,
                         address_line_1:users.address_line_1,
                         address_line_2:users.address_line_2,
                         company_profile_photo_path: users.company_profile_photo_path
                    },
                    counter: {
                         pending: pendingCount,
                         live: liveCount,
                         approved: approvedCount,
                         draft : draftCount
                    },

                    live_campaigns :liveCampaignLogs,
                    pending_campaigns:pending,
                    approved_campaigns:approved,
                   
                    relationship_manager:{
                         name:relationship_managers.user_name,
                         designation: relationship_managers.role_name,
                         mobile_no :relationship_managers.mobile_no,
                         whatsapp_no :''
                    },
               }
          });
     } catch (err) {
          res.status(500).json({ error: err.message });
     }
 }