const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_User = require('@models/Society/Users/Society_User_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Company_Register = require('@models/Company/Auth/Company_Registration_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const { Op,fn, col,where } = require('sequelize');
const moment = require('moment-timezone');

exports.getSocietyDashbord = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user_type;
    let societyId = null;

    // Determine society_id based on user type
    if (userType === "Society_Admin") {
      const user = await Society_Registration.findOne({ where: { id: userId } });
      societyId = user.id;
    } else if (userType === "Society_User") {
      const societyUser = await Society_User.findOne({ where: { id: userId } });
      societyId = societyUser.society_id;
    }

    const users = await Society_Registration.findOne({ where: { id: societyId } });

     const totalCampaignApproved  = await  Campaign_Log.count({ where: { status: 'active', campaign_status: 'approved', society_id:societyId } });

     const totalCampaign_Earnings = await Society_Registration.findOne({
                where: { id: societyId },
                attributes: ['id', 'society_wallet_amount'] // Only select necessary fields
            });

            // ✅ NEW: Total Earnings (sum of credit transactions)
      const totalCampaignEarningsData = await Society_Wallet_Payment.findAll({
        where: {
          society_id: societyId,
          wallet_type: 'credit'
        },
        attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'totalEarnings']],
        raw: true
      });

      const totalEarnings = totalCampaignEarningsData.length > 0 
        ? totalCampaignEarningsData[0].totalEarnings 
        : 0;

        console.log('totalEarnings',totalEarnings);
        

    // Relationship Manager
    const relationship_managers = await Master_Admin.findOne({
      where: {
        id: users.relationship_manager_id,
        status: { [Op.in]: ['active', 'inactive'] }
      }
    });

    const currentIST = moment().tz('Asia/Kolkata').toDate();

    const baseWhere = {
      society_id: societyId,
      status: { [Op.in]: ['active', 'inactive'] }
    };

    // Updated enrichCampaigns function
    async function enrichCampaigns(campaignLogs) {
      const campaignIds = campaignLogs.map(log => log.campaign_id);

      const campaigns = await Campaign.findAll({
        where: { id: { [Op.in]: campaignIds } },
        attributes: ['id', 'campaign_date'],
        raw: true
      });

      const campaignMap = {};
      campaigns.forEach(c => {
        campaignMap[c.id] = moment(c.campaign_date).format('DD MMM YYYY');
      });

      const companyIds = [...new Set(campaignLogs.map(log => log.company_id).filter(id => !!id))];
      const companies = await Company_Register.findAll({
        where: { id: { [Op.in]: companyIds } },
        attributes: ['id', 'company_name', 'address_line_1', 'address_line_2', 'company_profile_photo_path'],
        raw: true
      });

      const companyMap = {};
      companies.forEach(c => {
        companyMap[c.id] = {
          company_name: c.company_name,
          address_line_1: c.address_line_1,
          address_line_2: c.address_line_2,
          company_profile_photo_path: c.company_profile_photo_path
        };
      });

      return campaignLogs.map(log => ({
        ...log,
        campaign_date: campaignMap[log.campaign_id] || null,
        company: companyMap[log.company_id] || {
          company_name: '',
          address_line_1: '',
          address_line_2: '',
          company_profile_photo_path: ''
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
    const live = await enrichCampaigns(liveCampaignLogs);

    // --- PENDING CAMPAIGNS ---
    const pendingLogs = await Campaign_Log.findAll({
      where: {
        ...baseWhere,
        campaign_status: 'pending',
        admin_approved_status: "approved"
      },
      raw: true
    });
    const pending = await enrichCampaigns(pendingLogs);

    // --- UPCOMING CAMPAIGNS ---
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingLogs = await Campaign_Log.findAll({
      where: {
        ...baseWhere,
        campaign_status: 'approved',
        live_start_date: { [Op.gte]: tomorrow }
      },
      order: [['live_start_date', 'DESC']],
      limit: 5,
      raw: true
    });
    const upcoming = await enrichCampaigns(upcomingLogs);

    const profile = await Society_Profile.findOne({ where: { society_id: users.id } });

    res.json({
      data: {
        status: 200,
        message: "success",
        society: {
          society_name: users.society_name,
          address: users.address,
          society_img_path: users.society_profile_img_path
        },
        counter: {
          pending: pending.length,
          live: live.length,
          approved: totalCampaignApproved,
          // total_earring: totalCampaign_Earnings.society_wallet_amount,
          total_earning: totalEarnings
        },
        live_campaigns: live,
        pending_campaigns: pending,
        upcoming_campaigns: upcoming,
        socity_location: {
          latitude: users.latitude,
          longitude: users.longitude,
        },
        relationship_manager: {
          name: relationship_managers?.user_name || '',
          designation: relationship_managers?.role_name || '',
          mobile_no: relationship_managers?.mobile_no || '',
          whatsapp_no: ''
        },
        society_img: [
          { img_1: profile?.society_profile_img_1_path || '' },
          { img_2: profile?.society_profile_img_2_path || '' },
          { img_3: profile?.society_profile_img_3_path || '' },
          { img_4: profile?.society_profile_img_4_path || '' },
          { img_5: profile?.society_profile_img_5_path || '' }
        ]
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};