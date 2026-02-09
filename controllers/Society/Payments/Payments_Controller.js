
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const Society_Withdraw_Payments = require('@models/Society/Payments/Withdraw_Model');
const path = require('path');
const { Op } = require('sequelize');
const { where, literal, Sequelize } = require('sequelize');
const moment = require('moment-timezone');

exports.WalletSocietyAmount = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user_type;
        let societyId = null;

        if (userType === "Society_Admin") {
            const admin = await Society_Registration.findOne({ where: { id: userId } });
            if (!admin) {
                return res.status(404).json({ status: 404, message: "Society admin not found" });
            }
            societyId = admin.id;
        } else if (userType === "Society_User") {
            const societyUser = await Society_User.findOne({ where: { id: userId } });
            if (!societyUser) {
                return res.status(404).json({ status: 404, message: "Society user not found" });
            }
            societyId = societyUser.society_id;
        } else {
            return res.status(400).json({ status: 400, message: "Invalid user type" });
        }

        const user = await Society_Registration.findOne({
            where: { id: societyId },
            attributes: ['id', 'society_wallet_amount']
        });

        if (!user) {
            return res.status(404).json({ status: 404, message: "Society not found" });
        }

        const walletAmount = user.society_wallet_amount ?? 0;

         // **Subtract pending withdrawals**
        const pendingWithdrawals = await Society_Withdraw_Payments.findAll({
            where: {
                society_id: societyId,
                payment_status: 'pending'
            },
            attributes: ['withdraw_amount']
        });

        const pendingTotal = pendingWithdrawals.reduce((sum, w) => sum + parseFloat(w.withdraw_amount), 0);

        const availableBalance = walletAmount - pendingTotal;

        return res.status(200).json({
            status: 200,
            message: "Society Wallet amount fetched successfully",
            // society_wallet_amount: walletAmount
            society_wallet_amount: availableBalance

            // society_wallet_amount: walletAmount,
            // pending_withdraw_amount: pendingTotal,
            // available_wallet_amount: availableBalance
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
    }
};


exports.addWithdrawal = async (req, res) => {
     try {
        const  { withdraw_amount, invoice_id, description, with_gst } = req.body
        
            const userId = req.user.id;
            const userType = req.user_type;
            let societyId = null;
            let societyUserId = null;
    
            // Determine company and user IDs
            if (userType === "Society_Admin") {
                let user = await Society_Registration.findOne({ where: { id: userId } });
                societyId = user.id;
            }   
    
            if (userType === "Society_User") {
                let societyUser = await Society_User.findOne({ where: { id: userId } });
                societyId = societyUser.society_id;
                societyUserId = societyUser.id;
            }

            if (!societyId) {
               return res.status(400).json({ status: 400, message: "Invalid society information" });
            }

               // Fetch wallet amount
          const society = await Society_Registration.findOne({
               where: { id: societyId },
               attributes: ['society_wallet_amount']
          });

         if (!society) {
            return res.status(404).json({ status: 404, message: "Society not found" });
          }

        if (parseFloat(society.society_wallet_amount) < parseFloat(withdraw_amount)) {
            return res.status(400).json({ status: 400, message: "Insufficient wallet balance" });
        }

        // Handle multiple images dynamically
                const imageFields = [
                    "upload_report_path",
                ];
                
                let imagePaths = {};
                let imageNames = {};
        
                imageFields.forEach(field => {
                    if (req.files[field] && req.files[field][0]) {
                        imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                        imageNames[field] = path.basename(req.files[field][0].filename);
                    }
                });

         // Create a new withdrawal entry
        const newWithdraw = await Society_Withdraw_Payments.create({
            society_id:societyId,
            society_user_id:societyUserId || null,
            withdraw_amount,
            invoice_id,
            description,
            with_gst,
            upload_report_path: imagePaths["upload_report_path"],
            upload_report_name: imageNames["upload_report_path"],
            created_by: userId,
            created_ip_address: req.ip,
            created_type: userType
        });

        return res.status(201).json({
            status: 201,
            message: "Withdrawal request submitted successfully",
            data: newWithdraw
        });

     } catch (error) {
          return res.status(500).json({ status: 500, error: error.message });
     }
}

