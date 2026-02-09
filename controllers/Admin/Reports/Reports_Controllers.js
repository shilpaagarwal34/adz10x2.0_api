const Society_Registration = require('@models/Society/Auth/Society_Registration_Model')
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model')
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const Society_User = require('@models/Society/Users/Society_User_Model');
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const City = require('@models/Admin/Master/City_Model')
const Area = require('@models/Admin/Master/Area_Model')
const Sector = require('@models/Admin/Master/Sector_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const Advertisements = require('@models/Society/Advertisement/Advertisement_Model');
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model');
const moment = require('moment-timezone');
const { Op,fn, col, where,Sequelize } = require('sequelize');
const ExcelJS = require('exceljs');
const { raw } = require('express');

exports.totalSocietiesReportDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        // If Relationship Manager, filter societies by their ID
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            whereClause.relationship_manager_id = req.user.id;
        }


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

        whereClause.createdAt = {
            [Op.between]: [fromDateStart, toDateEnd]
        };
    }
        
        const total = await Society_Registration.count({ where: whereClause });

        const  society = await Society_Registration.findAll({
            where: whereClause,
            offset,
            limit,
            attributes: [
                'id', 'id_prifix_society', 'society_name', 'society_user_id','name','email','mobile_number','relationship_manager_id','society_commission','society_brand_promotion','society_lead_generation','society_survey',
                'city_id', 'area_id','pincode','address','account_status','createdAt', 'status','updatedAt','modified_type','modified_by','approved_by'
            ]
        });

          const formattedCampaigns = await Promise.all(society.map(async item => {
          const createdAtFormatted = moment(item.createdAt)
               .tz('Asia/Kolkata')
               .format('dddd DD-MMMM-YYYY hh:mm A');
          const updateAtFormated = moment(item.updatedAt).tz('Asia/Kolkata')
                                   .format('dddd DD-MMMM-YYYY hh:mm A')

          let cityName = '';
          let areaName = '';
          let relationship_manager = ''; 
          let modifiedByName = '';

          const city = await City.findOne({
               where: { id: item.city_id },
               attributes: ['city_name'],
               raw: true
          });
          const area = await Area.findOne({
               where: { id: item.area_id },
               attributes: ['area_name'],
               raw: true
          });

          const manager = await Master_Admin.findOne({
            //    where: { id:item.relationship_manager_id },
               where: { id: item.relationship_manager_id, status: { [Op.ne]: 'delete' } },
               attributes: ['id','user_name'],
               raw:true
          });

          const profile = await Society_Profile.findOne({
               where: { society_id: item.id },
               attributes: ['id','society_id','society_user_id','number_of_flat','society_email','account_holder_name','bank_name','account_no','branch_name','bank_ifsc_code',
                    'billing_address_line_1','billing_address_line_2','ads_per_day','google_page_url','number_of_members'
               ],
               raw: true
          });

          cityName = city ? city.city_name : '';
          areaName = area ? area.area_name : '';
          relationship_manager = manager ? manager.user_name : '';

            if (item.modified_type && item.modified_by) {
                if (item.modified_type === 'Admin') {
                    const admin = await Master_Admin.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = admin ? admin.user_name : '';
                } else if (item.modified_type === 'Society_Admin') {
                    const society = await Society_Registration.findOne({
                        where: { id: item.modified_by },
                        attributes: ['name'],
                        raw: true
                    });
                    modifiedByName = society ? society.name : '';
                } else if (item.modified_type === 'Society_User') {
                    const user = await Society_User.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = user ? user.user_name : '';
                }
            }

          return {
               ...item.toJSON(),
               createdAtFormatted,
               updateAtFormated,
               city_name: cityName,
               area_name: areaName,
               relationship_manager: relationship_manager,
               modified_by_name: modifiedByName,
               profile_data: profile || {}   
          };
          }));

        return res.status(200).json({
            status: 200,
            table_name: 'society_registration',
            message: 'Society fetched successfully',
            total,
            page,
            limit,
            data: formattedCampaigns
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch society",
            error: err.message
        });
    }
};

