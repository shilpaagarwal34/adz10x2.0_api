
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const { Op, fn, col, where, literal } = require('sequelize');
const moment = require('moment');

exports.paymentsDataTable = async (req, res) => {
    try {
        const { page, limit, search, from_date, to_date } = req.query;

        // Default values if no query parameters are provided
        const pageNum = parseInt(page) || 1;
        const pageLimit = parseInt(limit) || 10;
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

        // Apply company-based filtering
        if (req.user_type === 'Company_Admin') {
            whereClause.company_id = req.user.id; // Company_Admin's ID
        } else if (req.user_type === 'Company_User') {
            whereClause.company_id = req.user.company_id; // Company_User's company ID
        }

        // Handle search filters
        if (search) {
            whereClause[Op.or] = [
                { description: { [Op.iLike]: `%${search}%` } },
                { wallet_type: { [Op.iLike]: `%${search}%` } },
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                literal(`CAST("amount" AS TEXT) ILIKE '%${search}%'`),
                literal(`CAST("balance" AS TEXT) ILIKE '%${search}%'`),
                literal(`TO_CHAR("createdAt", 'DD-MM-YYYY') ILIKE '%${search}%'`)
            ];
        }

        // Handle From Date / To Date Filter
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

        // Count total records
        const total = await Wallet.count({ where: whereClause });

        // Get Payments data with pagination and sorting
        const wallets = await Wallet.findAll({
            where: whereClause,
            offset,
            limit: pageLimit,
            order: [['id', 'DESC']],
            attributes: ['id', 'transaction_id', 'amount', 'gst_amount', 'description','refund_status', 'createdAt', 'status', 'invoice_url_path']
        });

        // Format createdAt to "dd-mm-yyyy"
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();
            if (walletData.createdAt) {
                walletData.date = moment(walletData.createdAt).format('DD-MM-YYYY hh:mm A');
            }
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

exports.paymentsDataTableTest = async (req, res) => {
    try {
        const { page, limit, search, from_date, to_date } = req.query;

        // Default values if no query parameters are provided
        const pageNum = parseInt(page) || 1;
        const pageLimit = parseInt(limit) || 10;
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

        whereClause.company_id = 39; 


        // Handle search filters
        if (search) {
            whereClause[Op.or] = [
                { description: { [Op.iLike]: `%${search}%` } },
                { wallet_type: { [Op.iLike]: `%${search}%` } },
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                literal(`CAST("amount" AS TEXT) ILIKE '%${search}%'`),
                literal(`CAST("balance" AS TEXT) ILIKE '%${search}%'`),
                literal(`TO_CHAR("createdAt", 'DD-MM-YYYY') ILIKE '%${search}%'`)
            ];
        }

        // Handle From Date / To Date Filter
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

        // Count total records
        const total = await Wallet.count({ where: whereClause });

        // Get Payments data with pagination and sorting
        const wallets = await Wallet.findAll({
            where: whereClause,
            offset,
            limit: pageLimit,
            order: [['id', 'DESC']],
            attributes: ['id', 'transaction_id', 'amount', 'gst_amount', 'description','refund_status', 'createdAt', 'status', 'invoice_url_path']
        });

        // Format createdAt to "dd-mm-yyyy"
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();
            if (walletData.createdAt) {
                walletData.date = moment(walletData.createdAt).format('DD-MM-YYYY hh:mm A');
            }
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