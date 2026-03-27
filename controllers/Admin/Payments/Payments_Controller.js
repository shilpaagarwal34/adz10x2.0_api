const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const Campaign = require('@models/Company/Campaign/Campaign_Model');
const Campaign_Log = require('@models/Company/Campaign/Campaign_Log_Model');
const City = require('@models/Admin/Master/City_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { Op, fn, col, where, literal, NUMBER,Sequelize, cast } = require('sequelize');
const sequelize = require('@config/db');
const moment = require('moment');
const path = require('path');

exports.walletAdminAmount = async (req, res) => {
    try {
        const { isSuperAdmin, role_name, id: userId } = req.user;

        // Base WHERE clause to exclude deleted companies
        let whereClause = `status != 'delete'`;

        //  Apply restriction for Relationship Manager
        // If the user is a RELATIONSHIP MANAGER and not a Super Admin,
        // restrict the query to companies assigned to them.
        if (role_name === 'RELATIONSHIP MANAGER' && !isSuperAdmin) {
            whereClause += ` AND relationship_manager_id = ${userId}`;
        }

        // Use the constructed WHERE clause in the SQL query
        const result = await sequelize.query(`
            SELECT SUM(CAST(wallet_amount AS NUMERIC)) AS total_wallet_amount 
            FROM "company_registration" 
            WHERE ${whereClause}
        `);

        // Access result[0][0] to get the first row
        // Use parseFloat to ensure the amount is a proper number, defaulting to 0
        const totalAmount = parseFloat(result[0][0].total_wallet_amount) || 0;

        // Return wallet amount
        return res.status(200).json({
            status: 200,
            message: "Wallet amount fetched successfully",
            wallet_amount: totalAmount
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
    }
};

exports.paymentsAdminDataTable = async (req, res) => {
    try {
        const { company_id, page, limit, search, from_date, to_date } = req.query;

        const pageNum = parseInt(page) || 1;
        const pageLimit = parseInt(limit) || 100;
        const offset = (pageNum - 1) * pageLimit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
            wallet_type: 'credit',
            [Op.or]: [
                { refund_status: { [Op.ne]: 'refund' } },
                { refund_status: null }
            ]
        };

        // Filter by company_id if provided
        if (company_id) whereClause.company_id = company_id;

        // --- Relationship Manager filter ---
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            // Get companies for this RM
            const rmCompanies = await Company_Registration.findAll({
                where: { relationship_manager_id: req.user.id, status: { [Op.ne]: 'delete' } },
                attributes: ['id'],
                raw: true
            });

            const rmCompanyIds = rmCompanies.map(c => c.id);

            if (rmCompanyIds.length === 0) {
                return res.status(200).json({
                    status: 200,
                    table_name: 'company_wallet_payment_log',
                    message: 'Payments fetched successfully',
                    total: 0,
                    page: pageNum,
                    limit: pageLimit,
                    data: []
                });
            }

            // Apply RM filter to wallets
            whereClause.company_id = whereClause.company_id
                ? { [Op.and]: [whereClause.company_id, { [Op.in]: rmCompanyIds }] }
                : { [Op.in]: rmCompanyIds };
        }

        // --- Search ---
        if (search) {
            whereClause[Op.or] = [
                { wallet_type: { [Op.iLike]: `%${search}%` } },
                { company_id: { [Op.iLike]: `%${search}%` } },
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                literal(`CAST("amount" AS TEXT) ILIKE '%${search}%'`),
                literal(`CAST("balance" AS TEXT) ILIKE '%${search}%'`),
                literal(`TO_CHAR("createdAt", 'DD-MM-YYYY') ILIKE '%${search}%'`)
            ];
        }

        // --- Date filters ---
        if (from_date && to_date) {
            whereClause.createdAt = {
                [Op.between]: [
                    moment(from_date, 'YYYY-MM-DD').startOf('day').toDate(),
                    moment(to_date, 'YYYY-MM-DD').endOf('day').toDate()
                ]
            };
        } else if (from_date) {
            whereClause.createdAt = {
                [Op.gte]: moment(from_date, 'YYYY-MM-DD').startOf('day').toDate()
            };
        } else if (to_date) {
            whereClause.createdAt = {
                [Op.lte]: moment(to_date, 'YYYY-MM-DD').endOf('day').toDate()
            };
        }

        // --- Fetch total count and wallets ---
        const total = await Wallet.count({ where: whereClause });

        const wallets = await Wallet.findAll({
            where: whereClause,
            offset,
            limit: pageLimit,
            order: [['id', 'DESC']],
            attributes: ['id', 'transaction_id', 'company_id', 'amount', 'gst_amount', 'total_amount', 'description', 'createdAt', 'status', 'invoice_url_path']
        });

        const companyIds = wallets.map(wallet => wallet.company_id);

        // Fetch companies
        const companies = await Company_Registration.findAll({
            where: { 
               id: { [Op.in]: companyIds },
               status: { [Op.not]: 'delete' }
           },
            attributes: ['id', 'company_name']
        });

        const companyMap = new Map(companies.map(company => [company.id, company.company_name]));

        // Format wallets
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();
            walletData.date = walletData.createdAt ? moment(walletData.createdAt).format('DD-MM-YYYY hh:mm A') : null;
            walletData.company_name = companyMap.get(walletData.company_id) || null;
            return walletData;
        });

        return res.status(200).json({
            status: 200,
            table_name: 'company_wallet_payment_log',
            message: 'Payments fetched successfully',
            total,
            page: pageNum,
            limit: pageLimit,
            data: formattedWallets
        });

    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch Payments",
            error: err.message
        });
    }
};