exports.totalCompanyReportDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        // If Relationship Manager, filter societies by their ID
    if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
        whereClause.relationship_manager_id = req.user.id;
    }

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
        
        const total = await Company_Registration.count({ where: whereClause });

        const companies = await Company_Registration.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes:['id','id_prifix_company','company_user_id','company_name','company_brand_name','name','email','mobile_number','city_id','area_id',
               'address_line_1','sector', 'relationship_manager_id','brand_promotion','lead_generation','survey','modified_type','modified_by',
               'createdAt','updatedAt','status','kyc_status'
            ]
        });

        const formattedCompanies = await Promise.all(companies.map(async item => {
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const updatedAtFormatted = moment(item.updatedAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            let cityName = '';
            let areaName = '';
            let sectorName = '';
            let relationship_manager = '';
            let modifiedByName = '';

            const city = await City.findOne({
                where: { id: item.city_id },
                attributes: ['city_name'],
                raw: true
            });

            const area = await Area.findOne({
                where: { id: item.area_id },
                attributes: ['area_name'],
                raw: true
            });

            const sector = await Sector.findOne({
                where: { id: item.sector },
                attributes: ['sector_name'],
                raw:true
            });

            const relationshipManagerId = parseInt(item.relationship_manager_id);
            const manager = Number.isInteger(relationshipManagerId)
                ? await Master_Admin.findOne({
                    // where: { id: relationshipManagerId },
                    where: { id: relationshipManagerId, status: { [Op.ne]: 'delete' } },
                    attributes: ['id', 'user_name'],
                    raw: true
                })
                : null;

            const profile = await Company_Profile.findOne({
                where: { company_id: item.id },
                attributes:['id','company_id','company_user_id','company_email_id','party_name','gst_number','website'],
                raw: true
            });

            cityName = city ? city.city_name : '';
            areaName = area ? area.area_name : '';
            sectorName = sector ? sector.sector_name : '';
            relationship_manager = manager ? manager.user_name : '';


            // ✅ Modified By Name Logic
            if (item.modified_type && item.modified_by) {
                if (item.modified_type === 'Admin') {
                    const admin = await Master_Admin.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = admin ? admin.user_name : '';
                } else if (item.modified_type === 'Company_Admin') {
                    const company = await Company_Registration.findOne({
                        where: { id: item.modified_by },
                        attributes: ['name'],
                        raw: true
                    });
                    modifiedByName = company ? company.name : '';
                } else if (item.modified_type === 'Company_User') {
                    const user = await Company_User.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = user ? user.user_name : '';
                }
            }

            return {
                ...item.toJSON(),
                createdAtFormatted,
                updatedAtFormatted,
                city_name: cityName,
                area_name: areaName,
                sector_name : sectorName,
                relationship_manager: relationship_manager,
                modified_by_name: modifiedByName,
                profile_data: profile || {}
            };
        }));

        return res.status(200).json({
            status: 200,
            table_name: 'company_registration',
            message: 'Company fetched successfully',
            total,
            page,
            limit,
            data: formattedCompanies
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: 500,
            message: "Failed to fetch company",
            error: err.message
        });
    }
};

