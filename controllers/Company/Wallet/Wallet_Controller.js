
const Wallet = require('@models/Company/Wallet/Wallet_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Company_User = require('@models/Company/Users/Company_User_Model');
const Payment_Order = require('@models/Company/Wallet/Payment_Order_Model');
const PDFDocument = require('pdfkit'); // for generating invoices
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');
const { Op, fn, col, where, literal } = require('sequelize');
const moment = require('moment');
const crypto = require('crypto');
const { error } = require('console');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


exports.walletAmount = async (req, res) => {
    try {
        let token = req.body.token || req.headers.authorization;
        if (!token) {
            return res.status(400).json({ status: 400, message: "Token is required" });
        }

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

            const user = await Company_Registration.findOne({
            where: { id: comapnyId },
            attributes: ['id', 'wallet_amount'] // Only select necessary fields
        });


        // Return wallet amount
        return res.status(200).json({
            status: 200,
            message: "Wallet amount fetched successfully",
            wallet_amount: user.wallet_amount
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
    }
};

exports.wallet_Add_Validation = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user_type;
        let comapnyId = null;

        // Determine company and user IDs
        if (userType === "Company_Admin") {
            const user = await Company_Registration.findOne({ where: { id: userId } });
            comapnyId = user?.id || null;
        }

        if (userType === "Company_User") {
            const companyUser = await Company_User.findOne({ where: { id: userId } });
            comapnyId = companyUser?.company_id || null;
        }

        if (!comapnyId) {
            return res.status(400).json({
                status: 400,
                isAllowed: false,
                message: "Company not found for current user"
            });
        }

        // Check if this is the first wallet entry for the company
        const existingWalletEntry = await Wallet.findOne({ where: { company_id: comapnyId } });

        if (!existingWalletEntry) {
            // First time: validate that minimum amount is 10000
            const { amount } = req.body;
            if (!amount || parseFloat(amount) < 10000) {
                return res.status(400).json({
                    status: 400,
                    isAllowed: false,
                    message: "Minimum wallet amount must be 10,000 for the first entry"
                });
            }
        }

        // Proceed with your logic (e.g., adding wallet record)

        return res.status(200).json({
            status: 200,
            isAllowed: true,
            message: "Wallet validation successful",
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: 500,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.walletDataTable = async (req, res) => {
     try {
          // 1. Extract query parameters with fallbacks 
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 10; 
          const search = req.query.search || ''; 
          const fromDate = req.query.from_date || '';  // NEW
          const toDate = req.query.to_date || '';      // NEW
     
         // Calculate offset for pagination
         const offset = (page - 1) * limit;
 
        // Resolve company id safely from authenticated user
        let companyId = null;
        if (req.user_type === 'Company_Admin') {
            companyId = req.user?.id || null;
        } else if (req.user_type === 'Company_User') {
            companyId = req.user?.company_id || null;
            if (!companyId) {
                const companyUser = await Company_User.findOne({
                    where: { id: req.user?.id },
                    attributes: ['company_id'],
                });
                companyId = companyUser?.company_id || null;
            }
        }

        if (!companyId) {
            return res.status(400).json({
                status: 400,
                message: "Company not found for current user",
            });
        }

        // Create where clause for filtering
         const whereClause = {
            company_id: companyId,
             status: {
                 [Op.in]: ['active', 'inactive'] // Include only active and inactive
             }
         };

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
         const total = await Wallet.count({ where: whereClause });
 
         // Get Wallet data with pagination and sorting
         const wallets = await Wallet.findAll({
         where: whereClause,
         offset,
         limit,
         order: [['id', 'DESC']],
         attributes: ['id','transaction_id','wallet_type','balance', 'amount','gst_amount', 'description','createdAt', 'status', 'invoice_url_path']
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
             table_name: 'company_wallet_payment_log',
             message: 'Wallets fetched successfully',
             total,
             page,
             limit,
             data: formattedWallets
         });
     } catch (err) {
         console.error("[walletDataTable]", err?.message, err?.stack);
         res.status(500).json({
             status: 500,
             message: err?.message || "Failed to fetch Wallets",
             error: err.message
         });
     }
};

exports.createOrders = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: 'receipt#1'
    };

    const order = await razorpay.orders.create(options);

    await Payment_Order.create({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      entity: order.entity,
      receipt: order.receipt,
      razorpay_order_status: order.status,
      amount_paid: order.amount_paid,
      amount_due: order.amount_due,
      offer_id:order.offer_id,
      attempts: order.attempts,
      created_at_razorpay: order.created_at,
      notes: order.notes
    });

    res.status(200).json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: 'receipt#1'
    };

    const order = await razorpay.orders.create(options);

    await Payment_Order.create({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      entity: order.entity,
      receipt: order.receipt,
      razorpay_order_status: order.status,
      amount_paid: order.amount_paid,
      amount_due: order.amount_due,
      offer_id:order.offer_id,
      attempts: order.attempts,
      created_at_razorpay: order.created_at,
      notes: order.notes
    });

    res.status(200).json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature,amount } = req.body;
        const body = razorpay_order_id + '|' + razorpay_payment_id;
        const expected_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
        if (expected_signature === razorpay_signature) {
          res.json({ message: 'Payment verified successfully',
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature,
                amount
           });
        } else {
          res.status(400).json({ message: 'Payment verification failed' });
        }
      } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ message: 'Server error during payment verification' });
      }
}

