const AWS = require("aws-sdk");
const fs = require("fs");
const path = require("path");
//const bcrypt = require('bcrypt');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const City = require("@models/Admin/Master/City_Model");
const Area = require("@models/Admin/Master/Area_Model");
const Sector = require("@models/Admin/Master/Sector_Model");
const Society_Registration = require("@models/Society/Auth/Society_Registration_Model");
const Company_Registration = require("@models/Company/Auth/Company_Registration_Model");
const Master_Admin = require("@models/Admin/Auth/Master_Admin_Model");
const Society_User = require("@models/Society/Users/Society_User_Model");
const Company_User = require("@models/Company/Users/Company_User_Model");
const Campaign_Configuration = require("@models/Admin/Master/Campaign_Configuration_Model");
const General_Setting = require("@models/Admin/Settings/General_Model");
const Visual_Setting = require("@models/Admin/Settings/Visual_Model");

const Wallet = require("@models/Company/Wallet/Wallet_Model");
const Campaign = require("@models/Company/Campaign/Campaign_Model");
const Campaign_Log = require("@models/Company/Campaign/Campaign_Log_Model");
const Advertisements = require("@models/Society/Advertisement/Advertisement_Model");
const Society_Wallet_Payment = require("@models/Society/Payments/Society_Wallet_Model");
const Ads_Slot = require("@models/Society/Auth/Society_Ads_Slot_Model");
const Notification = require("@models/Notifications/Notification_Model");
const Company_Profile = require("@models/Company/Auth/Company_Profile_Model");
const Society_Withdraw_Payments = require("@models/Society/Payments/Withdraw_Model");
const Payment_Order = require("@models/Company/Wallet/Payment_Order_Model");
const Society_Profile = require("@models/Society/Auth/Society_Profile_Model");
const {
  MEDIA_TYPES,
  getMediaPlatformConfig,
} = require("@helper/mediaRateHelper");
// Configure AWS SES

const ses = new AWS.SES({ apiVersion: "2010-12-01" });

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const { softDeleteRecord, toggleStatus } = require("../../helper/deleteHelper");
const { where, Op } = require("sequelize");

exports.commonDelete = async (req, res) => {
  const { table, id } = req.body;

  // Validate input
  if (!table || !id) {
    return res
      .status(400)
      .json({ status: false, message: "Table and ID are required." });
  }

  const result = await softDeleteRecord(table, id);

  return res.status(result.success ? 200 : 400).json({
    status: result.success,
    message: result.message,
  });
};

exports.commonStatus = async (req, res) => {
  const { table, id } = req.body;

  if (!table || !id) {
    return res
      .status(400)
      .json({ status: false, message: "Table and ID are required." });
  }

  const result = await toggleStatus(table, id);

  return res.status(result.success ? 200 : 400).json({
    status: result.success,
    user_status: result.user_status || null,
    message: result.message,
  });
};