exports.walletAdminDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const { city_id, area_id, search } = req.query;

        const sortField = req.query.sortField || 'id';
        const sortOrder = req.query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const whereClause = { 
          status: { [Op.ne]: 'delete' } 
      };

        if (city_id) whereClause.city_id = city_id;
        if (area_id) whereClause.area_id = area_id;

        // Apply Relationship Manager restriction
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            whereClause.relationship_manager_id = req.user.id;
        }

        if (search) {
    const searchLower = search.toLowerCase();

    const matchingCities = await City.findAll({
        where: where(fn('LOWER', col('city_name')), {
            [Op.like]: `%${searchLower}%`
        }),
        attributes: ['id'],
        raw: true
    });

    const matchingCityIds = matchingCities.map(c => c.id);

    whereClause[Op.or] = [
        where(fn('LOWER', col('company_name')), {
            [Op.like]: `%${searchLower}%`
        }),
        where(fn('LOWER', col('id_prifix_company')), {
            [Op.like]: `%${searchLower}%`
        }),
        where(cast(col('id'), 'TEXT'), {
            [Op.iLike]: `%${searchLower}%`
        }),
        where(fn('LOWER', col('name')), {
            [Op.like]: `%${searchLower}%`
        }),
        where(cast(col('mobile_number'), 'TEXT'), {
            [Op.iLike]: `%${searchLower}%`
        }),
        where(cast(col('wallet_amount'), 'TEXT'), {
            [Op.iLike]: `%${searchLower}%`
        }),

        // Add city_id filter if any matching city names found
        ...(matchingCityIds.length > 0 ? [{
            city_id: { [Op.in]: matchingCityIds }
        }] : [])
    ];
}

        const total = await Company_Registration.count({ where: whereClause });

        // Get company data
        const companys = await Company_Registration.findAll({
            where: whereClause,
            offset,
            limit,
            order: [[sortField, sortOrder]],
            attributes: ['id', 'company_name','id_prifix_company', 'city_id','area_id','name','mobile_number', 'wallet_amount'],
            raw: true
        });

        const companyIds = companys.map(s => s.id);

          const [ cities] = await Promise.all([
        
            City.findAll({
                attributes: ['id', 'city_name'],
                raw: true
            }),
        ]);

        const cityMap = Object.fromEntries(cities.map(c => [c.id, c.city_name]));
    
        const mergedData = companys.map(company => ({
            ...company,
            city_name: cityMap[company.city_id] || null,
        }));

        return res.status(200).json({
            status: 200,
            message: 'Company fetched successfully',
            table_name: 'company_registration',
            total,
            page,
            limit,
            data: mergedData
        });

    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
};

exports.paymentsWithdrawalAdminDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const { payment_status, city_id, area_id, society_id, search } = req.query;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        if (payment_status) whereClause.payment_status = payment_status;

        // --- Filter societies based on city, area, society_id ---
        let filteredSocietyIds = [];

        const societyFilter = {};

        if (city_id) societyFilter.city_id = city_id;
        if (area_id) societyFilter.area_id = area_id;
        if (society_id) societyFilter.id = society_id;

        // Apply Relationship Manager filter
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            societyFilter.relationship_manager_id = req.user.id;
        }

        if (Object.keys(societyFilter).length > 0) {
            const filteredSocieties = await Society_Registration.findAll({
                where: societyFilter,
                attributes: ['id']
            });

            filteredSocietyIds = filteredSocieties.map(s => s.id);

            if (filteredSocietyIds.length === 0) {
                return res.status(200).json({
                    status: 200,
                    table_name: 'society_withdraw_payments',
                    message: 'Withdraw Payments fetched successfully',
                    total: 0,
                    totalWithdrawAmount: 0,
                    page,
                    limit,
                    data: []
                });
            }

            // Filter payments by these society_ids
            whereClause.society_id = {
                [Op.in]: filteredSocietyIds
            };
        }

        // --- Search ---
        if (search) {
            whereClause[Op.or] = [
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                { invoice_id: { [Op.iLike]: `%${search}%` } },
                where(cast(col("withdraw_amount"), "TEXT"), { [Op.iLike]: `%${search}%` }),
                where(fn("TO_CHAR", col("createdAt"), "DD-MM-YYYY"), { [Op.iLike]: `%${search}%` })
            ];
        }

        // --- Pending / Approved amounts ---
        const pendingCount = await Society_Withdraw_Payments.sum('withdraw_amount', {
            where: { ...whereClause, payment_status: 'pending' }
        });

        const approvedCount = await Society_Withdraw_Payments.sum('withdraw_amount', {
            where: { ...whereClause, payment_status: 'approved' }
        });

        const total = await Society_Withdraw_Payments.count({ where: whereClause });

        const totalWithdrawAmount = await Society_Withdraw_Payments.sum('withdraw_amount', { where: whereClause });

        const wallets = await Society_Withdraw_Payments.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: [
                'id', 'invoice_id', 'transaction_id', 'withdraw_amount',
                'upload_report_path', 'upload_report_name',
                'payment_status','with_gst', 'createdAt', 'updatedAt', 'status',
                'created_by', 'modified_by', 'created_type', 'modified_type', 'society_id'
            ]
        });

        // Collect IDs
        const adminIds = [];
        const userIds = [];
        const societyIds = [];

        wallets.forEach(wallet => {
            if (wallet.created_type === 'Society_Admin') adminIds.push(wallet.created_by);
            else if (wallet.created_type === 'Society_User') userIds.push(wallet.created_by);

            if (wallet.society_id) societyIds.push(wallet.society_id);
        });

        // Get admin info
        const adminMap = {};
        const admins = await Society_Registration.findAll({
            // where: { id: adminIds },
            where: { id: adminIds, status: { [Op.ne]: 'delete' } }, 
            attributes: ['id', 'name', 'society_name', 'mobile_number']
        });
        admins.forEach(admin => {
            adminMap[admin.id] = {
                name: admin.name,
                society_name: admin.society_name,
                mobile_number: admin.mobile_number
            };
        });

        // Get user info and their societies
        const users = await Society_User.findAll({
            // where: { id: userIds },
            where: { id: userIds, status: { [Op.ne]: 'delete' } },
            attributes: ['id', 'society_id']
        });

        const societies = await Society_Registration.findAll({
            // where: { id: societyIds },
            where: { id: societyIds, status: { [Op.ne]: 'delete' } },
            attributes: ['id', 'name', 'society_name', 'mobile_number']
        });

        const societyMap = {};
        societies.forEach(s => {
            societyMap[s.id] = {
                name: s.name,
                society_name: s.society_name,
                mobile_number: s.mobile_number
            };
        });

        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = societyMap[user.society_id] || {
                name: 'Unknown',
                society_name: 'Unknown',
                mobile_number: 'Unknown'
            };
        });

        // Format and enrich data
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();

            walletData.created_date = moment(walletData.createdAt).format('D MMMM, YYYY - hh:mm A');
            walletData.updated_date = moment(walletData.updatedAt).format('D MMMM, YYYY - hh:mm A');

            if (wallet.created_type === 'Society_Admin') {
                const admin = adminMap[wallet.created_by] || {};
                walletData.name = admin.name || 'Unknown';
                walletData.society_name = admin.society_name || 'Unknown';
                walletData.mobile_number = admin.mobile_number || 'Unknown';
            } else if (wallet.created_type === 'Society_User') {
                const user = userMap[wallet.created_by] || {};
                walletData.name = user.name || 'Unknown';
                walletData.society_name = user.society_name || 'Unknown';
                walletData.mobile_number = user.mobile_number || 'Unknown';
            } else {
                walletData.name = 'Unknown';
                walletData.society_name = 'Unknown';
                walletData.mobile_number = 'Unknown';
            }

            return walletData;
        });

        return res.status(200).json({
            status: 200,
            table_name: 'society_withdraw_payments',
            message: 'Withdraw Payments fetched successfully',
            total,
            approvedCount,
            pendingCount,
            totalWithdrawAmount,
            page,
            limit,
            data: formattedWallets
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            message: "Failed to fetch Payments",
            error: err.message
        });
    }
};


exports.paymentsWithdrawalByIdAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const withdraw = await Society_Withdraw_Payments.findOne({
            where: {
                id,
                status: {
                    [Op.in]: ['active', 'inactive']
                }
            },
            attributes: [
                'id', 'invoice_id','transaction_id','society_id', 'withdraw_amount', 'upload_report_path', 'description','upload_report_name','transaction_path','transaction_name','remark','payment_status','with_gst', 'createdAt','updatedAt', 'status',
                'created_by', 'modified_by', 'created_type', 'modified_type'
            ]
        });

        if (!withdraw) {
            return res.status(404).json({
                status: 404,
                message: "Withdraw Payment not found"
            });
        }

        let submitted_by = 'Unknown';

        if (withdraw.created_type === 'Society_Admin') {
            const admin = await Society_Registration.findOne({
                where: { id: withdraw.created_by },
                status: { [Op.ne]: 'delete' },
                attributes: ['name','society_name','address','society_profile_img_path']
            });
    
             if (admin){
                    submitted_by = admin.name;
                    society_name= admin.society_name;
                    address = admin.address;
                    society_profile_img_path= admin.society_profile_img_path;
                }

        } else if (withdraw.created_type === 'Society_User') {
            const user = await Society_User.findOne({
                where: { id: withdraw.created_by },
                status: { [Op.ne]: 'delete' },
                attributes: ['society_id']
            });

            if (user) {
                const society = await Society_Registration.findOne({
                    where: { id: user.society_id },
                    status: { [Op.ne]: 'delete' },
                    attributes: ['name','society_name','address','society_profile_img_path']
                });
                if (society){
                    submitted_by = society.name;
                    society_name= society.society_name;
                    address = society.address;
                    society_profile_img_path= society.society_profile_img_path;
                }
            }
        }

        const result = withdraw.toJSON();
        result.created_date = moment(result.createdAt).format('D MMMM, YYYY - hh:mm A');
        result.updated_date = moment(result.updatedAt).format('D MMMM, YYYY - hh:mm A');
        result.submitted_by = submitted_by;
        result.society_name = society_name;
        result.address = address;
        result.society_profile_img_path = society_profile_img_path;

        return res.status(200).json({
            status: 200,
            message: "Withdraw Payment fetched successfully",
            data: result
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            message: "Error fetching Withdraw Payment",
            error: err.message
        });
    }
};