exports.wallet_Add = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user_type;

        let comapnyId = null;
        let comapnyUserId = null;
        let user = null;

        if (userType === "Company_Admin") {
            user = await Company_Registration.findOne({ where: { id: userId } });
            comapnyId = user.id;
        }

        if (userType === "Company_User") {
            let companyUser = await Company_User.findOne({ where: { id: userId } });
            comapnyId = companyUser.company_id;
            comapnyUserId = companyUser.id;
        }

        let company_users = await Company_Registration.findOne({ where: { id: comapnyId } });

        const { amount, razorpay_payment_id, razorpay_order_id } = req.body;

        const wallet_type = 'credit';
        const description = 'Fund Credited';

        if (!wallet_type || !amount) {
            return res.status(400).json({ status: 400, message: "Amount is required" });
        }

        const gstPercentage = 18;
        const totalAmount = parseFloat(amount) / 100;

        const baseAmount = (totalAmount / (1 + gstPercentage / 100)).toFixed(2);
        const gstAmount = (totalAmount - baseAmount).toFixed(2);
        const halfGST = (gstAmount / 2).toFixed(2);

        let previousBalance = parseFloat(user.wallet_amount || 0);
        let newBalance = previousBalance + parseFloat(baseAmount);

        const invoiceId = 'RN' + Date.now();
        // const transactionId = 'TXN' + Date.now();
        const transactionId = razorpay_payment_id;

        const logoPath = path.join(__dirname, '../../../assets/adz10x-logo.png');
        const logoData = fs.readFileSync(logoPath).toString('base64');

                // Step 2: Read and convert to base64
        const imageBuffer = fs.readFileSync(logoPath);
        const logoBase64 = `data:image/png;base64,${imageBuffer.toString('base64')}`;

        const invoiceFileName = `${invoiceId}.pdf`;
        const invoicePath = path.join(__dirname, `../../../invoices/${invoiceFileName}`);
        const invoiceUrl = `invoices/${invoiceFileName}`;

        //  <p><strong>Due Date:</strong> ${moment().add(2, 'days').format('MMMM DD, YYYY')}</p>

        // 🧾 Generate HTML invoice
        const invoiceHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Receipt</title></head>
        <body style="font-family: 'Poppins', sans-serif; background: #f4f6f9; margin: 0; padding: 20px;">
        <div style="background: #fff; max-width: 800px; margin: auto; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); color: #333;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div><img src="${logoBase64}" style="max-width: 150px;"></div>
                <div style="text-align: right;">
                    <h1 style="margin: 0; color: #019F88;">Receipt</h1>
                    <p>#${invoiceId}</p>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
                <div style="width: 48%;">
                    <h4 style="color: #555;">Receipt To:</h4>
                    <p><strong>${company_users.company_name || 'Company Name'}</strong></p>
                    <p>${company_users.email || 'Email Not Available'}</p>
                </div>
                <div style="width: 48%; text-align: right;">
                    <h4 style="color: #555;">Receipt Details:</h4>
                    <p><strong>Receipt Date:</strong> ${moment().format('MMMM DD, YYYY')}</p>
                   
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
                <thead>
                    <tr>
                        <th style="border: 1px solid #ddd; padding: 12px; background-color: #14AE5C; color: #fff;">Description</th>
                        <th style="border: 1px solid #ddd; padding: 12px; background-color: #14AE5C; color: #fff;">Payment Method</th>
                        <th style="border: 1px solid #ddd; padding: 12px; background-color: #14AE5C; color: #fff;">Transaction ID</th>
                        <th style="border: 1px solid #ddd; padding: 12px; background-color: #14AE5C; color: #fff;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 12px;">Wallet Fund Top-up</td>
                        <td style="border: 1px solid #ddd; padding: 12px;">Online Payment</td>
                        <td style="border: 1px solid #ddd; padding: 12px;">${transactionId}</td>
                        <td style="border: 1px solid #ddd; padding: 12px;">₹ ${baseAmount}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 30px; text-align: right;">
                <table style="width: 300px; float: right;">
                    <tr><td style="padding: 10px;">Subtotal:</td><td style="padding: 10px;">₹ ${baseAmount}</td></tr>
                    <tr><td style="padding: 10px;">CGST (9%):</td><td style="padding: 10px;">₹ ${halfGST}</td></tr>
                    <tr><td style="padding: 10px;">SGST (9%):</td><td style="padding: 10px;">₹ ${halfGST}</td></tr>
                    <tr><td style="padding: 10px; background: #14AE5C; color: #fff; font-weight: bold;">Total Paid:</td><td style="padding: 10px; background: #14AE5C; color: #fff; font-weight: bold;">₹ ${totalAmount.toFixed(2)}</td></tr>
                </table>
                <div style="clear: both;"></div>
                    <div style="margin-top: 30px; text-align: center; font-size: 13px; color: #999;">
                        This is a computer-generated receipt and does not require a physical signature.
                    </div>
            </div>

            <div style="clear: both;"></div>
            <div style="margin-top: 60px; text-align: center; font-size: 13px; color: #999;">
                Thank you for using our service! <br>
                For support: <strong>support@adz10x.com</strong>
            </div>
        </div>
        </body></html>
        `;

        // Generate PDF from HTML using Puppeteer
       // const browser = await puppeteer.launch();
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
        const page = await browser.newPage();
        await page.setContent(invoiceHtml, { waitUntil: 'networkidle0' });
        await page.pdf({ path: invoicePath, format: 'A4', printBackground: true });
        await browser.close();

        const add_wallet = await Wallet.create({
            company_id: comapnyId,
            company_user_id: comapnyUserId,
            wallet_type,
            amount: baseAmount,
            total_amount: totalAmount,
            gst_percentage: gstPercentage,
            gst_amount: gstAmount,
            balance: previousBalance.toFixed(2),
            description,
            invoice_id: invoiceId,
            transaction_id: transactionId,
            invoice_url_path: invoiceUrl,
            razorpay_order_id,
            razorpay_payment_id,
            created_ip_address: req.ip,
            created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
            created_type: userType
        });

        await Company_Registration.update(
            { wallet_amount: newBalance.toFixed(2) },
            { where: { id: user.id } }
        );

        const formattedDate = moment(add_wallet.createdAt).format('DD-MM-YYYY');

        return res.status(200).json({
            status: 200,
            message: "Fund added successfully",
            data: {
                wallet_type: add_wallet.wallet_type,
                transaction_id: add_wallet.transaction_id,
                balance: add_wallet.balance,
                amount: add_wallet.amount,
                gst_amount: add_wallet.gst_amount,
                description: add_wallet.description,
                invoice_id: add_wallet.invoice_id,
                invoice_url_path: add_wallet.invoice_url_path,
                razorpay_order_id,
                razorpay_payment_id,
                date: formattedDate,
                created_ip_address: add_wallet.created_ip_address,
                created_by: add_wallet.created_by,
                created_type: add_wallet.created_type
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
    }
};