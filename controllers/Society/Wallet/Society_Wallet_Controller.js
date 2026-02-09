const Society_Wallet_Payment = require('@models/Society/Payments/Society_Wallet_Model'); 
const { Op, fn, col, where, literal, NUMBER,Sequelize, cast } = require('sequelize');
const moment = require('moment');

 exports.walletSocietyDataTable = async (req, res) => {
     try {
          // 1. Extract query parameters with fallbacks 
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10; 
          const search = req.query.search || ''; 
          const fromDate = req.query.from_date || '';  // NEW
          const toDate = req.query.to_date || '';      // NEW
     
         // Calculate offset for pagination
         const offset = (page - 1) * limit;
 
         // Create where clause for filtering
         const whereClause = {
             status: {
                 [Op.in]: ['active', 'inactive'] // Include only active and inactive
             }
         };

          // Apply company-based filtering
        if (req.user_type === 'Society_Admin') {
            whereClause.society_id = req.user.id; // Company_Admin's ID
        } else if (req.user_type === 'Society_User') {
            whereClause.society_id = req.user.society_id; // Company_User's company ID
        }

        if (search) {
            whereClause[Op.or] = [
                { description: { [Op.iLike]: `%${search}%` } },
                { wallet_type: { [Op.iLike]: `%${search}%` } },
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                Sequelize.where(Sequelize.literal(`CAST("amount" AS TEXT)`), {
                    [Op.iLike]: `%${search}%`
                }),
                Sequelize.where(Sequelize.literal(`CAST("balance" AS TEXT)`), {
                    [Op.iLike]: `%${search}%`
                }),
                Sequelize.where(Sequelize.literal(`TO_CHAR("createdAt", 'DD-MM-YYYY')`), {
                    [Op.iLike]: `%${search}%`
                })
            ];
        }
 
         // From Date / To Date Filter
         if (fromDate && toDate) {
            whereClause.createdAt = {
                [Op.between]: [
                    moment(fromDate, 'YYYY-MM-DD').startOf('day').toDate(),
                    moment(toDate, 'YYYY-MM-DD').endOf('day').toDate()
                ]
            };
        } else if (fromDate) {
            whereClause.createdAt = {
                [Op.gte]: moment(fromDate, 'YYYY-MM-DD').startOf('day').toDate()
            };
        } else if (toDate) {
            whereClause.createdAt = {
                [Op.lte]: moment(toDate, 'YYYY-MM-DD').endOf('day').toDate()
            };
        }

         // Count total records
         const total = await Society_Wallet_Payment.count({ where: whereClause });
 
         // Get Wallet data with pagination and sorting
         const wallets = await Society_Wallet_Payment.findAll({
         where: whereClause,
         offset,
         limit,
         order: [['id', 'DESC']],
     //     attributes: ['id','transaction_id','wallet_type','balance', 'amount','gst_amount', 'description','createdAt', 'status', 'invoice_url_path']
         });

         // Format createdAt to "dd-mm-yyyy"
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();
            if (walletData.createdAt) {
                walletData.date = moment(walletData.createdAt).format('DD-MM-YYYY');
            }
            return walletData;
        });
 
         return res.status(200).json({
             status: 200,
             table_name: 'society_wallet_payment_log',
             message: 'Wallets fetched successfully',
             total,
             page,
             limit,
             data: formattedWallets
         });
     } catch (err) {
         res.status(500).json({
             status: 500,
             message: "Failed to fetch Wallets",
             error: err.message
         });
     }
 };