exports.totalAdsApprovalReportsDataTable = async (req, res) => {
    try {
         const { isSuperAdmin, role_name, id: userId } = req.user;
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


        // ✅ If Relationship Manager, filter by associated societies
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            // Step 1: Find all society IDs managed by the current RM
            const managedSocieties = await Society_Registration.findAll({
                where: {
                    relationship_manager_id: userId
                },
                attributes: ['id'],
                raw: true // Return plain objects for performance
            });

            const managedSocietyIds = managedSocieties.map(society => society.id);

            // // If the RM doesn't manage any societies, return an empty result set immediately
            // if (managedSocietyIds.length === 0) {
            //     return res.status(200).json({
            //         status: 200,
            //         table_name: 'company_campaigns_logs',
            //         message: 'Campaign log fetched successfully',
            //         total: 0,
            //         page,
            //         limit,
            //         data: []
            //     });
            // }

            // Step 2: Add the list of society IDs to the main query's where clause
            whereClause.society_id = {
                [Op.in]: managedSocietyIds
            };
        }


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

    whereClause.live_start_date = {
        [Op.between]: [fromDateStart, toDateEnd]
    };
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
                'campaign_type',
                'creative_type',
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

                 // ✅ Campaign ID Prefix
                [Sequelize.literal(`(
                    SELECT id_prifix_campaign
                    FROM company_campaigns
                    WHERE company_campaigns.id = "Campaign_Log".campaign_id
                )`), 'id_prifix_campaign'],

                // ✅ Campaign Date
                [Sequelize.literal(`(
                   SELECT REGEXP_REPLACE(
                        TRIM(TO_CHAR(campaign_date, 'FMDay DD-FMMonth YYYY')),
                        '\\s+',
                        ' ',
                        'g'
                    )
                    FROM company_campaigns
                    WHERE company_campaigns.id = "Campaign_Log".campaign_id
                )`), 'campaign_date'],

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
        attributes: ['no_view','no_reactions','report_submited_24_before_date', 'report_submited_24_after_date',]
    });

    let society = '';

    // ✅ Fetch advertisement details based on campaign_log_id
     society = await Society_Registration.findOne({
        where: { id: item.society_id },
        attributes: ['society_name','id_prifix_society']
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
        society_name: society?.society_name || '',
        id_prifix_society: society?.id_prifix_society || '',
        no_view: ads?.no_view || '',
        no_reactions: ads?.no_reactions || '',
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

exports.totalPayoutSummaryReportDataTable = async (req, res) => {
    try {
        const { isSuperAdmin, role_name, id: userId } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        // If Relationship Manager, filter by associated societies
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            const managedSocieties = await Society_Registration.findAll({
                where: {
                    relationship_manager_id: userId
                },
                attributes: ['id'],
                raw: true
            });

            const managedSocietyIds = managedSocieties.map(society => society.id);

            // // If the RM doesn't manage any societies, return an empty result
            // if (managedSocietyIds.length === 0) {
            //     return res.status(200).json({
            //         status: 200,
            //         table_name: 'society_withdraw_payments',
            //         message: 'Society withdraw payment fetched successfully',
            //         total: 0,
            //         page,
            //         limit,
            //         data: []
            //     });
            // }

            whereClause.society_id = {
                [Op.in]: managedSocietyIds
            };
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

            // ✅ Inside formattedCampaigns mapping
            const createdAtIST = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

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

            let society = '';

            // ✅ Fetch advertisement details based on campaign_log_id
            society = await Society_Registration.findOne({
                where: { id: item.society_id },
                attributes: ['society_name','id_prifix_society','name','mobile_number']
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
                society_name: society?.society_name || '',
                name: society?.name || '',
                id_prifix_society: society?.id_prifix_society || '',
                mobile_number: society?.mobile_number || '',
                createdAtFormatted: createdAtIST,
                // createdAtFormatted: `${dayName} ${day}-${month} ${year} ${timeFormatted}`,
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

exports.totalWalletPaymentHistoryReportDataTable = async (req, res) => {
    try {
        const { isSuperAdmin, role_name, id: userId } = req.user;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        // Add company-based Relationship Manager filtering logic
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            // Step 1: Find all company IDs managed by the current RM
            const managedCompanies = await Company_Registration.findAll({
                where: {
                    relationship_manager_id: userId // Assuming Company_Registration has a relationship_manager_id
                },
                attributes: ['id'],
                raw: true
            });

            const managedCompanyIds = managedCompanies.map(company => company.id);

            // Step 2: Add the company IDs to the main query's where clause
            whereClause.company_id = {
                [Op.in]: managedCompanyIds
            };
        }

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

        const total = await Wallet.count({ where: whereClause });

        const campaigns = await Wallet.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id','company_id','gst_amount','wallet_type', 'amount','total_amount','invoice_id', 'razorpay_order_id',
                'order_id', 'razorpay_payment_id','createdAt', 'status'
            ]
        });

        const formattedCampaigns = await Promise.all(campaigns.map(async item => {
            // ✅ Format createdAt with Date & Time in Asia/Kolkata
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const company = await Company_Registration.findOne({
                            where: { id: item.company_id},
                            attributes:['company_name','id_prifix_company'],
                            raw:true
                        });    

            return {
                ...item.toJSON(),
                company_name: company?.company_name || '-',
                id_prifix_company: company?.id_prifix_company || '-',
                createdAtFormatted,
            };
        }));
        return res.status(200).json({
            status: 200,
            table_name: 'company_wallet_payment_log',
            message: 'Wallet payment fetched successfully',
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

exports.adminUserReportDataTable = async (req, res) => {
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

        const total = await Master_Admin.count({ where: whereClause });

        const users = await Master_Admin.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
        });

        // ✅ Format Result
          const formattedUsers = users.map(item => {
            const createdAtFormatted = moment.utc(item.createdAt) // ⬅ UTC first
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const loginDateTime = item.login_date_time
                ? moment(item.login_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : null;

           const logoutDateTime = item.logout_date_time
                ? moment.utc(item.logout_date_time) // Interpret as UTC
                    .tz('Asia/Kolkata')              // Convert to IST
                    .format('dddd DD-MMMM-YYYY hh:mm A')
                : null;

            const activityDetails = (loginDateTime || logoutDateTime)
                ? `Login: ${loginDateTime || '-'} | Logout: ${logoutDateTime || '-'}`
                : '-';

                    // Capitalize and replace underscores
            const formattedRoleName = item.role_name
                ? item.role_name
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, char => char.toUpperCase())
                : '-';

            return {
                date_time: createdAtFormatted || '-',
                user_id: item.id_prifix_admin || '-',
                user_name: item.user_name || '-',
                role_name: formattedRoleName,
                activity_details: activityDetails
            };
        });

        return res.status(200).json({
            status: 200,
            table_name: 'master_admin',
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

exports.totalPlatformEarningReportDataTable = async (req, res) => {
  try {
    const campaignWhereClause = {
      status: 'active',
      campaign_status: 'completed'
    };

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
    campaignWhereClause.campaign_date = {
        [Op.between]: [fromDateStart, toDateEnd]
    };
    }

    // ✅ Step 1: Get matching Campaigns
    const campaigns = await Campaign.findAll({
      where: campaignWhereClause,
      attributes: ['id']
    });

    const campaignIds = campaigns.map(c => c.id);

    // If no campaigns, return early
    if (campaignIds.length === 0) {
      return res.status(200).json({
        status: 200,
        message: 'No campaigns found for the given filters',
        data: {
          totalCampaignCompleted: '-',
          totalCampaignPayments: '-',
          totalSociety: '-',
          totalSocietyPayments: '-',
          Platform_Earning: '-'
        }
      });
    }

    // ✅ Step 2: Calculate totals based on campaign_ids

    // Total campaign count
    const totalCampaignCompleted = campaignIds.length;

    // Sum of campaign_amount from Campaign table
    const totalCampaignPayments = await Campaign.sum('campaign_amount', {
      where: { id: { [Op.in]: campaignIds } }
    });

    // Sum & Count from Society_Wallet_Payment
    const totalAmount = await Society_Wallet_Payment.sum('amount', {
      where: {
        campaign_id: { [Op.in]: campaignIds },
        status: 'active'
      }
    });

    const totalSocietyCount = await Society_Wallet_Payment.count({
      where: {
        campaign_id: { [Op.in]: campaignIds },
        status: 'active'
      }
    });

    const Platform_Earning  = totalCampaignPayments - totalAmount

    return res.status(200).json({
      status: 200,
      message: 'Total platform earnings report fetched successfully',
      data: {
        totalCampaignCompleted,
        totalCampaignPayments: totalCampaignPayments || 0,
        totalSociety:totalSocietyCount,      // total rows, including repeated society_id
        totalSocietyPayments:totalAmount,
        Platform_Earning
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch platform earnings report",
      error: error.message
    });
  }
};

exports.exportSocietyReportExcel = async (req, res) => {
    try {
        // const from_date = req.query.from_date;
        // const to_date = req.query.to_date;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

         // If Relationship Manager, filter societies by their ID
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            whereClause.relationship_manager_id = req.user.id;
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

        const societies = await Society_Registration.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            attributes: [
                'id', 'id_prifix_society', 'society_name', 'society_user_id', 'name', 'email',
                'mobile_number', 'relationship_manager_id', 'city_id', 'area_id', 'pincode',
                'address', 'account_status', 'createdAt', 'updatedAt', 'status',
                'modified_type', 'modified_by', 'approved_by','society_brand_promotion','society_lead_generation','society_survey'
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Society Report');

        worksheet.addRow([
            'Reg Date & Time', 'Society ID', 'Society Name', 'City', 'Area', 'Address',
            'Society Email ID', 'No of Members', 'No of Flats', 'WhatsApp No',
            'Contact Person Name', 'Mobile No.', 'Email ID',
            'Bank Name', 'Account Holder Name', 'Account No', 'Branch Name',
            'IFSC Code', 'Billing Address', 'Status',
            'Relationship Manager', 'Updated By', 'Updated Date & Time', 'Brand Promotions', 'Lead Generation', 'Survey'
        ]);

        for (const item of societies) {
            const createdAtFormatted = moment(item.createdAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
            const updatedAtFormatted = moment(item.updatedAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');

            const city = await City.findOne({ where: { id: item.city_id }, attributes: ['city_name'], raw: true });
            const area = await Area.findOne({ where: { id: item.area_id }, attributes: ['area_name'], raw: true });
            const manager = await Master_Admin.findOne({ where: { id: item.relationship_manager_id }, attributes: ['user_name'], raw: true });

            const profile = await Society_Profile.findOne({
                where: { society_id: item.id },
                attributes: [
                    'number_of_flat', 'society_email', 'account_holder_name', 'bank_name', 'account_no',
                    'branch_name', 'bank_ifsc_code', 'billing_address_line_1', 'billing_address_line_2',
                    'ads_per_day', 'google_page_url','number_of_members'
                ],
                raw: true
            });

            let modifiedByName = '';
            if (item.modified_type && item.modified_by) {
                if (item.modified_type === 'Admin') {
                    const admin = await Master_Admin.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = admin ? admin.user_name : '';
                } else if (item.modified_type === 'Society_Admin') {
                    const societyAdmin = await Society_Registration.findOne({
                        where: { id: item.modified_by },
                        attributes: ['name'],
                        raw: true
                    });
                    modifiedByName = societyAdmin ? societyAdmin.name : '';
                } else if (item.modified_type === 'Society_User') {
                    const societyUser = await Society_User.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = societyUser ? societyUser.user_name : '';
                }
            }

            const safeValue = (val) => (val === null || val === undefined || val === '' ? '-' : val);

            worksheet.addRow([
                safeValue(createdAtFormatted),
                safeValue(item.id_prifix_society),
                safeValue(item.society_name),
                safeValue(city?.city_name),
                safeValue(area?.area_name),
                safeValue(item.address),
                safeValue(profile?.society_email),
                safeValue(profile?.number_of_members),
                safeValue(profile?.number_of_flat),
                safeValue(item.mobile_number),
                safeValue(item.name),
                safeValue(item.email),
                safeValue(item.mobile_number),
                safeValue(profile?.bank_name),
                safeValue(profile?.account_holder_name),
                safeValue(profile?.account_no),
                safeValue(profile?.branch_name),
                safeValue(profile?.bank_ifsc_code),
                safeValue(`${profile?.billing_address_line_1 || ''} ${profile?.billing_address_line_2 || ''}`),
                safeValue(item.status),
                safeValue(manager?.user_name),
                safeValue(modifiedByName),
                safeValue(updatedAtFormatted),
                safeValue(item.society_brand_promotion),
                safeValue(item.society_lead_generation),
                safeValue(item.society_survey),
            ]);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Society_Report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: 500,
            message: "Failed to export society report",
            error: err.message
        });
    }
};

exports.exportCompanyReportExcel = async (req, res) => {
    try {
        // const from_date = req.query.from_date;
        // const to_date = req.query.to_date;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

         // If Relationship Manager, filter societies by their ID
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            whereClause.relationship_manager_id = req.user.id;
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

        const companies = await Company_Registration.findAll({
            where: whereClause,
            order: [['id', 'DESC']],
            attributes: [
                'id','id_prifix_company','company_name','company_brand_name','email','name','mobile_number',
                'city_id','area_id','address_line_1','sector','relationship_manager_id',
                'brand_promotion','lead_generation','survey','modified_type','modified_by',
                'createdAt','updatedAt','status'
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Company Report');

        worksheet.addRow([
            'Reg Date & Time', 'Company ID', 'Company Name', 'Sector', 'Brand Name',
            'Company Email ID', 'Company Mobile No.', 'Website', 'City', 'Area', 'Address',
            'Contact Person Name', 'Email ID', 'Brand Promotions', 'Lead Generation', 'Survey',
            'Status', 'Relationship Manager', 'Updated By', 'Updated Date & Time','GST No'
        ]);

        for (const item of companies) {
            const createdAtFormatted = moment(item.createdAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');
            const updatedAtFormatted = moment(item.updatedAt).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A');

            const city = await City.findOne({ where: { id: item.city_id }, attributes: ['city_name'], raw: true });
            const area = await Area.findOne({ where: { id: item.area_id }, attributes: ['area_name'], raw: true });
            const sector = await Sector.findOne({ where: { id: item.sector }, attributes: ['sector_name'], raw: true });
            const manager = await Master_Admin.findOne({
                where: { id: item.relationship_manager_id },
                attributes: ['user_name'],
                raw: true
            });

            const profile = await Company_Profile.findOne({
                where: { company_id: item.id },
                attributes: ['company_email_id', 'party_name', 'gst_number', 'website'],
                raw: true
            });

            let modifiedByName = '';
            if (item.modified_type && item.modified_by) {
                if (item.modified_type === 'Admin') {
                    const admin = await Master_Admin.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = admin ? admin.user_name : '';
                } else if (item.modified_type === 'Company_Admin') {
                    const company = await Company_Registration.findOne({
                        where: { id: item.modified_by },
                        attributes: ['name'],
                        raw: true
                    });
                    modifiedByName = company ? company.name : '';
                } else if (item.modified_type === 'Company_User') {
                    const user = await Company_User.findOne({
                        where: { id: item.modified_by },
                        attributes: ['user_name'],
                        raw: true
                    });
                    modifiedByName = user ? user.user_name : '';
                }
            }

            const safeValue = (val) => (val === null || val === undefined || val === '' ? '-' : val);

            worksheet.addRow([
                safeValue(createdAtFormatted),
                safeValue(item.id_prifix_company),
                safeValue(item.company_name),
                safeValue(sector?.sector_name),
                safeValue(item.company_brand_name),
                safeValue(profile?.company_email_id),
                safeValue(item.mobile_number),
                safeValue(profile?.website),
                safeValue(city?.city_name),
                safeValue(area?.area_name),
                safeValue(item.address_line_1),
                safeValue(item.name),
                safeValue(item.email),
                safeValue(item.brand_promotion),
                safeValue(item.lead_generation),
                safeValue(item.survey),
                safeValue(item.status),
                safeValue(manager?.user_name),
                safeValue(modifiedByName),
                safeValue(updatedAtFormatted),
                safeValue(profile?.gst_number),
            ]);
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Company_Report.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: 500,
            message: "Failed to export company report",
            error: err.message
        });
    }
};

exports.exportTotalAdsApprovalReport = async (req, res) => {
    try {

         const { isSuperAdmin, role_name, id: userId } = req.user;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            campaign_status: {
                [Op.in]: ['completed', 'reject']
            }
        };

        // ✅ If Relationship Manager, filter by associated societies
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            // Step 1: Find all society IDs managed by the current RM
            const managedSocieties = await Society_Registration.findAll({
                where: {
                    relationship_manager_id: userId
                },
                attributes: ['id'],
                raw: true // Return plain objects for performance
            });

            const managedSocietyIds = managedSocieties.map(society => society.id);

            // // If the RM doesn't manage any societies, return an empty result set immediately
            // if (managedSocietyIds.length === 0) {
            //     return res.status(200).json({
            //         status: 200,
            //         table_name: 'company_campaigns_logs',
            //         message: 'Campaign log fetched successfully',
            //         total: 0,
            //         page,
            //         limit,
            //         data: []
            //     });
            // }

            // Step 2: Add the list of society IDs to the main query's where clause
            whereClause.society_id = {
                [Op.in]: managedSocietyIds
            };
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
                'company_id',
                'society_id',
                'campaign_status',
                'campaign_type',
                'creative_type',
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

        // Header Row
        worksheet.addRow([
            // 'Sr. No.',
            'Date & Time',
            'Campaign ID',
            'Company Name & ID',
            'Ads ID',
            'Campaign Name',
            'Campaign Type',
            'Creative Type',
            'Campaign Date',
            'Society Name & ID',
            'Pending Date',
            'Approved Date',
            'Live Date',
            'Report Submitted (Before 24Hrs)',
            'Completed',
            'Cancelled',
            'Report Submitted (After 24Hrs)',
            'No View',
            'No Reactions'
        ]);

        let srNo = 1;

        for (const item of campaign_log) {
            // Fetch related data
            const ads = await Advertisements.findOne({
                where: { campaign_log_id: item.id },
                attributes: ['no_view','no_reactions','report_submited_24_before_date', 'report_submited_24_after_date']
            });

            const campaign = await Campaign.findOne({
                where: { id: item.campaign_id },
                attributes: ['campaign_name', 'campaign_date', 'id_prifix_campaign']
            });

            const company = await Company_Registration.findOne({
                where: { id: item.company_id },
                attributes: ['company_name']
            });

            const society = await Society_Registration.findOne({
                where: { id: item.society_id },
                attributes: ['society_name', 'id_prifix_society']
            });

            // Formatters
            const formatDate = (date) =>
                date ? moment(date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A') : '';

            const formatCampaignDate = (date) =>
                date ? moment(date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY') : '';

            const formatLabel = (str) => {
                if (!str) return '';
                return str
                    .replace(/_/g, ' ')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            };

            const safeValue = (value) => (value === null || value === undefined || value === '' ? '-' : value);

            worksheet.addRow([
                // srNo++,
            safeValue(formatDate(item.createdAt)),
            safeValue(campaign?.id_prifix_campaign),
            safeValue(`${company?.company_name || ''} - ${item.id_prifix_company || ''}`),
            safeValue(item.id_prifix_campaign_ads),
            safeValue(campaign?.campaign_name),
            safeValue(formatLabel(item.campaign_type)),
            safeValue(formatLabel(item.creative_type)),
            safeValue(formatCampaignDate(campaign?.campaign_date)),
            safeValue(`${society?.society_name || ''} - ${society?.id_prifix_society || ''}`),
            safeValue(formatDate(item.approved_date_admin)),
            safeValue(formatDate(item.society_approved_date)),
            safeValue(formatDate(item.live_start_date)),
            safeValue(formatDate(ads?.report_submited_24_before_date)),
            safeValue(formatDate(item.completed_date)),
            safeValue(formatDate(item.cancel_date)),
            safeValue(formatDate(ads?.report_submited_24_after_date)),
            safeValue(ads?.no_view),
            safeValue(ads?.no_reactions)
            ]);
        }

        // Excel Download Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=ads-approval-report.xlsx');

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

exports.exporTotalPayoutSummaryReport = async (req, res) => {
    try {

        const { isSuperAdmin, role_name, id: userId } = req.user;

        const whereClause = {
            status: { [Op.in]: ['active', 'inactive'] }
        };

          // If Relationship Manager, filter by associated societies
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            const managedSocieties = await Society_Registration.findAll({
                where: {
                    relationship_manager_id: userId
                },
                attributes: ['id'],
                raw: true
            });

            const managedSocietyIds = managedSocieties.map(society => society.id);

            // // If the RM doesn't manage any societies, return an empty result
            // if (managedSocietyIds.length === 0) {
            //     return res.status(200).json({
            //         status: 200,
            //         table_name: 'society_withdraw_payments',
            //         message: 'Society withdraw payment fetched successfully',
            //         total: 0,
            //         page,
            //         limit,
            //         data: []
            //     });
            // }

            whereClause.society_id = {
                [Op.in]: managedSocietyIds
            };
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
                'society_id', 'invoice_id', 'withdraw_amount', 'description', 'payment_status',
                'paid_date', 'transaction_id', 'remark', 'createdAt',
                'modified_type', 'modified_by'
            ]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Payout Summary');

        // Header row
        worksheet.addRow([
            // 'Sr. No.',
            'Date & Time', 'Invoice No', 'Society ID', 'Society Name', 'Name', 'Mobile No', 'Amount',
            'Descriptions', 'Paid Status', 'Paid Date & Time', 'Transaction ID', 'Remark'
        ]);

        // let srNo = 1;

        for (const item of records) {
            // ✅ Format Dates
            const createdAtFormatted = moment(item.createdAt)
                .tz('Asia/Kolkata')
                .format('dddd DD-MMMM-YYYY hh:mm A');

            const paidDateFormatted = item.paid_date
                ? moment(item.paid_date).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
                : '-';

            // ✅ Get Society Details
            const society = await Society_Registration.findOne({
                where: { id: item.society_id },
                attributes: ['id_prifix_society', 'society_name','name', 'mobile_number']
            });

            const safeValue = (value) => (value === null || value === undefined || value === '' ? '-' : value);

            worksheet.addRow([
                // srNo++,
            createdAtFormatted || '-',
            safeValue(item.invoice_id),
            safeValue(society?.id_prifix_society),
            safeValue(society?.society_name),
            safeValue(society?.name),
            safeValue(society?.mobile_number),
            safeValue(item.withdraw_amount),
            safeValue(item.description),
            safeValue(item.payment_status),
            paidDateFormatted,
            safeValue(item.transaction_id),
            safeValue(item.remark)
            ]);
        }

        // Set proper header for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=payout_summary.xlsx');

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

exports.exportWalletPaymentHistoryReport = async (req, res) => {
  try {

    const { isSuperAdmin, role_name, id: userId } = req.user;

    const safeValue = (value) =>
      value === null || value === undefined || value === '' ? '-' : value;

    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    // Add company-based Relationship Manager filtering logic
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            // Step 1: Find all company IDs managed by the current RM
            const managedCompanies = await Company_Registration.findAll({
                where: {
                    relationship_manager_id: userId // Assuming Company_Registration has a relationship_manager_id
                },
                attributes: ['id'],
                raw: true
            });

            const managedCompanyIds = managedCompanies.map(company => company.id);

            // Step 2: Add the company IDs to the main query's where clause
            whereClause.company_id = {
                [Op.in]: managedCompanyIds
            };
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
        'company_id',
        'gst_amount',
        'total_amount',
        'wallet_type',
        'amount',
        'invoice_id',
        'razorpay_order_id',
        'order_id',
        'razorpay_payment_id',
        'createdAt',
        'status'
      ]
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Wallet Payment Report');

    // ✅ Header Row
    worksheet.addRow([
      'Payment Date & Time',
      'Company ID',
      'Company Name',
      'Payment ID',
      'Type',
      'Amount',
      'GST Amount',
      'Total Amount',
      'Receipt No'
    ]);

    for (const item of campaigns) {
      const createdAtFormatted = moment(item.createdAt)
        .tz('Asia/Kolkata')
        .format('dddd DD-MMMM-YYYY hh:mm A');

      const company =
        (await Company_Registration.findOne({
          where: { id: item.company_id },
          attributes: ['company_name', 'id_prifix_company'],
          raw: true
        })) || {};

      worksheet.addRow([
        safeValue(createdAtFormatted),
        safeValue(company.id_prifix_company),
        safeValue(company.company_name),
        safeValue(item.razorpay_payment_id),
        safeValue(item.wallet_type),
        safeValue(item.amount),
        safeValue(item.gst_amount),
        safeValue(item.total_amount),
        safeValue(item.invoice_id)
      ]);
    }

    // ✅ Export
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Company_Payment_Report.xlsx'
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

exports.exportAdminUserReportExcel = async (req, res) => {
  try {

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

    const users = await Master_Admin.findAll({
      where: whereClause,
      order: [['id', 'DESC']],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Admin User Report');

    worksheet.addRow([
      'User ID',
      'Name',
      'Role',
      'Activity',
      'Date & Time',
    ]);

    for (const item of users) {
      const createdAtFormatted = moment(item.createdAt)
        .tz('Asia/Kolkata')
        .format('dddd DD-MMMM-YYYY hh:mm A');

      const loginDateTime = item.login_date_time
        ? moment(item.login_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : null;

      const logoutDateTime = item.logout_date_time
        ? moment(item.logout_date_time).tz('Asia/Kolkata').format('dddd DD-MMMM-YYYY hh:mm A')
        : null;

      const activityDetails = (loginDateTime || logoutDateTime)
        ? `Login: ${loginDateTime || '-'} | Logout: ${logoutDateTime || '-'}`
        : '-';

      worksheet.addRow([
        item.id_prifix_company_user || '-',
        item.user_name || '-',
        item.role_name || '-',
        activityDetails,
        createdAtFormatted || '-',
      ]);
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Admin_User_Report.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Admin User Report',
      error: err.message
    });
  }
};

exports.exportPlatformEarningReportExcel = async (req, res) => {
  try {
    const campaignWhereClause = {
      status: 'active',
      campaign_status: 'completed'
    };

    // Date filter
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

      campaignWhereClause.campaign_date = {
        [Op.between]: [fromDateStart, toDateEnd]
      };
    }

    // Get campaigns
    const campaigns = await Campaign.findAll({
      where: campaignWhereClause,
      attributes: ['id']
    });
    const campaignIds = campaigns.map(c => c.id);

    // Default values
    let totalCampaignCompleted = 0;
    let totalCampaignPayments = 0;
    let totalSociety = 0;
    let totalSocietyPayments = 0;
    let Platform_Earning = 0;

    if (campaignIds.length > 0) {
      totalCampaignCompleted = campaignIds.length;

      totalCampaignPayments = await Campaign.sum('campaign_amount', {
        where: { id: { [Op.in]: campaignIds } }
      }) || 0;

      totalSocietyPayments = await Society_Wallet_Payment.sum('amount', {
        where: {
          campaign_id: { [Op.in]: campaignIds },
          status: 'active'
        }
      }) || 0;

      totalSociety = await Society_Wallet_Payment.count({
        where: {
          campaign_id: { [Op.in]: campaignIds },
          status: 'active'
        }
      }) || 0;

      Platform_Earning = totalCampaignPayments - totalSocietyPayments;
    }

    // Prepare Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Platform Earning Report');

    worksheet.addRow([
      'Total Campaign Done (Count)',
      'Total Campaign Revenue Amount',
      'Total Society Targeted (in count)',
      'Society Total Paid Amount',
      'Platform Earning'
    ]);

    worksheet.addRow([
      totalCampaignCompleted,
      totalCampaignPayments,
      totalSociety,
      totalSocietyPayments,
      Platform_Earning
    ]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Platform_Earning_Report.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export Platform Earning Report',
      error: err.message
    });
  }
};


// exports.exportPlatformEarningReportExcel = async (req, res) => {
//   try {
//     const from_date = req.query.from_date;
//     const to_date = req.query.to_date;

//     const campaignWhereClause = {
//       status: 'active',
//       campaign_status: 'completed'
//     };

//             // Initialize date filter only if show_all is not true
//     if (req.query.show_all !== 'true') {
//     let fromDateStart, toDateEnd;

//     if (req.query.from_date && req.query.to_date) {
//         // User provided a date range
//         fromDateStart = moment.tz(req.query.from_date, 'Asia/Kolkata').startOf('day').toDate();
//         toDateEnd = moment.tz(req.query.to_date, 'Asia/Kolkata').endOf('day').toDate();
//     } else {
//         // Default to current month
//         fromDateStart = moment.tz('Asia/Kolkata').startOf('month').toDate();
//         toDateEnd = moment.tz('Asia/Kolkata').endOf('month').toDate();
//     }

//     // Apply the date filter to campaignWhereClause
//     campaignWhereClause.campaign_date = {
//         [Op.between]: [fromDateStart, toDateEnd]
//     };
//     }

//     const campaigns = await Campaign.findAll({
//       where: campaignWhereClause,
//       attributes: ['id']
//     });

//     const campaignIds = campaigns.map(c => c.id);

//     let totalCampaignCompleted = '-';
//     let totalCampaignPayments = '-';
//     let totalSociety = '-';
//     let totalAmount = '-';
//     let Platform_Earning = '-';

//     if (campaignIds.length > 0) {
//       totalCampaignCompleted = campaignIds.length;

//       const campaignSum = await Campaign.sum('campaign_amount', {
//         where: { id: { [Op.in]: campaignIds } }
//       });
//       totalCampaignPayments = campaignSum != null ? campaignSum : '-';

//       const societySum = await Society_Wallet_Payment.sum('amount', {
//         where: {
//           campaign_id: { [Op.in]: campaignIds },
//           status: 'active'
//         }
//       });
//       totalAmount = societySum != null ? societySum : '-';

//       const societyCount = await Society_Wallet_Payment.count({
//         where: {
//           campaign_id: { [Op.in]: campaignIds },
//           status: 'active'
//         }
//       });
//       totalSociety = societyCount != null ? societyCount : '-';

//       if (totalCampaignPayments !== '-' && totalAmount !== '-') {
//         Platform_Earning = totalCampaignPayments - totalAmount;
//       }
//     }

//     const workbook = new ExcelJS.Workbook();
//     const worksheet = workbook.addWorksheet('Platform Earning Report');

//     worksheet.addRow([
//       'Total Campaign Done (Count)',
//       'Total Campaign Revenue Amount',
//       'Total Society Targeted (in count)',
//       'Society Total Paid Amount',
//       'Platform Earning'
//     ]);

//     worksheet.addRow([
//       totalCampaignCompleted,
//       totalCampaignPayments,
//       totalSociety,
//       totalAmount,
//       Platform_Earning
//     ]);

//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.setHeader('Content-Disposition', 'attachment; filename=Platform_Earning_Report.xlsx');

//     await workbook.xlsx.write(res);
//     res.end();

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       message: 'Failed to export Platform Earning Report',
//       error: err.message
//     });
//   }
// };