exports.updateWithdrawalAdmin = async (req, res) => {
    try {
        const { id, transaction_id, remark } = req.body;

        if (!id) {
            return res.status(400).json({
                status: 400,
                message: "Withdrawal ID is required"
            });
        }

        const userId = req.user.id || null;
        const userType = 'Admin';

        const imageFields = ["transaction_path"];
        let imagePaths = {};
        let imageNames = {};

        imageFields.forEach(field => {
            if (req.files && req.files[field] && req.files[field][0]) {
                const filename = req.files[field][0].filename;
                imagePaths[field] = `uploads/${filename}`;
                imageNames[field] = path.basename(filename);
            }
        });

        // Get withdrawal record
        const withdrawal = await Society_Withdraw_Payments.findOne({ where: { id } });
        if (!withdrawal) {
            return res.status(404).json({
                status: 404,
                message: "Withdrawal record not found"
            });
        }

        // Get society_id from withdrawal record
        const society_id = withdrawal.society_id;

        // Get current society wallet amount
        const society = await Society_Registration.findOne({ where: { id: society_id } });
        if (!society) {
            return res.status(404).json({
                status: 404,
                message: "Society not found"
            });
        }

        const previousAmount = society.society_wallet_amount || 0;
        const debitAmount = withdrawal.withdraw_amount;

        // Calculate new balance
        const newBalance = previousAmount - debitAmount;

        // Create a debit entry in Society_Wallet_Payment
        await Society_Wallet_Payment.create({
            society_id: society_id,
            amount: debitAmount,
            total_amount: newBalance,
            balance: previousAmount,
            wallet_type: 'debit',
            description: `Withdrawal of ₹${debitAmount} approved with transaction ID ${transaction_id || ''}`
        });

        // Update Society Wallet balance
        await Society_Registration.update(
            { society_wallet_amount: newBalance },
            { where: { id: society_id } }
        );

        // Update withdrawal record
        withdrawal.transaction_id = transaction_id || withdrawal.transaction_id;
        withdrawal.remark = remark || withdrawal.remark;
        if (imagePaths["transaction_path"]) {
            withdrawal.transaction_path = imagePaths["transaction_path"];
            withdrawal.transaction_name = imageNames["transaction_path"];
        }
        withdrawal.payment_status = 'approved';
        // Set paid_date with IST time
        withdrawal.paid_date = moment().tz('Asia/Kolkata').toDate();
        withdrawal.modified_by = userId;
        withdrawal.modified_ip_address = req.ip;
        withdrawal.modified_type = userType;

        await withdrawal.save();

        await Notification.create({
                society_ids: [society_id],
                // message: `Campaign Days Updated`,
                message:`Withdrawal of ₹${debitAmount} approved with transaction ID ${transaction_id || ''}`,
                from: 'admin',
                to: 'society',
                notify_type: 'individual',
                created_ip_address: req.ip
            });

        return res.status(200).json({
            status: 200,
            message: "Withdrawal updated successfully",
            data: withdrawal
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: "Failed to update withdrawal",
            error: error.message
        });
    }
};

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildSettlementWhereClause = (status) => {
    const whereClause = {
        status: { [Op.in]: ['active', 'inactive'] },
        admin_approved_status: 'approved',
        society_approved_status: 'approved',
        [Op.or]: [
            { refund_status: { [Op.ne]: 'refund' } },
            { refund_status: null }
        ]
    };

    if (status === 'pending' || status === 'paid') {
        whereClause.__settlement_status = status;
    }

    return whereClause;
};