exports.truncateAllTables = async (req, res) => {
  try {
    await City.truncate({ cascade: true });
    await Area.truncate({ cascade: true });
    await Sector.truncate({ cascade: true });
    await Society_Registration.truncate({ cascade: true });
    await Company_Registration.truncate({ cascade: true });
    await Master_Admin.truncate({ cascade: true });
    await Society_User.truncate({ cascade: true });
    await Campaign_Configuration.truncate({ cascade: true });
    await General_Setting.truncate({ cascade: true });
    await Visual_Setting.truncate({ cascade: true });

    await Wallet.truncate({ cascade: true });
    await Campaign.truncate({ cascade: true });
    await Campaign_Log.truncate({ cascade: true });
    await Advertisements.truncate({ cascade: true });
    await Society_Wallet_Payment.truncate({ cascade: true });
    await Ads_Slot.truncate({ cascade: true });
    await Notification.truncate({ cascade: true });
    await Company_Profile.truncate({ cascade: true });
    await Society_Withdraw_Payments.truncate({ cascade: true });
    await Payment_Order.truncate({ cascade: true });
    await Society_Profile.truncate({ cascade: true });
    await Company_User.truncate({ cascade: true });

    return res.status(200).json({
      status: 200,
      message: "All tables truncated successfully.",
    });
  } catch (error) {
    console.error("Truncate Error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.truncateAllTablesWithIds = async (req, res) => {
  try {
    await City.truncate({ restartIdentity: true, cascade: true });
    await Area.truncate({ restartIdentity: true, cascade: true });
    await Sector.truncate({ restartIdentity: true, cascade: true });
    await Society_Registration.truncate({
      restartIdentity: true,
      cascade: true,
    });
    await Company_Registration.truncate({
      restartIdentity: true,
      cascade: true,
    });
    await Master_Admin.truncate({ restartIdentity: true, cascade: true });
    await Society_User.truncate({ restartIdentity: true, cascade: true });
    await Campaign_Configuration.truncate({
      restartIdentity: true,
      cascade: true,
    });
    await General_Setting.truncate({ restartIdentity: true, cascade: true });
    await Visual_Setting.truncate({ restartIdentity: true, cascade: true });

    await Wallet.truncate({ restartIdentity: true, cascade: true });
    await Campaign.truncate({ restartIdentity: true, cascade: true });
    await Campaign_Log.truncate({ restartIdentity: true, cascade: true });
    await Advertisements.truncate({ restartIdentity: true, cascade: true });
    await Society_Wallet_Payment.truncate({
      restartIdentity: true,
      cascade: true,
    });
    await Ads_Slot.truncate({ restartIdentity: true, cascade: true });
    await Notification.truncate({ restartIdentity: true, cascade: true });
    await Company_Profile.truncate({ restartIdentity: true, cascade: true });
    await Society_Withdraw_Payments.truncate({
      restartIdentity: true,
      cascade: true,
    });
    await Payment_Order.truncate({ restartIdentity: true, cascade: true });
    await Society_Profile.truncate({ restartIdentity: true, cascade: true });
    await Company_User.truncate({ restartIdentity: true, cascade: true });

    return res.status(200).json({
      status: 200,
      message: "All tables truncated successfully with IDs reset.",
    });
  } catch (error) {
    console.error("Truncate Error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.getAllCitys = async (req, res) => {
  try {
    const cities = await City.findAll({
      attributes: ["id", "city_name"],
      where: { status: "active" },
      order: [["city_name", "ASC"]],
    });

    res.status(200).json({
      status: 200,
      message: "success",
      data: cities,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllAreas = async (req, res) => {
  try {
    const area = await Area.findAll({
      attributes: ["id", "city_id", "area_name"],
      order: [["area_name", "ASC"]],
      where: { status: "active" },
    });

    res.status(200).json({
      status: 200,
      message: "success",
      data: area,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAreasByCity = async (req, res) => {
  try {
    const { city_id } = req.params; // Get city_id from route params
    // Fetch areas for the given city_id
    const areas = await Area.findAll({
      where: { city_id },
      order: [["area_name", "ASC"]],
      attributes: ["id", "city_id", "area_name"],
    });

    res.status(200).json({
      status: 200,
      message: "success",
      data: areas,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllCompanys = async (req, res) => {
  try {
    const company = await Company_Registration.findAll({
      attributes: ["id", "company_name"],
      where: { status: "active" },
      order: [["company_name", "ASC"]],
    });

    res.status(200).json({
      status: 200,
      message: "success",
      data: company,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSociety = async (req, res) => {
  try {
    const societies = await Society_Registration.findAll({
      attributes: ["id", "society_name"],
      where: { status: "active" },
      order: [["society_name", "ASC"]],
    });
    res.status(200).json({
      status: 200,
      message: "success",
      data: societies,
    });
  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

exports.getAllCampaignDays = async (req, res) => {
  try {
    const campaign_days = await Campaign_Configuration.findOne({
      attributes: [
        "id",
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat",
        "sun",
        "platform_rules",
      ],
      where: { status: "active" },
      order: [["createdAt", "ASC"]],
    });

    if (!campaign_days) {
      return res
        .status(404)
        .json({ status: 404, message: "Campaign days not found" });
    }

    const daysMap = [
      { key: "mon", label: "Monday" },
      { key: "tue", label: "Tuesday" },
      { key: "wed", label: "Wednesday" },
      { key: "thu", label: "Thursday" },
      { key: "fri", label: "Friday" },
      { key: "sat", label: "Saturday" },
      { key: "sun", label: "Sunday" },
    ];

    // Safe time formatting to "hh:mm AM/PM"
    const formatTime = (timeStr) => {
      if (!timeStr) return "--"; // or null based on your preference

      const [hour, minute] = timeStr.split(":");
      const date = new Date();
      date.setHours(hour);
      date.setMinutes(minute);
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    };

    const fromFormatted = formatTime(campaign_days.from_time);
    const toFormatted = formatTime(campaign_days.to_time);

    const responseData = daysMap.map((day) => ({
      day: day.label,
      // from_time: fromFormatted,
      // to_time: toFormatted,
      is_checked: !!campaign_days[day.key],
    }));

    const configuredRules = campaign_days?.platform_rules || {};
    const mediaPlatforms = MEDIA_TYPES.map((mediaType) => {
      const defaults = getMediaPlatformConfig(mediaType);
      const configured = configuredRules?.[mediaType] || {};
      return {
        media_type: mediaType,
        label: defaults.label || mediaType,
        min_lead_days: Number(
          configured.min_lead_days ?? defaults.min_lead_days ?? 0,
        ),
        min_active_days: Number(
          configured.min_active_days ??
            defaults.min_active_days ??
            defaults.duration_days ??
            0,
        ),
      };
    });

    return res.status(200).json({
      status: 200,
      message: "Campaign days fetched successfully",
      data: responseData,
      media_platforms: mediaPlatforms,
    });
  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

// front function start

exports.getSecotrs = async (req, res) => {
  try {
    const sectors = await Sector.findAll({
      where: {
        status: "active",
      },
      order: [["sector_name", "ASC"]],
    });
    return res.status(200).json({
      status: 200,
      message: "Sectors fetched successfully",
      data: sectors,
    });
  } catch (err) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

// front function end

exports.checkEmailMobile = async (req, res) => {
  try {
    const { email, mobile_number } = req.body;

    let emailExists = null;
    let mobileExists = null;
    let errors = {}; // Object to store errors

    // Check if email already exists
    if (email) {
      emailExists = await Society_Registration.findOne({
        // where: { email: email }
        where: {
          email: email,
          status: { [Op.ne]: "delete" }, // not equal to deleted
        },
      });

      if (emailExists) {
        errors.email = "Email already exists";
      }
    }

    // Check if mobile number already exists
    if (mobile_number) {
      mobileExists = await Society_Registration.findOne({
        where: {
          mobile_number: mobile_number,
          status: { [Op.ne]: "delete" },
        },
      });

      if (mobileExists) {
        errors.mobile_number = "Mobile Number already exists";
      }
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors: errors,
      });
    }

    // If both email and mobile number do not exist
    return res.status(200).json({
      status: 200,
      message: "Success",
    });
  } catch (err) {
    res.status(500).json({ status: 500, error: err.message });
  }
};

exports.checkMobile = async (req, res) => {
  try {
    const { mobile_number } = req.query;

    if (!mobile_number) {
      return res.status(400).json({
        status: 400,
        message: "Mobile number is required",
      });
    }

    let errors = {}; // Object to store errors

    // Check if mobile number exists in Society_Registration
    const societyExists = await Society_Registration.findOne({
      where: {
        mobile_number: mobile_number,
        status: { [Op.ne]: "delete" },
      },
    });

    // Check if mobile number exists in Company_Registration
    const companyExists = await Company_Registration.findOne({
      where: {
        mobile_number: mobile_number,
        status: { [Op.ne]: "delete" },
      },
    });

    if (societyExists || companyExists) {
      errors.mobile_number = "Mobile Number already exists";
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors: errors,
      });
    }

    // If mobile number does not exist in both models
    return res.status(200).json({
      status: 200,
      message: "Success",
    });
  } catch (err) {
    res.status(500).json({ status: 500, error: err.message });
  }
};

exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.query; // ✅ Use req.query for GET requests

    if (!email) {
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors: { email: "Email is required" },
      });
    }

    let errors = {}; // Object to store errors

    // const societyExists = await Society_Registration.findOne({ where: { email: email, status: { [Op.ne]: "delete" } } });

    // const companyExists = await Company_Registration.findOne({ where: { email: email, status: { [Op.ne]: "delete" } } });

    const societyExists = await Society_Registration.findOne({
      where: { email: email, status: { [Op.ne]: "delete" } },
    });

    const companyExists = await Company_Registration.findOne({
      where: { email: email, status: { [Op.ne]: "delete" } },
    });

    if (societyExists || companyExists) {
      errors.email = "Email already exists";
    }

    // If there are errors, return them
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        status: 400,
        message: "Validation failed",
        errors: errors,
      });
    }

    // If email does not exist in both models
    return res.status(200).json({
      status: 200,
      message: "Success",
    });
  } catch (err) {
    return res.status(500).json({
      status: 500,
      error: err.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = null;
    let userType = null;
    let profileImageKey = null;
    let modelType = null;

    // Helper function to validate user
    const validateUser = async (model, emailField, profileKey, typeName) => {
      const tempUser = await model.findOne({
        where: {
          email,
          status: { [Op.ne]: "delete" }, // block deleted
        },
      });

      if (!tempUser) return null;

      const isPasswordValid = await bcrypt.compare(password, tempUser.password);
      if (!isPasswordValid) {
        throw new Error("INVALID_PASSWORD");
      }

      if (tempUser.status === "inactive") {
        throw new Error("USER_INACTIVE");
      }

      return { tempUser, typeName, profileKey, model };
    };

    // 1. Society_Registration
    if (!user) {
      try {
        const result = await validateUser(
          Society_Registration,
          email,
          "society_profile_img_path",
          "Society_Admin",
        );
        if (result)
          ({
            tempUser: user,
            typeName: userType,
            profileKey: profileImageKey,
            model: modelType,
          } = result);
      } catch (err) {
        if (err.message === "INVALID_PASSWORD")
          return res
            .status(401)
            .json({ status: 401, message: "Invalid password" });
        if (err.message === "USER_INACTIVE")
          return res.status(403).json({
            status: 403,
            message: "User is inactive. Please contact support.",
          });
      }
    }

    // 2. Company_Registration
    if (!user) {
      try {
        const result = await validateUser(
          Company_Registration,
          email,
          "company_profile_photo_path",
          "Company_Admin",
        );
        if (result)
          ({
            tempUser: user,
            typeName: userType,
            profileKey: profileImageKey,
            model: modelType,
          } = result);
      } catch (err) {
        if (err.message === "INVALID_PASSWORD")
          return res
            .status(401)
            .json({ status: 401, message: "Invalid password" });
        if (err.message === "USER_INACTIVE")
          return res.status(403).json({
            status: 403,
            message: "User is inactive. Please contact support.",
          });
      }
    }

    // 3. Society_User
    if (!user) {
      try {
        const result = await validateUser(
          Society_User,
          email,
          "society_profile_img_path",
          "Society_User",
        );
        if (result)
          ({
            tempUser: user,
            typeName: userType,
            profileKey: profileImageKey,
            model: modelType,
          } = result);
      } catch (err) {
        if (err.message === "INVALID_PASSWORD")
          return res
            .status(401)
            .json({ status: 401, message: "Invalid password" });
        if (err.message === "USER_INACTIVE")
          return res.status(403).json({
            status: 403,
            message: "User is inactive. Please contact support.",
          });
      }
    }

    // 4. Company_User
    if (!user) {
      try {
        const result = await validateUser(
          Company_User,
          email,
          "company_profile_img_path",
          "Company_User",
        );
        if (result)
          ({
            tempUser: user,
            typeName: userType,
            profileKey: profileImageKey,
            model: modelType,
          } = result);
      } catch (err) {
        if (err.message === "INVALID_PASSWORD")
          return res
            .status(401)
            .json({ status: 401, message: "Invalid password" });
        if (err.message === "USER_INACTIVE")
          return res.status(403).json({
            status: 403,
            message: "User is inactive. Please contact support.",
          });
      }
    }

    if (!user) {
      return res
        .status(400)
        .json({ status: 400, message: "User not found with this email." });
    }

    let parentKycStatus = user.kyc_status || null;

    // Company_User → Check parent company
    if (userType === "Company_User") {
      const company = await Company_Registration.findOne({
        where: { id: user.company_id },
      });

      if (company) parentKycStatus = company.kyc_status;

      if (
        !company ||
        company.status !== "active" ||
        company.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: !company
            ? "Parent company not found."
            : company.status !== "active"
              ? "Your company account is inactive. Please contact admin."
              : "Your company KYC is rejected.",
          id: user.id,
          is_logged_in: false,
        });
      }
    }

    // Society_User → Check parent society
    if (userType === "Society_User") {
      const society = await Society_Registration.findOne({
        where: { id: user.society_id },
      });

      if (society) parentKycStatus = society.kyc_status;

      if (
        !society ||
        society.status !== "active" ||
        society.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: !society
            ? "Parent society not found."
            : society.status !== "active"
              ? "Your society account is inactive. Please contact admin."
              : "Your society KYC is rejected.",
          id: user.id,
          is_logged_in: false,
        });
      }
    }

    // ❗ Block login if user's own KYC is rejected
    if (user.kyc_status === "rejected") {
      return res.status(403).json({
        status: 403,
        message: "Your account is rejected",
        is_logged_in: false,
      });
    }

    // OTP logic for Admins only
    if (
      modelType === Society_Registration ||
      modelType === Company_Registration
    ) {
      if (user.is_otp_verified === "0") {
        let otp,
          isOtpUnique = false;

        while (!isOtpUnique) {
          otp = Math.floor(100000 + Math.random() * 900000);
          const existingOtp = await modelType.findOne({ where: { otp } });
          if (!existingOtp) isOtpUnique = true;
        }

        await user.update({ otp });

        try {
          const baseUrl = process.env.BASE_URL;
          const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

          const emailParams = {
            Source: process.env.AWS_SES_EMAIL,
            Destination: {
              ToAddresses: [user.email],
            },
            Message: {
              Subject: {
                Data: "Verify Your ADZ10X Signup",
              },
              Body: {
                Html: {
                  Data: `
                                    <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                                            <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                                        </div>
                                        <div style="background:#fff; padding:30px; text-align:left;">
                                            <h2 style="color:#000;">Verify Your ADZ10X Account</h2>
                                            <p>Hi ${user.name},</p>
                                            <p>Your OTP for verifying your ADZ10X account is <strong>[${otp}]</strong>. This OTP is valid for the next 10 minutes.</p>
                                            <p>If you didn’t initiate this, please ignore this message.</p>
                                        </div>
                                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                                            <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                                        </div>
                                    </div>
                                    `,
                },
              },
            },
          };

          const response = await ses.sendEmail(emailParams).promise();
          console.log("OTP verification email sent successfully:", response);
        } catch (mailErr) {
          console.log("OTP email sending failed:", mailErr.message);
        }

        return res.status(403).json({
          status: 403,
          message: "OTP not verified. A new OTP has been sent to your email.",
          userType,
          is_otp_verified: user.is_otp_verified,
          token: user.token,
          id: user.id,
          otp: "",
        });
      }
    }

    // ✅ Generate token
    const token = jwt.sign(
      { email: user.email, id: user.id, userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // ✅ Save token to DB
    await user.update({ token });

    // ✅ Update login_date_time for Society_User & Company_User
    if (
      userType === "Society_User" ||
      userType === "Company_User" ||
      userType === "Company_Admin" ||
      userType === "Society_Admin"
    ) {
      await user.update({
        login_date_time: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    // ✅ Build Menu
    let menu = {
      dashboard: true,
      profile: true,
      settings: true,
      logout: true,
    };

    if (userType === "Company_Admin" || userType === "Society_Admin") {
      menu.advertisement = true;
      menu.payments = true;
      menu.users = true;
      menu.report = true;
      menu.wallet = true;
      menu.report = true;

      if (user.kyc_status !== "approved") {
        menu = {
          dashboard: true,
          profile: true,
          settings: true,
          logout: true,
        };
      }
    }

    return res.status(200).json({
      status: 200,
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name || user.user_name,
        society_comany_name: user.society_name || user.company_name,
        society_address: user.address || null,
        email: user.email,
        mobile_number: user.mobile_number,
        user_type: userType,
        privileges: user.privileges || [],
        [profileImageKey]: user[profileImageKey],
        is_otp_verified: "1",
        is_show_first_screen: "1",
        account_status: user.account_status || null,
        kyc_status: parentKycStatus,
        token: token,
        menu: menu,
        ...(userType === "Society_User" && { role_name: user.role_name }),
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const { user_id, user_type } = req.body;

    let model = null;
    if (user_type === "Society_User") {
      model = Society_User;
    } else if (user_type === "Company_User") {
      model = Company_User;
    } else if (user_type === "Society_Admin") {
      model = Society_Registration;
    } else if (user_type === "Company_Admin") {
      model = Company_Registration;
    }

    if (!model) {
      return res
        .status(400)
        .json({ status: 400, message: "Invalid User Type" });
    }

    const user = await model.findOne({ where: { id: user_id } });

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

    await user.update({
      logout_date_time: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
    });

    return res.status(200).json({
      status: 200,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout Error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email } = req.body;

    let user = null;
    let userType = null;
    let profileImageKey = null;
    let modelType = null;

    // 1. Check Society_Registration
    user = await Society_Registration.findOne({
      where: { email, status: "active" },
    });
    if (user) {
      userType = "Society_Admin";
      profileImageKey = "society_profile_img_path";
      modelType = Society_Registration;
    }

    // 2. If not found, check Company_Registration
    if (!user) {
      user = await Company_Registration.findOne({
        where: { email, status: "active" },
      });
      if (user) {
        userType = "Company_Admin";
        profileImageKey = "company_profile_photo_path";
        modelType = Company_Registration;
      }
    }

    // 3. If not found, check Society_User
    if (!user) {
      user = await Society_User.findOne({ where: { email, status: "active" } });
      if (user) {
        userType = "Society_User";
        profileImageKey = "society_profile_img_path";
        modelType = Society_User;
      }
    }

    // 4. If not found, check Company_User
    if (!user) {
      user = await Company_User.findOne({ where: { email, status: "active" } });
      if (user) {
        userType = "Company_User";
        profileImageKey = "company_profile_img_path";
        modelType = Company_User;
      }
    }

    // If still not found
    if (!user) {
      //  res.status(404).json({ status: 404, message: "User not found" });
      return res.status(403).json({
        status: 403,
        message: "Your account is not active. Please contact admin.",
        is_logged_in: false, // ➕ send flag to frontend
      });
    }

    let parentKycStatus = user.kyc_status || null;

    // ✅ Parent KYC check for Company_User
    if (userType === "Company_User") {
      const company = await Company_Registration.findOne({
        where: { id: user.company_id },
      });

      if (company) {
        parentKycStatus = company.kyc_status;
      }

      if (
        !company ||
        company.status !== "active" ||
        company.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: !company
            ? "Parent company not found."
            : company.status !== "active"
              ? "Your company account is inactive. Please contact admin."
              : "Your company KYC is rejected.",
          id: user.id,
          is_logged_in: false,
        });
      }
    }

    // ✅ Parent KYC check for Society_User
    if (userType === "Society_User") {
      const society = await Society_Registration.findOne({
        where: { id: user.society_id },
      });

      if (society) {
        parentKycStatus = society.kyc_status;
      }

      if (
        !society ||
        society.status !== "active" ||
        society.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: !society
            ? "Parent society not found."
            : society.status !== "active"
              ? "Your society account is inactive. Please contact admin."
              : "Your society KYC is rejected.",
          id: user.id,
          is_logged_in: false,
        });
      }
    }

    // ❗ Block login if KYC is rejected
    if (user.kyc_status === "rejected") {
      return res.status(403).json({
        status: 403,
        // message: user.remark || " Your account is rejected",
        message: "Your account is rejected",
        is_logged_in: false,
      });
    }

    let menu = {
      dashboard: true,
      profile: true,
      settings: true,
      logout: true,
    };

    if (userType === "Company_Admin" || userType === "Society_Admin") {
      menu.advertisement = true;
      menu.payments = true;
      menu.users = true;
      menu.report = true;
      menu.wallet = true;
      if (userType === "Company_Admin") {
        menu.wallet = true;
      }
      if (user.kyc_status !== "approved") {
        menu = {
          dashboard: true,
          profile: true,
          settings: true,
          logout: true,
        };
      }
    }

    return res.status(200).json({
      status: 200,
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name || user.user_name,
        society_comany_name: user.society_name || user.company_name,
        society_address: user.address || null,
        email: user.email,
        mobile_number: user.mobile_number,
        user_type: userType,
        privileges: user.privileges || [],
        [profileImageKey]: user[profileImageKey],
        is_otp_verified: "1",
        is_show_first_screen: "1",
        account_status: user.account_status || null,
        // kyc_status: user.kyc_status || null,
        kyc_status: parentKycStatus, // ✅ Use parent value
        // token: token,
        menu: menu,
        ...(userType === "Society_User" && { role_name: user.role_name }),
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ status: 400, message: "Email is required" });
    }

    // Check if the user exists in Society_Registration or Company_Registration
    let user = await Society_Registration.findOne({
      where: { email, status: "active" },
    });
    let modelType = "society";

    if (!user) {
      user = await Company_Registration.findOne({
        where: { email, status: "active" },
      });
      modelType = "company";
    }

    // If still not found, search in Society_User
    if (!user) {
      user = await Society_User.findOne({ where: { email, status: "active" } });
      modelType = "society_user";
    }

    // If still not found, search in Company_User
    if (!user) {
      user = await Company_User.findOne({ where: { email, status: "active" } });
      modelType = "company_user";
    }

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Save OTP in the database
    await user.update({ otp });

    // // Send OTP via email using AWS SES
    try {
      const baseUrl = process.env.BASE_URL;
      const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

      const emailParams = {
        Source: process.env.AWS_SES_EMAIL,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: "Verify Your ADZ10X Signup",
          },
          Body: {
            Html: {
              Data: `
                    <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                            <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                        </div>
                        <div style="background:#fff; padding:30px; text-align:left;">
                            <h2 style="color:#000;">Verify Your ADZ10X Account</h2>
                            <p>Hi ${user.name},</p>
                            <p>Your OTP for verifying your ADZ10X account is <strong>[${otp}]</strong>. This OTP is valid for the next 10 minutes.</p>
                            <p>If you didn’t initiate this, please ignore this message.</p>
                        </div>
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                            <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                        </div>
                    </div>
                    `,
            },
          },
        },
      };

      const response = await ses.sendEmail(emailParams).promise();
      console.log("OTP verification email sent successfully:", response);
    } catch (mailErr) {
      console.log("OTP email sending failed:", mailErr.message);
    }

    return res.status(200).json({
      user_type: user.user_type,
      // id:user.id,
      status: 200,
      message: "OTP sent to your email",
      email: email,
      otp: "",
      token: user.token,
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Internal Server Error" });
  }
};

exports.sendContactEnquiryMail = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        status: 400,
        message: "All fields are required",
      });
    }

    const baseUrl = process.env.BASE_URL;
    const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

    const emailParams = {
      Source: process.env.AWS_SES_EMAIL,
      Destination: {
        ToAddresses: [process.env.CONTACT_RECEIVER_EMAIL], // admin email
      },
      Message: {
        Subject: {
          Data: "Contact / Enquiry Form Submission - Website",
        },
        Body: {
          Html: {
            Data: `
                        <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                            <div style="background:#cce0ff; padding:20px; text-align:center;">
                                <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                            </div>

                            <div style="background:#fff; padding:30px;">
                                <h2>New Contact / Enquiry</h2>

                                <p><strong>Name:</strong> ${name}</p>
                                <p><strong>Email:</strong> ${email}</p>
                                <p><strong>Subject:</strong> ${subject}</p>

                                <hr>

                                <p><strong>Message:</strong></p>
                                <p style="white-space:pre-line;">${message}</p>
                            </div>

                            <div style="background:#cce0ff; padding:15px; text-align:center;">
                                <a href="https://www.adz10x.com">www.adz10x.com</a>
                            </div>
                        </div>
                        `,
          },
        },
      },
    };

    await ses.sendEmail(emailParams).promise();

    return res.status(200).json({
      status: 200,
      message: "Enquiry sent successfully",
    });
  } catch (error) {
    console.error("Contact enquiry mail error:", error);
    return res.status(500).json({
      status: 500,
      message: "Failed to send enquiry",
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ status: 400, message: "Token is required" });
    }

    if (!new_password) {
      return res
        .status(400)
        .json({ status: 400, message: "New password is required" });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        status: 400,
        message: "New password must be at least 6 characters long",
      });
    }

    if (/\s/.test(new_password)) {
      return res.status(400).json({
        status: 400,
        message: "New password should not contain spaces",
      });
    }

    if (!confirm_password) {
      return res
        .status(400)
        .json({ status: 400, message: "Confirm password is required" });
    }

    if (new_password !== confirm_password) {
      return res
        .status(400)
        .json({ status: 400, message: "Passwords do not match" });
    }

    // Check in Society_Registration
    user = await Society_Registration.findOne({
      where: { token, status: "active" },
    });
    modelName = "Society_Registration";

    // If not found, check in Company_Registration
    if (!user) {
      user = await Company_Registration.findOne({
        where: { token, status: "active" },
      });
      modelName = "Company_Registration";
    }

    // If not found, check in Society_User
    if (!user) {
      user = await Society_User.findOne({ where: { token, status: "active" } });
      modelName = "Society_User";
    }

    // If not found, check in Company_User
    if (!user) {
      user = await Company_User.findOne({ where: { token, status: "active" } });
      modelName = "Company_User";
    }

    // If no active user with the token is found
    if (!user) {
      return res.status(404).json({ status: 404, message: "Token not found." });
    }

    const isSame = await bcrypt.compare(new_password, user.password);
    if (isSame) {
      return res.status(400).json({
        status: 400,
        message: "New password must be different from the old password",
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      status: 200,
      // message: `Password updated successfully for user in ${modelName}`
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { token, otp } = req.body;
    // 🔥 BYPASS TOKEN + OTP CHECK FOR LOCAL
    // if (!token || !otp) {
    //     return res.status(400).json({ status: 400, message: "OTP token and OTP are required" });
    // }

    // Detect user and model
    let user = await Society_Registration.findOne({
      where: { token, status: "active" },
    });
    let modelType = "society";
    let userType = "Society_Admin";

    if (!user) {
      user = await Company_Registration.findOne({
        where: { token, status: "active" },
      });
      modelType = "company";
      userType = "Company_Admin";
    }

    if (!user) {
      return res
        .status(400)
        .json({ status: 400, message: "Invalid OTP token" });
    }

    // Check OTP
    if (process.env.SKIP_OTP !== "true") {
      if (!user.otp || parseInt(user.otp) !== parseInt(otp)) {
        return res.status(400).json({ status: 400, message: "Incorrect OTP" });
      }
    }

    // if (process.env.NODE_ENV !== "development") {
    //   if (parseInt(user.otp) !== parseInt(otp)) {
    //     return res.status(400).json({ status: 400, message: "Incorrect OTP" });
    //   }
    // }

    // Update OTP verified status
    const modelToUpdate =
      modelType === "society" ? Society_Registration : Company_Registration;
    await modelToUpdate.update({ is_otp_verified: 1 }, { where: { token } });

    // Build response data
    const profileImageKey =
      modelType === "society"
        ? "society_profile_img_path"
        : "company_profile_photo_path";

    let menu = {
      dashboard: true,
      profile: true,
      settings: true,
      logout: true,
    };

    if (userType === "Company_Admin" || userType === "Society_Admin") {
      menu = {
        ...menu,
        advertisement: true,
        payments: true,
        users: true,
        report: true,
        wallet: true,
      };

      if (user.kyc_status !== "approved") {
        menu = {
          dashboard: true,
          profile: true,
          settings: true,
          logout: true,
        };
      }
    }

    const responseData = {
      name: user.name,
      email: user.email,
      mobile_number: user.mobile_number,
      society_comany_name: user.society_name || user.company_name,
      society_address: user.address || null,
      user_type: user.user_type,
      [profileImageKey]: user[profileImageKey],
      is_otp_verified: 1,
      is_show_first_screen: 1,
      account_status: user.account_status,
      kyc_status: user.kyc_status,
      token: token,
      menu: menu,
    };

    // --- Send Welcome Email (Try-Catch Block only for email) ---
    try {
      const baseUrl = process.env.BASE_URL;
      const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

      const welcomeSubject =
        modelType === "society"
          ? "Welcome to ADZ10X – Start Earning from Your Community!"
          : "Welcome to ADZ10X – Launch Your Hyperlocal Campaigns!";

      // Extract the part before '@' from the email
      const emailPrefix = user.email.split("@")[0];

      // Get the last 4 digits of the mobile number
      const mobileSuffix = user.mobile_number.slice(-4);

      // Form the password
      const password = `${emailPrefix}@${mobileSuffix}`;

      const welcomeBody =
        modelType === "society"
          ? `<p>Dear ${user.society_name},</p>
                   <p>Thank you for signing up with ADZ10X!</p>
                   <p>Your account credentials as follows</p>
                   <p>User Name : ${user.email}</p>
                   <p>Password : ${password}</p>
                   <p>To activate your dashboard and begin earning from campaigns, please complete the KYC procedure.</p>
                   <p>For any assistance, write to <a href="mailto:support@adz10x.com">support@adz10x.com</a> or connect with your assigned Relationship Manager.</p>
                   <p>Let’s unlock new income opportunities for your society!</p>`
          : `<p>Dear ${user.company_name},</p>
                   <p>Your account credentials as follows</p>
                   <p>User Name : ${user.email}</p>
                   <p>Password : ${password}</p>
                   <p>Welcome to ADZ10X! Your journey to reaching verified communities begins here.</p>
                   <p>To activate your dashboard and start creating campaigns, please complete the KYC procedure.</p>
                   <p>Need help? Reach out to <a href="mailto:support@adz10x.com">support@adz10x.com</a> or connect with your Relationship Manager.</p>
                   <p>Let’s grow your brand, one community at a time!</p>`;

      const emailParams = {
        Source: process.env.AWS_SES_EMAIL,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: welcomeSubject,
          },
          Body: {
            Html: {
              Data: `
                            <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                                <div style="background:#cce0ff; padding:20px; text-align:center;">
                                    <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                                </div>
                                <div style="background:#fff; padding:30px; text-align:left;">
                                    ${welcomeBody}
                                </div>
                                <div style="background:#cce0ff; padding:20px; text-align:center;">
                                    <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                                </div>
                            </div>
                            `,
            },
          },
        },
      };

      // await ses.sendEmail(emailParams).promise();
      const response = await ses.sendEmail(emailParams).promise();
      console.log("Welcome dashboard Email sent successfully:", response);
    } catch (mailErr) {
      console.log("Email sending failed:", mailErr.message);
      // Optionally log or alert this failure, but don't block the main success response
    }

    // --- WhatsApp onboarding message (separate try/catch) ---
    try {
      const axios = require("axios");

      let mobile_number = user.mobile_number;

      // Ensure it’s only digits (remove spaces, dashes, etc.)
      mobile_number = mobile_number.replace(/\D/g, "");

      // Add country code if not already present
      if (!mobile_number.startsWith("91")) {
        mobile_number = "91" + mobile_number;
      }
      const displayName =
        modelType === "society" ? user.society_name : user.company_name;

      const whatsappPayload = {
        apiKey: process.env.AISENSY_API_KEY, // store key in .env, not hardcoded
        campaignName:
          modelType === "society"
            ? "Society_Onboarding_Msg"
            : "Company_Onboarding_Msg",
        destination: mobile_number, // ensure it’s in correct format like '91XXXXXXXXXX'
        userName: "ADz10x.com",
        templateParams: [displayName],
        source: "new-landing-page form",
        media: {},
        buttons: [],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: {
          FirstName: "user",
        },
      };

      await axios.post(
        "https://backend.aisensy.com/campaign/t1/api/v2",
        whatsappPayload,
        { headers: { "Content-Type": "application/json" } },
      );

      console.log(`WhatsApp onboarding message sent to ${mobile_number}`);
    } catch (waErr) {
      console.error(
        "Failed to send WhatsApp onboarding message:",
        waErr.message,
      );
    }

    // ✅ Main response
    return res.status(200).json({
      status: 200,
      message: "OTP verified successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error in OTP verification:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ status: 400, message: "Token is required" });
    }

    // Try finding user in Society_Registration
    let user = await Society_Registration.findOne({
      where: { token, status: "active" },
    });
    let modelType = "society";

    // If not found, check Company_Registration
    if (!user) {
      user = await Company_Registration.findOne({
        where: { token, status: "active" },
      });
      modelType = "company";
    }

    if (!user) {
      return res.status(400).json({ status: 400, message: "Invalid token" });
    }

    // Generate a unique 6-digit OTP
    let otp;
    let isOtpUnique = false;

    const modelToCheck =
      modelType === "society" ? Society_Registration : Company_Registration;

    while (!isOtpUnique) {
      otp = Math.floor(100000 + Math.random() * 900000);
      const existingOtp = await modelToCheck.findOne({ where: { otp } });
      if (!existingOtp) {
        isOtpUnique = true;
      }
    }

    // Update OTP in DB
    await modelToCheck.update({ otp }, { where: { token } });

    try {
      const baseUrl = process.env.BASE_URL;
      const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

      const emailParams = {
        Source: process.env.AWS_SES_EMAIL,
        Destination: {
          ToAddresses: [user.email],
        },
        Message: {
          Subject: {
            Data: "Verify Your ADZ10X Signup",
          },
          Body: {
            Html: {
              Data: `
                    <div style="max-width:600px; margin:0 auto; font-family:sans-serif; background:#f2f2f2; padding:20px;">
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                            <img src="${logoUrl}" alt="ADZ10X Logo" style="height:60px;">
                        </div>
                        <div style="background:#fff; padding:30px; text-align:left;">
                            <h2 style="color:#000;">Verify Your ADZ10X Account</h2>
                            <p>Hi ${user.name},</p>
                            <p>Your OTP for verifying your ADZ10X account is <strong>[${otp}]</strong>. This OTP is valid for the next 10 minutes.</p>
                            <p>If you didn’t initiate this, please ignore this message.</p>
                        </div>
                        <div style="background:#cce0ff; padding:20px; text-align:center;">
                            <a href="https://www.adz10x.com" style="color:#0000ee; text-decoration:none;">www.adz10x.com</a>
                        </div>
                    </div>
                    `,
            },
          },
        },
      };

      const response = await ses.sendEmail(emailParams).promise();
      console.log("OTP verification email sent successfully:", response);
    } catch (mailErr) {
      console.log("OTP email sending failed:", mailErr.message);
    }
    // --- WhatsApp sending in its own try/catch ---
    try {
      const axios = require("axios");
      const mobile_number = user.mobile_number;
      const whatsappData = JSON.stringify({
        apiKey: process.env.AISENSY_API_KEY, // Replace with your real API key
        campaignName: "registration_otp",
        destination: mobile_number, // Use dynamic mobile number from req.body
        // destination: `91${user.mobile_number}`,
        userName: "ADz10x.com",
        templateParams: [otp.toString()],
        source: "new-landing-page form",
        media: {},
        buttons: [
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              {
                type: "text",
                text: otp.toString(),
              },
            ],
          },
        ],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: {
          FirstName: "user",
        },
      });

      const whatsappConfig = {
        method: "post",
        maxBodyLength: Infinity,
        url: "https://backend.aisensy.com/campaign/t1/api/v2",
        headers: {
          "Content-Type": "application/json",
        },
        data: whatsappData,
      };

      // Fire and forget, but wrapped in try/catch for logging
      axios
        .request(whatsappConfig)
        .then((res) => console.log("WhatsApp OTP sent successfully:", res.data))
        .catch((err) =>
          console.error("Failed to send WhatsApp OTP:", err.message),
        );
    } catch (waError) {
      console.error(
        "Unexpected error while triggering WhatsApp OTP:",
        waError.message,
      );
    }

    return res.status(200).json({
      status: 200,
      message: "OTP resent successfully",
      data: {
        otp: "",
        email: user.email,
        name: user.name,
        user_type: user.user_type,
      },
    });
  } catch (error) {
    console.error("Error in resending OTP:", error);
    return res
      .status(500)
      .json({ status: 500, message: "Internal Server Error" });
  }
};

// In-memory store for login OTP: mobile (10 digits) -> { otp, expiresAt }
const loginOtpStore = new Map();
const LOGIN_OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const normalizeMobile = (mobile) =>
  String(mobile || "")
    .replace(/\D/g, "")
    .slice(-10);

const findUserByMobile = async (mobile) => {
  const m = normalizeMobile(mobile);
  if (m.length !== 10) return null;
  let user = await Society_Registration.findOne({
    where: { mobile_number: m, status: { [Op.ne]: "delete" } },
  });
  let userType = "Society_Admin";
  let profileKey = "society_profile_img_path";
  let modelType = Society_Registration;
  if (!user) {
    user = await Company_Registration.findOne({
      where: { mobile_number: m, status: { [Op.ne]: "delete" } },
    });
    userType = "Company_Admin";
    profileKey = "company_profile_photo_path";
    modelType = Company_Registration;
  }
  if (!user) {
    user = await Society_User.findOne({
      where: { mobile_number: m, status: { [Op.ne]: "delete" } },
    });
    userType = "Society_User";
    profileKey = "society_profile_img_path";
    modelType = Society_User;
  }
  if (!user) {
    user = await Company_User.findOne({
      where: { mobile_number: m, status: { [Op.ne]: "delete" } },
    });
    userType = "Company_User";
    profileKey = "company_profile_img_path";
    modelType = Company_User;
  }
  if (!user) return null;
  return { user, userType, profileKey, modelType };
};

exports.sendLoginOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    const m = normalizeMobile(mobile);
    if (m.length !== 10) {
      return res.status(400).json({
        status: 400,
        message: "Valid 10-digit mobile number is required.",
      });
    }
    const found = await findUserByMobile(m);
    if (!found) {
      return res.status(400).json({
        status: 400,
        message: "No account found with this mobile number.",
      });
    }
    const { user } = found;
    if (user.status === "inactive") {
      return res.status(403).json({
        status: 403,
        message: "User is inactive. Please contact support.",
      });
    }
    let otp;
    let isOtpUnique = false;
    while (!isOtpUnique) {
      otp = Math.floor(100000 + Math.random() * 900000);
      const existing = Array.from(loginOtpStore.entries()).find(
        ([, v]) => v.otp === otp,
      );
      if (!existing) isOtpUnique = true;
    }
    const expiresAt = Date.now() + LOGIN_OTP_TTL_MS;
    loginOtpStore.set(m, { otp, expiresAt });

    const apiKey = process.env.AISENSY_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      console.warn(
        "[sendLoginOtp] AISENSY_API_KEY not set. OTP for mobile",
        m,
        "is",
        otp,
        "(use for testing only).",
      );
      return res.status(503).json({
        status: 503,
        message:
          "OTP service is not configured. Please use Email & Password to log in or contact support.",
      });
    }

    let mobileForWa = m;
    if (!mobileForWa.startsWith("91")) mobileForWa = "91" + mobileForWa;
    try {
      const axios = require("axios");
      const whatsappData = JSON.stringify({
        apiKey,
        campaignName: "registration_otp",
        destination: mobileForWa,
        userName: "ADz10x.com",
        templateParams: [otp.toString()],
        source: "login-otp",
        media: {},
        buttons: [
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [{ type: "text", text: otp.toString() }],
          },
        ],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: { FirstName: "user" },
      });
      await axios.request({
        method: "post",
        maxBodyLength: Infinity,
        url: "https://backend.aisensy.com/campaign/t1/api/v2",
        headers: { "Content-Type": "application/json" },
        data: whatsappData,
      });
    } catch (waErr) {
      const msg =
        waErr.response?.data?.message ||
        waErr.response?.data?.error ||
        waErr.message;
      console.error(
        "Failed to send WhatsApp login OTP:",
        msg,
        "| For mobile",
        m,
        "OTP was",
        otp,
      );
      return res.status(500).json({
        status: 500,
        message:
          msg && msg.length < 120
            ? `Failed to send OTP: ${msg}`
            : "Failed to send OTP. Please try again.",
      });
    }
    return res
      .status(200)
      .json({ status: 200, message: "OTP sent successfully to your mobile." });
  } catch (error) {
    console.error("Error in sendLoginOtp:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.verifyLoginOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    const m = normalizeMobile(mobile);
    const otpStr = String(otp || "")
      .replace(/\D/g, "")
      .trim();
    if (m.length !== 10 || otpStr.length !== 6) {
      return res.status(400).json({
        status: 400,
        message: "Mobile number and 6-digit OTP are required.",
      });
    }
    const stored = loginOtpStore.get(m);
    if (!stored) {
      return res.status(400).json({
        status: 400,
        message: "OTP expired or invalid. Please request a new OTP.",
      });
    }
    if (Date.now() > stored.expiresAt) {
      loginOtpStore.delete(m);
      return res.status(400).json({
        status: 400,
        message: "OTP expired. Please request a new OTP.",
      });
    }
    if (stored.otp !== parseInt(otpStr, 10)) {
      return res.status(401).json({ status: 401, message: "Invalid OTP." });
    }
    loginOtpStore.delete(m);

    const found = await findUserByMobile(m);
    if (!found) {
      return res
        .status(400)
        .json({ status: 400, message: "Account not found." });
    }
    const { user, userType, profileKey } = found;

    if (user.status === "inactive") {
      return res.status(403).json({
        status: 403,
        message: "User is inactive. Please contact support.",
      });
    }
    if (user.kyc_status === "rejected") {
      return res.status(403).json({
        status: 403,
        message: "Your account is rejected.",
        is_logged_in: false,
      });
    }

    let parentKycStatus = user.kyc_status || null;
    if (userType === "Company_User") {
      const company = await Company_Registration.findOne({
        where: { id: user.company_id },
      });
      if (company) parentKycStatus = company.kyc_status;
      if (
        !company ||
        company.status !== "active" ||
        company.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: "Company account is inactive or KYC rejected.",
          is_logged_in: false,
        });
      }
    }
    if (userType === "Society_User") {
      const society = await Society_Registration.findOne({
        where: { id: user.society_id },
      });
      if (society) parentKycStatus = society.kyc_status;
      if (
        !society ||
        society.status !== "active" ||
        society.kyc_status === "rejected"
      ) {
        return res.status(403).json({
          status: 403,
          message: "Society account is inactive or KYC rejected.",
          is_logged_in: false,
        });
      }
    }

    const token = jwt.sign(
      { email: user.email, id: user.id, userType },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );
    await user.update({ token });
    if (
      [
        "Society_User",
        "Company_User",
        "Company_Admin",
        "Society_Admin",
      ].includes(userType)
    ) {
      await user.update({
        login_date_time: moment().utc().format("YYYY-MM-DD HH:mm:ss"),
      });
    }

    let menu = { dashboard: true, profile: true, settings: true, logout: true };
    if (userType === "Company_Admin" || userType === "Society_Admin") {
      menu.advertisement = true;
      menu.payments = true;
      menu.users = true;
      menu.report = true;
      menu.wallet = true;
      if (user.kyc_status !== "approved")
        menu = { dashboard: true, profile: true, settings: true, logout: true };
    }

    return res.status(200).json({
      status: 200,
      message: "Login successful",
      data: {
        id: user.id,
        name: user.name || user.user_name,
        society_comany_name: user.society_name || user.company_name,
        society_address: user.address || null,
        email: user.email,
        mobile_number: user.mobile_number,
        user_type: userType,
        privileges: user.privileges || [],
        [profileKey]: user[profileKey],
        is_otp_verified: "1",
        is_show_first_screen: "1",
        account_status: user.account_status || null,
        kyc_status: parentKycStatus,
        token: token,
        menu: menu,
        ...(userType === "Society_User" && { role_name: user.role_name }),
      },
    });
  } catch (error) {
    console.error("Error in verifyLoginOtp:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.relationManagerID = async (req, res) => {
  try {
    const rel_manager = await Master_Admin.findAll({
      attributes: ["id", "user_name", "role_name"],
      where: {
        status: {
          [Op.in]: ["active"],
        },
        role_name: "RELATIONSHIP MANAGER",
      },
    });

    if (!rel_manager) {
      return res.status(404).json({
        status: 404,
        message: "Relationship managers not found",
      });
    }
    return res.status(200).json({
      status: 200,
      data: rel_manager,
      message: "Users fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};
