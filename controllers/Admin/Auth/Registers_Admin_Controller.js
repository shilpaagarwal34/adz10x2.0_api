const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const moment = require('moment-timezone');
const AWS = require('aws-sdk');
const { Op, fn, col } = require('sequelize');
// Configure AWS SES
// const ses = new AWS.SES();

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

// Configure AWS SES

// const ses = new AWS.SES({ apiVersion: '2010-12-01' });

// AWS.config.update({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// })

exports.registerAdmin = async (req, res) => {
  try {
    const {
      user_type,
      user_name,
      email,
      password,
      mobile_no,
      role_id,
      address
    } = req.body;

    // Check if user already exists
    const existingUser = await Master_Admin.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Admin already exists with this email.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin
    const newAdmin = await Master_Admin.create({
      user_type,
      user_name,
      email,
      password: hashedPassword,
      mobile_no,
      role_id,
      address
    });

    return res.status(201).json({
      message: 'Admin registered successfully.',
      data: {
        id: newAdmin.id,
        user_name: newAdmin.user_name,
        email: newAdmin.email
      }
    });
  } catch (error) {
    console.error('Error registering admin:', error);
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

exports.login = async (req,res) => {
    try{
      const { email , password } = req.body;

    // Find user but ignore deleted
        const user = await Master_Admin.findOne({
            where: {
                email,
                status: { [Op.ne]: 'delete' } // not equal to delete
            }
        });

        if (!user) {
            return res.status(400).json({
                status: 400,
                message: "Admin not found with this email."
            });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 401,
                message: "Invalid password."
            });
        }

        // If inactive
        if (user.status === "inactive") {
            return res.status(403).json({
                status: 403,
                message: "User is inactive. Please contact support."
            });
        }

    // Generate JWT token
            const token = jwt.sign(
                { email: user.email, id: user.id,role_name: user.role_name, }, 
                process.env.JWT_SECRET, 
                { expiresIn: '1d' }
            );

          await user.update({ access_token:token })

           // Update login_date_time for login user
            await user.update({
                login_date_time: moment().utc().format('YYYY-MM-DD HH:mm:ss')
                // login_date_time: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')
            });

          return res.status(200).json(
            { status:200, 
              message: "Login successful.",
              data:{
                id: user.id,
                user_name: user.user_name,
                email: user.email,
                admin_token: token,
                privileges: user.privileges,
                role_name: user.role_name
              }
            });

    }catch(error){
      return res.status(500).json({ status:500, error: error.message });
    }

};

exports.logoutAdmin = async (req, res) => {
    try {
        // const { user_id } = req.body;

        const userId = req.user.id; 

         const user = await Master_Admin.findByPk(userId);

        if (!user) {
            return res.status(404).json({ status: 404, message: 'User not found' });
        }

        await user.update({
            logout_date_time: moment().utc().format('YYYY-MM-DD HH:mm:ss')
            // logout_date_time: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
        });

        return res.status(200).json({
            status: 200,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error("Logout Error:", error);
        return res.status(500).json({
            status: 500,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

exports.forgotAdminPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find admin
    const admin = await Master_Admin.findOne({ where: { email } });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found with this email." });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // Save hashed token & expiry
    admin.reset_token = hashedToken;
    admin.reset_token_expiry = Date.now() + (15 * 60 * 1000); // 15 mins
    await admin.save();

    // Email setup
    const baseUrl = process.env.BASE_URL;
    const logoUrls = `${baseUrl}/assets/adz10x-logo.png`;

    const reactBaseUrl = process.env.REACT_APP_URL;
    const resetLink = `${reactBaseUrl}/admin/reset-password?token=${resetToken}`;

    const emailParams = {
      Source: process.env.AWS_SES_EMAIL,
      Destination: {
        ToAddresses: [admin.email]
      },
      Message: {
        Subject: {
          Data: "Password Reset Request"
        },
        Body: {
          Html: {
            Data: `
              <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                <div style="background:#cce0ff; padding:20px; text-align:center;">
                  <img src="${logoUrls}" alt="ADZ10X Logo" style="height:60px;">
                </div>
                <div style="background:#fff; padding:30px; text-align:left;">
                  <h2 style="color:#000;">Password Reset Request</h2>
                  <p>Hi ${admin.user_name || "Admin"},</p>
                  <p>We received a request to reset your password. Please click the link below to set a new password:</p>
                  <p style="text-align:center;">
                    <a href="${resetLink}" style="display:inline-block; background:#007bff; color:#fff; padding:10px 20px; border-radius:5px; text-decoration:none;">
                      Reset Password
                    </a>
                  </p>
                  <p>This link will expire in 15 minutes.</p>
                  <p>If you did not request this, please ignore this email.</p>
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

    // Send email via AWS SES
      // await ses.sendEmail(emailParams).promise();
    const result = await ses.sendEmail(emailParams).promise();
    console.log("SES Send Result:", result);

    return res.status(200).json({
      message: "Password reset link sent to your email.",
      email
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token) {
      return res.status(400).json({ status: 400, message: "Token is required" });
    }

    if (!new_password) {
      return res.status(400).json({ status: 400, message: "New password is required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ status: 400, message: "New password must be at least 6 characters long" });
    }

    if (/\s/.test(new_password)) {
      return res.status(400).json({ status: 400, message: "New password should not contain spaces" });
    }

    if (!confirm_password) {
      return res.status(400).json({ status: 400, message: "Confirm password is required" });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ status: 400, message: "Passwords do not match" });
    }

    // 🔹 Hash token before checking DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await Master_Admin.findOne({
      where: {
        reset_token: hashedToken,
        reset_token_expiry: { [Op.gt]: Date.now() } // token not expired
      }
    });

    if (!user) {
      return res.status(404).json({ status: 404, message: "Invalid or expired token" });
    }

    const isSame = await bcrypt.compare(new_password, user.password);
    if (isSame) {
      return res.status(400).json({ status: 400, message: "New password must be different from the old password" });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    user.password = hashedPassword;
    user.reset_token = null; // clear reset token
    user.reset_token_expiry = null;
    await user.save();

    return res.status(200).json({ status: 200, message: "Password updated successfully" });

  } catch (error) {
    console.error("Change Admin Password Error:", error);
    return res.status(500).json({ status: 500, message: "Internal server error", error: error.message });
  }
};