exports.campaignSettlementSummary = async (req, res) => {
    try {
        const whereClause = buildSettlementWhereClause();
        delete whereClause.__settlement_status;

        const eligibleWhereClause = {
            ...whereClause,
            campaign_status: { [Op.in]: ['approved', 'completed'] }
        };

        const campaignLogs = await Campaign_Log.findAll({
            where: eligibleWhereClause,
            attributes: ['id', 'campaign_ads_amount', 'society_rate_snapshot']
        });

        const logIds = campaignLogs.map((log) => log.id);

        const settlements = logIds.length
            ? await Society_Wallet_Payment.findAll({
                where: {
                    campaign_log_id: { [Op.in]: logIds },
                    wallet_type: 'credit',
                    status: { [Op.in]: ['active', 'inactive'] }
                },
                attributes: ['campaign_log_id', 'amount']
            })
            : [];

        const settlementMap = new Map(
            settlements.map((entry) => [entry.campaign_log_id, toNumber(entry.amount)])
        );

        let platformHoldingAmount = 0;
        let platformRevenueAmount = 0;
        let societyTransferredAmount = 0;
        let pendingDefaultTransferAmount = 0;

        for (const log of campaignLogs) {
            const companyAmount = toNumber(log.campaign_ads_amount);
            const defaultSocietyAmount = Math.min(
                companyAmount,
                Math.max(0, toNumber(log.society_rate_snapshot || log.campaign_ads_amount))
            );
            const transferredAmount = Math.min(companyAmount, settlementMap.get(log.id) || 0);
            const platformAmount = Math.max(0, companyAmount - transferredAmount);

            if (settlementMap.has(log.id)) {
                platformRevenueAmount += platformAmount;
                societyTransferredAmount += transferredAmount;
            } else {
                platformHoldingAmount += companyAmount;
                pendingDefaultTransferAmount += defaultSocietyAmount;
            }
        }

        return res.status(200).json({
            status: 200,
            message: 'Campaign settlement summary fetched successfully',
            data: {
                totalCompletedAds: campaignLogs.length,
                pendingSettlementAds: campaignLogs.length - settlements.length,
                settledAds: settlements.length,
                platform_holding_amount: Number(platformHoldingAmount.toFixed(2)),
                platform_revenue_amount: Number(platformRevenueAmount.toFixed(2)),
                society_transferred_amount: Number(societyTransferredAmount.toFixed(2)),
                pending_default_transfer_amount: Number(pendingDefaultTransferAmount.toFixed(2))
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: 'Failed to fetch campaign settlement summary',
            error: error.message
        });
    }
};

exports.campaignSettlementDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const {
            search = '',
            status = '',
            society_id = '',
            company_id = ''
        } = req.query;

        const whereClause = buildSettlementWhereClause(status);
        const settlementStatus = whereClause.__settlement_status;
        delete whereClause.__settlement_status;

        const eligibleWhereClause = {
            ...whereClause,
            campaign_status: { [Op.in]: ['approved', 'completed'] }
        };

        if (society_id) eligibleWhereClause.society_id = Number(society_id);
        if (company_id) eligibleWhereClause.company_id = Number(company_id);

        const allSettlementRows = await Society_Wallet_Payment.findAll({
            where: {
                wallet_type: 'credit',
                campaign_log_id: { [Op.ne]: null },
                status: { [Op.in]: ['active', 'inactive'] }
            },
            attributes: ['campaign_log_id', 'amount', 'createdAt', 'transaction_path', 'transaction_name']
        });
        const settlementByLog = new Map(
            allSettlementRows.map((row) => [row.campaign_log_id, row])
        );
        const settledLogIds = allSettlementRows.map((row) => row.campaign_log_id);

        if (settlementStatus === 'paid') {
            eligibleWhereClause.id = settledLogIds.length ? { [Op.in]: settledLogIds } : -1;
        } else if (settlementStatus === 'pending') {
            eligibleWhereClause.id = settledLogIds.length ? { [Op.notIn]: settledLogIds } : { [Op.ne]: null };
        }

        const { count, rows } = await Campaign_Log.findAndCountAll({
            where: eligibleWhereClause,
            attributes: [
                'id',
                'campaign_id',
                'id_prifix_campaign_ads',
                'media_type',
                'campaign_ads_amount',
                'society_rate_snapshot',
                'company_id',
                'society_id',
                'completed_date',
                'createdAt'
            ],
            order: [['id', 'DESC']],
            offset,
            limit
        });

        const societyIds = [...new Set(rows.map((row) => row.society_id).filter(Boolean))];
        const companyIds = [...new Set(rows.map((row) => row.company_id).filter(Boolean))];
        const campaignIds = [...new Set(rows.map((row) => row.campaign_id).filter(Boolean))];

        const [societies, companies, campaigns] = await Promise.all([
            Society_Registration.findAll({
                where: { id: { [Op.in]: societyIds } },
                attributes: ['id', 'society_name', 'id_prifix_society']
            }),
            Company_Registration.findAll({
                where: { id: { [Op.in]: companyIds } },
                attributes: ['id', 'company_name', 'id_prifix_company']
            }),
            Campaign.findAll({
                where: { id: { [Op.in]: campaignIds } },
                attributes: ['id', 'id_prifix_campaign', 'campaign_name', 'campaign_date']
            })
        ]);

        const societyMap = new Map(societies.map((s) => [s.id, s]));
        const companyMap = new Map(companies.map((c) => [c.id, c]));
        const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

        const normalizedSearch = String(search || '').trim().toLowerCase();

        let data = rows.map((row) => {
            const log = row.toJSON();
            const settlement = settlementByLog.get(log.id);
            const companyAmount = toNumber(log.campaign_ads_amount);
            const defaultSocietyAmount = Math.min(
                companyAmount,
                Math.max(0, toNumber(log.society_rate_snapshot || log.campaign_ads_amount))
            );
            const transferredAmount = settlement ? toNumber(settlement.amount) : 0;

            const society = societyMap.get(log.society_id);
            const company = companyMap.get(log.company_id);
            const campaign = campaignMap.get(log.campaign_id);

            return {
                id: log.id,
                campaign_log_id: log.id,
                campaign_log_code: log.id_prifix_campaign_ads,
                media_type: log.media_type || null,
                campaign_id: log.campaign_id,
                campaign_code: campaign?.id_prifix_campaign || null,
                campaign_name: campaign?.campaign_name || null,
                campaign_date: campaign?.campaign_date || null,
                company_id: log.company_id,
                company_name: company?.company_name || null,
                company_code: company?.id_prifix_company || null,
                society_id: log.society_id,
                society_name: society?.society_name || null,
                society_code: society?.id_prifix_society || null,
                company_amount: Number(companyAmount.toFixed(2)),
                default_society_amount: Number(defaultSocietyAmount.toFixed(2)),
                transferred_amount: Number(transferredAmount.toFixed(2)),
                platform_amount: Number(Math.max(0, companyAmount - transferredAmount).toFixed(2)),
                settlement_status: settlement ? 'paid' : 'pending',
                completed_date: log.completed_date,
                transferred_at: settlement?.createdAt || null,
                transaction_path: settlement?.transaction_path || null,
                transaction_name: settlement?.transaction_name || null
            };
        });

        if (normalizedSearch) {
            data = data.filter((item) => {
                const haystack = [
                    item.campaign_log_code,
                    item.campaign_code,
                    item.campaign_name,
                    item.company_name,
                    item.company_code,
                    item.society_name,
                    item.society_code
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(normalizedSearch);
            });
        }

        return res.status(200).json({
            status: 200,
            message: 'Campaign settlements fetched successfully',
            total: count,
            page,
            limit,
            data
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: 'Failed to fetch campaign settlements',
            error: error.message
        });
    }
};