exports.paymentsWithdrawalDataTable = async (req, res) => {
    try {
        const { page, limit, payment_status, search} = req.query;

        // Default values if no query parameters are provided
        const pageNum = parseInt(page) || 1;
        const pageLimit = parseInt(limit) || 10;
        const offset = (pageNum - 1) * pageLimit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            },
        };

        let societyId = null

        // Apply company-based filtering
        if (req.user_type === 'Society_Admin') {
            whereClause.society_id = req.user.id; 
            societyId = req.user.id;
        } else if (req.user_type === 'Society_User') {
            whereClause.society_id = req.user.society_id;
            societyId = req.user.society_id;
        }

        if (payment_status) whereClause.payment_status = payment_status;

        // Handle search filters
        if (search) {
            whereClause[Op.or] = [
                { description: { [Op.iLike]: `%${search}%` } },
                { wallet_type: { [Op.iLike]: `%${search}%` } },
                { transaction_id: { [Op.iLike]: `%${search}%` } },
                literal(`CAST("withdraw_amount" AS TEXT) ILIKE '%${search}%'`),
                // literal(`CAST("balance" AS TEXT) ILIKE '%${search}%'`),
                literal(`TO_CHAR("createdAt", 'DD-MM-YYYY') ILIKE '%${search}%'`)
            ];
        }

        const pendingCount = await Society_Withdraw_Payments.sum('withdraw_amount',{
                    where: {
                        payment_status: 'pending',
                        society_id: societyId,
                    }
                });

        const approvedCount = await Society_Withdraw_Payments.sum('withdraw_amount',{
                    where: {
                        payment_status: 'approved',
                        society_id: societyId,
                    }
                });
        // Count total records
        const total = await Society_Withdraw_Payments.count({ where: whereClause, society_id: societyId, });

          // Sum of all withdraw_amount
        const totalWithdrawAmount = await Society_Withdraw_Payments.sum('withdraw_amount', {
          where: whereClause
        });

        // Get Payments data with pagination and sorting
        const wallets = await Society_Withdraw_Payments.findAll({
            where: whereClause,
            offset,
            limit: pageLimit,
            order: [['id', 'DESC']],
            attributes: ['id', 'invoice_id','transaction_id', 'withdraw_amount', 'upload_report_path', 'wallet_type', 'description','upload_report_name','payment_status','with_gst', 'createdAt','updatedAt', 'status','created_by','modified_by','created_type','modified_type']
        });

               // Step 1: Collect IDs
          const adminIds = [];
          const userIds = [];

          wallets.forEach(wallet => {
               if (wallet.created_type === 'Society_Admin') {
                    adminIds.push(wallet.created_by);
               } else if (wallet.created_type === 'Society_User') {
                    userIds.push(wallet.created_by);
               }
          });

          // Step 2: Fetch names manually
          const adminMap = {};
          const userMap = {};

          // Get Society_Admin names
          const admins = await Society_Registration.findAll({
          where: { id: adminIds },
          attributes: ['id', 'name']
          });
          admins.forEach(admin => {
          adminMap[admin.id] = admin.name;
          });

          // Get Society_User with their society names
          const users = await Society_User.findAll({
          where: { id: userIds },
          attributes: ['id', 'society_id']
          });

          const societyIds = users.map(u => u.society_id);
          const societies = await Society_Registration.findAll({
          where: { id: societyIds },
          attributes: ['id', 'name']
          });
          const societyMap = {};
          societies.forEach(s => {
          societyMap[s.id] = s.name;
          });
          users.forEach(user => {
          userMap[user.id] = societyMap[user.society_id] || 'Unknown';
          });


        // Format createdAt to "dd-mm-yyyy"
        const formattedWallets = wallets.map(wallet => {
            const walletData = wallet.toJSON();
            if (walletData.createdAt) {
                walletData.created_date = moment(walletData.createdAt).format('D MMMM, YYYY - hh:mm A');
                walletData.updated_date = moment(walletData.updatedAt).format('D MMMM, YYYY - hh:mm A');
            }

            if (wallet.created_type === 'Society_Admin') {
                    walletData.submitted_by = adminMap[wallet.created_by] || 'Unknown';
               } else if (wallet.created_type === 'Society_User') {
                    walletData.submitted_by = userMap[wallet.created_by] || 'Unknown';
               } else {
                    walletData.submitted_by = 'Unknown';
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
            totalWithdrawAmount:totalWithdrawAmount,
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

exports.paymentsWithdrawalById = async (req, res) => {
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
                'id', 'invoice_id','transaction_id', 'withdraw_amount', 'upload_report_path', 'description',
                'upload_report_name','transaction_path','transaction_name','remark','payment_status','with_gst','createdAt','updatedAt', 'status',
                'created_by', 'modified_by', 'created_type', 'modified_type'
            ]
        });

        if (!withdraw) {
            return res.status(404).json({
                status: 404,
                message: "Withdraw Payment not found"
            });
        }

        // Determine submitted_by
        let submitted_by = 'Unknown';

        if (withdraw.created_type === 'Society_Admin') {
            const admin = await Society_Registration.findOne({
                where: { id: withdraw.created_by },
                attributes: ['name']
            });
            if (admin) submitted_by = admin.name;

        } else if (withdraw.created_type === 'Society_User') {
            const user = await Society_User.findOne({
                where: { id: withdraw.created_by },
                attributes: ['society_id']
            });

            if (user) {
                const society = await Society_Registration.findOne({
                    where: { id: user.society_id },
                    attributes: ['name']
                });
                if (society) submitted_by = society.name;
            }
        }

        const result = withdraw.toJSON();
        result.created_date = moment(result.createdAt).format('D MMMM, YYYY - hh:mm A');
        result.updated_date = moment(result.updatedAt).format('D MMMM, YYYY - hh:mm A');
        result.submitted_by = submitted_by;

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