exports.transferCampaignSettlement = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const userId = req.user?.id || null;
        const { campaign_log_id, transfer_amount, remark } = req.body;
        const transactionFile = req?.files?.transaction_path?.[0];
        const transactionPath = transactionFile ? `uploads/${transactionFile.filename}` : null;
        const transactionName = transactionFile ? transactionFile.originalname : null;

        if (!campaign_log_id) {
            await transaction.rollback();
            return res.status(400).json({ status: 400, message: 'campaign_log_id is required' });
        }

        const campaignLog = await Campaign_Log.findOne({
            where: {
                id: campaign_log_id,
                status: { [Op.in]: ['active', 'inactive'] },
                admin_approved_status: 'approved',
                society_approved_status: 'approved',
                campaign_status: { [Op.in]: ['approved', 'completed'] },
                [Op.and]: [
                    {
                        [Op.or]: [
                            { refund_status: { [Op.ne]: 'refund' } },
                            { refund_status: null }
                        ]
                    }
                ]
            },
            attributes: [
                'id',
                'campaign_id',
                'company_id',
                'society_id',
                'campaign_ads_amount',
                'society_rate_snapshot',
                'id_prifix_campaign_ads'
            ],
            transaction
        });

        if (!campaignLog) {
            await transaction.rollback();
            return res.status(404).json({ status: 404, message: 'Eligible approved campaign log not found' });
        }

        const existingSettlement = await Society_Wallet_Payment.findOne({
            where: {
                campaign_log_id,
                wallet_type: 'credit',
                status: { [Op.in]: ['active', 'inactive'] }
            },
            transaction
        });

        if (existingSettlement) {
            await transaction.rollback();
            return res.status(400).json({ status: 400, message: 'Settlement already transferred for this campaign log' });
        }

        const companyAmount = toNumber(campaignLog.campaign_ads_amount);
        const defaultAmount = Math.min(
            companyAmount,
            Math.max(0, toNumber(campaignLog.society_rate_snapshot || campaignLog.campaign_ads_amount))
        );
        const finalTransferAmount = transfer_amount === undefined || transfer_amount === null || transfer_amount === ''
            ? defaultAmount
            : toNumber(transfer_amount);

        if (finalTransferAmount <= 0) {
            await transaction.rollback();
            return res.status(400).json({ status: 400, message: 'transfer_amount must be greater than 0' });
        }

        if (finalTransferAmount > companyAmount) {
            await transaction.rollback();
            return res.status(400).json({ status: 400, message: 'transfer_amount cannot exceed collected company amount' });
        }

        const society = await Society_Registration.findOne({
            where: { id: campaignLog.society_id },
            attributes: ['id', 'society_wallet_amount', 'society_name'],
            transaction
        });

        if (!society) {
            await transaction.rollback();
            return res.status(404).json({ status: 404, message: 'Society not found' });
        }

        const campaign = await Campaign.findOne({
            where: { id: campaignLog.campaign_id },
            attributes: ['id_prifix_campaign'],
            transaction
        });

        const previousBalance = toNumber(society.society_wallet_amount);
        const updatedBalance = previousBalance + finalTransferAmount;
        const platformAmount = Math.max(0, companyAmount - finalTransferAmount);

        await Society_Registration.update(
            { society_wallet_amount: updatedBalance },
            { where: { id: society.id }, transaction }
        );

        await Society_Wallet_Payment.create({
            society_id: campaignLog.society_id,
            company_id: campaignLog.company_id,
            campaign_id: campaignLog.campaign_id,
            campaign_log_id: campaignLog.id,
            wallet_type: 'credit',
            amount: finalTransferAmount,
            total_amount: updatedBalance,
            balance: previousBalance,
            payment_status: 'paid',
            transaction_id: `STL${Date.now()}`,
            transaction_path: transactionPath,
            transaction_name: transactionName,
            description: `Admin settlement transfer for campaign #${campaign?.id_prifix_campaign || campaignLog.campaign_id} ad #${campaignLog.id_prifix_campaign_ads}.${remark ? ` Remark: ${remark}` : ''}`,
            created_ip_address: req.ip,
            created_by: userId,
            created_type: 'Admin'
        }, { transaction });

        await Notification.create({
            society_ids: [campaignLog.society_id],
            message: `Settlement credited for campaign #${campaign?.id_prifix_campaign || campaignLog.campaign_id} and ad #${campaignLog.id_prifix_campaign_ads}. Amount: ₹${finalTransferAmount.toFixed(2)}`,
            from: 'admin',
            to: 'society',
            notify_type: 'individual',
            created_ip_address: req.ip
        }, { transaction });

        await transaction.commit();

        return res.status(200).json({
            status: 200,
            message: 'Settlement transferred to society wallet successfully',
            data: {
                campaign_log_id: campaignLog.id,
                company_amount: Number(companyAmount.toFixed(2)),
                transferred_amount: Number(finalTransferAmount.toFixed(2)),
                platform_amount: Number(platformAmount.toFixed(2)),
                society_wallet_before: Number(previousBalance.toFixed(2)),
                society_wallet_after: Number(updatedBalance.toFixed(2))
            }
        });
    } catch (error) {
        await transaction.rollback();
        return res.status(500).json({
            status: 500,
            message: 'Failed to transfer settlement',
            error: error.message
        });
    }
};