const Campaign = require("@models/Company/Campaign/Campaign_Model");
const Campaign_Log = require("@models/Company/Campaign/Campaign_Log_Model");
const Society_Registration = require("@models/Society/Auth/Society_Registration_Model");
const Society_Profile = require("@models/Society/Auth/Society_Profile_Model");
const Campaign_Configuration = require("@models/Admin/Master/Campaign_Configuration_Model");
const Company_Registration = require("@models/Company/Auth/Company_Registration_Model");
const Company_User = require("@models/Company/Users/Company_User_Model");
const Advertisements = require("@models/Society/Advertisement/Advertisement_Model");
const Society_Media_Rate_Card = require("@models/Society/Advertisement/Society_Media_Rate_Card_Model");
const Master_Admin = require("@models/Admin/Auth/Master_Admin_Model");
const City = require("@models/Admin/Master/City_Model");
const Area = require("@models/Admin/Master/Area_Model");
const Notification = require("@models/Notifications/Notification_Model");
const Payment_Order = require("@models/Company/Wallet/Payment_Order_Model");
const path = require("path");
const { where, literal, Sequelize } = require("sequelize");
const { Op, fn, col } = require("sequelize");
const moment = require("moment-timezone");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const sequelize = require("@config/db");
const {
  MEDIA_TYPES,
  normalizeMediaType,
  isValidMediaType,
  calculateRateBreakup,
  getMediaPlatformConfig,
  isDateAllowedByAvailability,
} = require("@helper/mediaRateHelper");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const MEDIA_TYPE_LABELS = {
  lift_branding_panels: "In-Lift Advertising",
  notice_board_sponsorship: "Notice Board Advertising",
  gate_entry_exit_branding: "Main Gate Branding",
  society_kiosk: "Kiosk",
  whatsapp_promotional_day: "WhatsApp Group Promotion",
  event_sponsorship: "Society Event Sponsorship",
};

const resolveRequestedSocietyIds = (body = {}) => {
  const ids = new Set();
  const rawArrays = [
    body.society_ids,
    body.society_ind_ids,
    body["society_ids[]"],
    body["society_ind_ids[]"],
  ];
  rawArrays.forEach((arr) => {
    if (Array.isArray(arr)) {
      arr.forEach((id) => {
        const num = Number(id);
        if (!Number.isNaN(num) && num > 0) ids.add(num);
      });
    } else if (arr !== undefined && arr !== null) {
      const num = Number(arr);
      if (!Number.isNaN(num) && num > 0) ids.add(num);
    }
  });

  Object.keys(body).forEach((key) => {
    const textMatch = key.match(/^societies_text\[(\d+)\]$/);
    const imageMatch = key.match(/^upload_societies_images_path\[(\d+)\]$/);
    const match = textMatch || imageMatch;
    if (match) {
      const num = Number(match[1]);
      if (!Number.isNaN(num) && num > 0) ids.add(num);
    }
  });

  return Array.from(ids);
};

const WEEKDAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const buildAvailabilityPreview = (card = null) => {
  if (!card) return null;
  const weeklyDays = Array.isArray(card.availability_days)
    ? card.availability_days
        .map((day) => WEEKDAY_LABELS[day] || day)
        .filter(Boolean)
    : [];
  const monthlyDays = Array.isArray(card.availability_month_days)
    ? card.availability_month_days
    : [];

  return {
    effective_from: card.effective_from || null,
    effective_to: card.effective_to || null,
    availability_days: Array.isArray(card.availability_days)
      ? card.availability_days
      : [],
    availability_days_label: weeklyDays,
    availability_month_days: monthlyDays,
  };
};

const getActiveRateCardForDate = async (societyId, mediaType, date) => {
  const result = await getRateCardAvailabilityForDate(
    societyId,
    mediaType,
    date,
  );
  return result.card;
};

const getRateCardAvailabilityForDate = async (societyId, mediaType, date) => {
  const normalized = normalizeMediaType(mediaType);
  if (!normalized || !isValidMediaType(normalized)) {
    return {
      card: null,
      reason_code: "invalid_media_type",
      reason_message: "Invalid media slot selected",
    };
  }

  const targetDate = date || moment().format("YYYY-MM-DD");
  const cards = await Society_Media_Rate_Card.findAll({
    where: {
      society_id: societyId,
      media_type: normalized,
      status: "active",
    },
    order: [
      ["effective_from", "DESC"],
      ["id", "DESC"],
    ],
  });

  if (!cards.length) {
    return {
      card: null,
      display_card: null,
      reason_code: "platform_not_offered",
      reason_message: "Selected media slot is not offered by this society",
      availability_preview: null,
    };
  }

  const cardsInEffectiveRange = cards.filter((card) => {
    const fromDate = card?.effective_from
      ? moment(card.effective_from).format("YYYY-MM-DD")
      : null;
    const toDate = card?.effective_to
      ? moment(card.effective_to).format("YYYY-MM-DD")
      : null;
    return (
      (!fromDate || fromDate <= targetDate) && (!toDate || toDate >= targetDate)
    );
  });

  if (!cardsInEffectiveRange.length) {
    return {
      card: null,
      display_card: cards[0],
      reason_code: "outside_date_range",
      reason_message:
        "Selected date is outside the society's available from/to date range",
      availability_preview: buildAvailabilityPreview(cards[0]),
    };
  }

  const matchedCard = cardsInEffectiveRange.find((card) =>
    isDateAllowedByAvailability(
      targetDate,
      card.availability_days,
      card.availability_month_days,
    ),
  );

  if (!matchedCard) {
    return {
      card: null,
      display_card: cardsInEffectiveRange[0],
      reason_code: "unavailable_weekday_or_monthday",
      reason_message:
        "Selected date is not available in the society weekly/monthly schedule",
      availability_preview: buildAvailabilityPreview(cardsInEffectiveRange[0]),
    };
  }

  return {
    card: matchedCard,
    display_card: matchedCard,
    reason_code: null,
    reason_message: null,
    availability_preview: buildAvailabilityPreview(matchedCard),
  };
};

const getPlatformRulesFromConfig = (campaignConfig = null) => {
  const configuredRules = campaignConfig?.platform_rules || {};
  const mergedRules = {};

  MEDIA_TYPES.forEach((mediaType) => {
    const defaults = getMediaPlatformConfig(mediaType);
    const configured = configuredRules?.[mediaType] || {};
    mergedRules[mediaType] = {
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

  return mergedRules;
};

const fetchEffectivePlatformRules = async () => {
  try {
    const campaignConfig = await Campaign_Configuration.findOne({
      where: { status: "active" },
      order: [["createdAt", "ASC"]],
    });
    return getPlatformRulesFromConfig(campaignConfig);
  } catch {
    // If campaign_configuration table/columns are missing, return defaults
    return getPlatformRulesFromConfig(null);
  }
};

const findConflictingBookings = async ({
  selectedSocietyIds = [],
  mediaType,
  campaignDate,
  excludeCampaignId = null,
}) => {
  if (!selectedSocietyIds.length || !mediaType || !campaignDate) return [];

  const conflictWhere = {
    society_id: { [Op.in]: selectedSocietyIds },
    media_type: mediaType,
    status: "active",
    campaign_status: { [Op.notIn]: ["cancelled", "reject"] },
  };

  if (excludeCampaignId) {
    conflictWhere.campaign_id = { [Op.ne]: Number(excludeCampaignId) };
  }

  const campaigns = await Campaign.findAll({
    where: {
      status: "active",
      campaign_status: { [Op.notIn]: ["cancelled", "reject"] },
      [Op.and]: [where(fn("DATE", col("campaign_date")), campaignDate)],
    },
    attributes: ["id", "id_prifix_campaign"],
    raw: true,
  });

  const campaignIds = campaigns.map((c) => c.id);
  if (!campaignIds.length) return [];

  conflictWhere.campaign_id = excludeCampaignId
    ? {
        [Op.in]: campaignIds.filter(
          (id) => Number(id) !== Number(excludeCampaignId),
        ),
      }
    : { [Op.in]: campaignIds };

  const conflicts = await Campaign_Log.findAll({
    where: conflictWhere,
    attributes: ["campaign_id", "society_id"],
    raw: true,
  });

  const campaignRefById = campaigns.reduce((acc, item) => {
    acc[item.id] = item.id_prifix_campaign || item.id;
    return acc;
  }, {});

  return conflicts.map((item) => ({
    campaign_id: item.campaign_id,
    campaign_ref: campaignRefById[item.campaign_id] || item.campaign_id,
    society_id: item.society_id,
  }));
};

const resolveCompanyContext = async (req) => {
  const userId = req.user.id;
  const userType = req.user_type;
  let comapnyId = null;
  let comapnyUserId = null;

  if (userType === "Company_Admin") {
    const user = await Company_Registration.findOne({ where: { id: userId } });
    comapnyId = user?.id || null;
  }

  if (userType === "Company_User") {
    const companyUser = await Company_User.findOne({ where: { id: userId } });
    comapnyId = companyUser?.company_id || null;
    comapnyUserId = companyUser?.id || null;
  }

  return { userType, comapnyId, comapnyUserId };
};

const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");
  return expectedSignature === razorpay_signature;
};

const ensureCampaignPaymentColumns = async () => {
  await sequelize.query(
    `ALTER TABLE "company_campaigns" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(10) DEFAULT 'unpaid'`,
  );
  await sequelize.query(
    `ALTER TABLE "company_campaigns" ADD COLUMN IF NOT EXISTS "payment_order_id" TEXT`,
  );
  await sequelize.query(
    `ALTER TABLE "company_campaigns" ADD COLUMN IF NOT EXISTS "payment_id" TEXT`,
  );
  await sequelize.query(
    `ALTER TABLE "company_campaigns" ADD COLUMN IF NOT EXISTS "payment_mode" VARCHAR(30)`,
  );
  await sequelize.query(
    `ALTER TABLE "company_campaigns" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP WITH TIME ZONE`,
  );
};

const persistCampaignPaymentMeta = async ({
  campaignId,
  paymentStatus = "unpaid",
  paymentMode = null,
  paymentOrderId = null,
  paymentId = null,
  paidAt = null,
}) => {
  await sequelize.query(
    `UPDATE "company_campaigns"
         SET "payment_status" = :paymentStatus,
             "payment_mode" = :paymentMode,
             "payment_order_id" = :paymentOrderId,
             "payment_id" = :paymentId,
             "paid_at" = :paidAt
         WHERE "id" = :campaignId`,
    {
      replacements: {
        campaignId,
        paymentStatus,
        paymentMode,
        paymentOrderId,
        paymentId,
        paidAt,
      },
    },
  );
};

exports.initiateCampaignPayment = async (req, res) => {
  try {
    const { comapnyId, comapnyUserId, userType } =
      await resolveCompanyContext(req);
    if (!comapnyId) {
      return res
        .status(400)
        .json({ status: 400, message: "Company not found" });
    }

    const requestedAmount = Number(
      req.body.amount ?? req.body.campaign_amount ?? 0,
    );
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return res
        .status(400)
        .json({ status: 400, message: "Valid amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(requestedAmount * 100),
      currency: "INR",
      receipt: `campaign_${Date.now()}`,
    });

    await Payment_Order.create({
      razorpay_order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      entity: order.entity,
      receipt: order.receipt,
      razorpay_order_status: order.status,
      amount_paid: order.amount_paid,
      amount_due: order.amount_due,
      offer_id: order.offer_id,
      attempts: order.attempts,
      created_at_razorpay: order.created_at,
      notes: {
        ...(order.notes || {}),
        purpose: "campaign_payment",
        company_id: comapnyId,
        company_user_id: comapnyUserId,
        payment_status: "unpaid",
        campaign_amount: requestedAmount,
      },
      created_ip_address: req.ip,
      created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
      created_type: userType,
    });

    return res.status(200).json({
      status: 200,
      message: "Campaign payment order created successfully",
      data: {
        order_id: order.id,
        amount: requestedAmount,
        amount_in_paise: order.amount,
        currency: order.currency,
      },
    });
  } catch (error) {
    console.error("[initiateCampaignPayment]", error);
    return res
      .status(500)
      .json({
        status: 500,
        message: "Failed to initiate campaign payment",
        error: error.message,
      });
  }
};

exports.getCompanySocietyMediaRateCards = async (req, res) => {
  try {
    const { society_id, media_type, campaign_date } = req.query;

    if (!society_id) {
      return res
        .status(400)
        .json({ status: 400, message: "society_id is required" });
    }

    const whereClause = {
      society_id: Number(society_id),
      status: "active",
    };

    if (media_type) {
      const normalized = normalizeMediaType(media_type);
      if (!isValidMediaType(normalized)) {
        return res
          .status(400)
          .json({ status: 400, message: "Invalid media_type" });
      }
      whereClause.media_type = normalized;
    }

    if (campaign_date) {
      whereClause[Op.and] = [
        { effective_from: { [Op.lte]: campaign_date } },
        {
          [Op.or]: [
            { effective_to: null },
            { effective_to: { [Op.gte]: campaign_date } },
          ],
        },
      ];
    }

    const cards = await Society_Media_Rate_Card.findAll({
      where: whereClause,
      order: [
        ["media_type", "ASC"],
        ["effective_from", "DESC"],
      ],
    });
    const filteredCards = campaign_date
      ? cards.filter((card) =>
          isDateAllowedByAvailability(
            campaign_date,
            card.availability_days,
            card.availability_month_days,
          ),
        )
      : cards;
    const platformRules = await fetchEffectivePlatformRules();

    return res.status(200).json({
      status: 200,
      message: "Company media rate cards fetched successfully",
      media_platforms: Object.values(platformRules),
      data: filteredCards,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Failed to fetch company media rate cards",
      error: error.message,
    });
  }
};

exports.viewCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 400,
        message: "Campaign ID is required",
      });
    }

    let whereClause = { id };

    if (req.user_type === "Company_Admin") {
      whereClause.company_id = req.user.id;
    } else if (req.user_type === "Company_User") {
      whereClause.company_id = req.user.company_id;
    }

    const campaigns = await Campaign.findOne({
      where: whereClause,
      attributes: {
        exclude: ["created_ip_address", "modified_ip_address"],
      },
    });

    if (!campaigns) {
      return res.status(404).json({
        status: 404,
        message: "Campaign not found",
      });
    }

    const campaign_logs = await Campaign_Log.findAll({
      where: { campaign_id: campaigns.id },
      attributes: {
        exclude: ["created_ip_address", "modified_ip_address"],
      },
    });

    let totalFlats = 0;

    for (const log of campaign_logs) {
      // Get society_profile
      const society_profile = await Society_Profile.findOne({
        where: { society_id: log.society_id, status: "active" },
        attributes: ["number_of_flat"],
      });

      const flatCount = society_profile
        ? parseInt(society_profile.number_of_flat, 10)
        : 0;
      totalFlats += flatCount;
      log.dataValues.number_of_flat = society_profile
        ? society_profile.number_of_flat
        : null;

      // Get society_registration details
      const society_details = await Society_Registration.findOne({
        where: { id: log.society_id },
        attributes: [
          "id",
          "society_name",
          "name",
          "society_profile_img_path",
          "society_profile_img_name",
          "address",
          "relationship_manager_id",
        ],
      });

      log.dataValues.society = society_details || null;
    }

    const city = campaigns.campaign_city_id
      ? await City.findOne({
          where: { id: campaigns.campaign_city_id },
          attributes: ["city_name"],
        })
      : null;

    const area = campaigns.campaign_area_id
      ? await Area.findOne({
          where: { id: campaigns.campaign_area_id },
          attributes: ["area_name"],
        })
      : null;

    const campaignDate = campaigns.campaign_date
      ? new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
          .format(new Date(campaigns.campaign_date))
          .replace(",", " -")
      : null;

    const formattedCreatedAt = campaigns.createdAt
      ? new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
          .format(new Date(campaigns.createdAt))
          .replace(",", " -")
      : null;

    let name = null;
    let company_name = null;
    let address_line_1 = null;
    let address_line_2 = null;

    if (campaigns.created_by) {
      if (campaigns.created_type === "Company_User") {
        const companyUser = await Company_User.findOne({
          where: { id: campaigns.created_by },
        });

        if (companyUser) {
          const company = await Company_Registration.findOne({
            where: { id: companyUser.company_id },
            attributes: [
              "name",
              "company_name",
              "address_line_1",
              "address_line_2",
            ],
          });

          if (company) {
            name = company.name;
            company_name = company.company_name;
            address_line_1 = company.address_line_1;
            address_line_2 = company.address_line_2;
          }
        }
      } else if (campaigns.created_type === "Company_Admin") {
        const company = await Company_Registration.findOne({
          where: { id: campaigns.created_by },
          attributes: [
            "name",
            "company_name",
            "address_line_1",
            "address_line_2",
          ],
        });

        if (company) {
          name = company.name;
          company_name = company.company_name;
          address_line_1 = company.address_line_1;
          address_line_2 = company.address_line_2;
        }
      }
    }

    const campaign = {
      ...campaigns.toJSON(),
      city_name: city ? city.city_name : null,
      area_name: area ? area.area_name : null,
      campaign_date: campaignDate,
      formatted_created_at: formattedCreatedAt,
    };

    for (const log of campaign_logs) {
      const formattedUpdatedAt = log.updatedAt
        ? moment(log.updatedAt).format("D MMM YYYY h:mma")
        : null;

      const formatted_approved_date = log.approved_date
        ? moment(log.approved_date).format("D MMM YYYY h:mma")
        : null;

      const formatted_admin_approved_date = log.approved_date_admin
        ? moment(campaign_logs.approved_date_admin).format("D MMM YYYY H:mma")
        : null;

      const formatted_society_approved_date = log.society_approved_date
        ? moment(campaign_logs.society_approved_date).format("D MMM YYYY H:mma")
        : null;

      const formatted_cancel_date = log.cancel_date
        ? moment(log.cancel_date).format("D MMM YYYY h:mma")
        : null;

      let approved_by = "";
      if (
        log.society_approved_status === null ||
        log.society_approved_status === "" ||
        log.society_approved_status === "pending"
      ) {
        if (log.admin_approved_status === "approved") {
          approved_by = "Admin";
        }
      } else if (
        log.admin_approved_status === "approved" &&
        log.society_approved_status === "approved"
      ) {
        approved_by = "Society";
      }

      let cancelled_by = "";
      if (log.admin_approved_status === "reject") {
        cancelled_by = "Admin";
      } else if (log.society_approved_status === "reject") {
        cancelled_by = "Society";
      }

      log.setDataValue("updatedAtFormatted", formattedUpdatedAt);
      log.setDataValue("approved_date", formatted_approved_date);
      log.setDataValue("admin_approved_date", formatted_admin_approved_date);
      log.setDataValue(
        "society_approved_date",
        formatted_society_approved_date,
      );
      log.setDataValue("cancel_date", formatted_cancel_date);
      // log.setDataValue('approved_by', approved_by);
      log.setDataValue("cancelled_by", cancelled_by);
      log.setDataValue(
        "cancel_reason",
        log.admin_cancel_reason || log.society_cancel_reason,
      );
    }

    return res.status(200).json({
      status: 200,
      message: "Campaign fetched successfully",
      data: {
        campaign,
        total_flats: totalFlats,
        company: {
          name,
          company_name,
          address_line_1,
          address_line_2,
        },
        campaign_logs,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.viewAdvertisement = async (req, res) => {
  try {
    const { id } = req.params; // Campaign log ID

    if (!id) {
      return res.status(400).json({
        status: 400,
        message: "Campaign log ID is required",
      });
    }

    // Fetch campaign with ownership check
    const campaign_logs = await Campaign_Log.findOne({
      where: { id: id, status: "active" }, // if applicable
      attributes: [
        "id",
        "campaign_id",
        "id_prifix_campaign_ads",
        "society_id",
        "company_id",
        "admin_cancel_reason",
        "society_cancel_reason",
        "campaign_ads_amount",
        "upload_societies_images_path",
        "upload_societies_images_name",
        "societies_text",
        "campaign_status",
        "society_approved_status",
        "admin_approved_status",
        "approved_by",
        "approved_date",
        "society_approved_date",
        "approved_date_admin",
        "slot_start_time",
        "slot_end_time",
        "live_start_date",
        "live_end_date",
        "modified_by",
        "modified_type",
        "updatedAt",
      ],
    });

    const campaign = await Campaign.findOne({
      where: { id: campaign_logs.campaign_id, status: "active" },
      attributes: [
        "id",
        "company_id",
        "id_prifix_campaign",
        "campaign_type",
        "campaign_date",
        "creative_type",
        "campaign_name",
        "campaign_status",
      ],
    });

    let formatted_campaign = null;

    if (campaign) {
      const campaignData = campaign.toJSON();

      const formattedDate = campaignData.campaign_date
        ? new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })
            .format(new Date(campaignData.campaign_date))
            .replace(",", " -")
        : null;

      const formattedcampaign_date = campaignData.campaign_date
        ? moment(campaignData.campaign_date).format("D MMM YYYY h:mma") // Output: 6 May 2025 1:10pm
        : null;

      formatted_campaign = {
        ...campaignData,
        campaign_date: formattedDate,
        formatted_campaign_date: formattedcampaign_date,
      };
    }

    if (!campaign_logs) {
      return res.status(404).json({
        status: 404,
        message: "campaign logs not found or access denied",
      });
    }

    // Fetch advertisement with ownership check
    const society = await Society_Registration.findOne({
      where: { id: campaign_logs.society_id }, // if applicable
      attributes: [
        "id",
        "society_name",
        "name",
        "society_profile_img_path",
        "society_profile_img_name",
        "address",
        "relationship_manager_id",
      ],
    });

    // Fetch advertisement with ownership check
    const society_profile = await Society_Profile.findOne({
      where: { society_id: society.id }, // if applicable
      attributes: ["number_of_flat"],
    });

    const company = await Company_Registration.findOne({
      where: { id: campaign_logs.company_id }, // if applicable
      attributes: [
        "id",
        "company_name",
        "name",
        "company_profile_photo_path",
        "company_profile_photo_name",
        "address_line_1",
        "address_line_2",
      ],
    });

    const rel_manager = await Master_Admin.findOne({
      where: { id: society.relationship_manager_id },
    });

    // const society_profile = await Society_Profile.findOne({
    //   where: { society_id: society.id, status: 'active' } // if applicable
    // });

    // Fetch advertisement with ownership check
    const advertisement = await Advertisements.findOne({
      where: { campaign_log_id: campaign_logs.id, status: "active" }, // if applicable
    });

    let modified_by_name = null;

    if (campaign_logs.modified_by && campaign_logs.modified_type) {
      if (campaign_logs.modified_type === "Admin") {
        const adminUser = await Master_Admin.findOne({
          where: { id: campaign_logs.modified_by },
        });
        if (adminUser) modified_by_name = adminUser.user_name;
      } else if (campaign_logs.modified_type === "Society_User") {
        const societyUsers = await Society_User.findOne({
          where: { id: campaign_logs.modified_by },
        });
        if (societyUsers) modified_by_name = societyUsers.user_name;
      } else if (campaign_logs.modified_type === "Society_Admin") {
        const societyUser = await Society_Registration.findOne({
          where: { id: campaign_logs.modified_by },
        });
        if (societyUser) modified_by_name = societyUser.name;
      }
    }

    const formattedUpdatedAt = campaign_logs.updatedAt
      ? moment(campaign_logs.updatedAt).format("D MMM YYYY h:mma") // Output: 6 May 2025 1:10pm
      : null;

    const formattedcampaign_date = campaign.campaign_date
      ? moment(campaign.campaign_date).format("D MMM YYYY h:mma") // Output: 6 May 2025 1:10pm
      : null;

    campaign_logs.setDataValue("updatedAtFormatted", formattedUpdatedAt);
    campaign_logs.setDataValue("modified_by_name", modified_by_name);
    campaign_logs.setDataValue(
      "cancel_reason",
      campaign_logs.admin_cancel_reason || campaign_logs.society_cancel_reason,
    );
    society.setDataValue("number_of_flat", society_profile.number_of_flat);

    // const formattedUpdatedAt = campaign_logs.updatedAt
    //     ? moment(campaign_logs.updatedAt).format('D MMM YYYY h:mma')
    //     : null;

    const formatted_approved_date = campaign_logs.approved_date
      ? moment(campaign_logs.approved_date).format("D MMM YYYY h:mma")
      : null;

    const formatted_admin_approved_date = campaign_logs.approved_date_admin
      ? moment(campaign_logs.approved_date_admin).format("D MMM YYYY h:mma")
      : null;

    const formatted_society_approved_date = campaign_logs.society_approved_date
      ? moment(campaign_logs.society_approved_date).format("D MMM YYYY h:mma")
      : null;

    const formatted_cancel_date = campaign_logs.cancel_date
      ? moment(campaign_logs.cancel_date).format("D MMM YYYY h:mma")
      : null;

    // Determine approved_by and cancelled_by
    let approved_by = "";
    if (
      campaign_logs.society_approved_status === null ||
      campaign_logs.society_approved_status === "" ||
      campaign_logs.society_approved_status === "pending"
    ) {
      if (campaign_logs.admin_approved_status === "approved") {
        approved_by = "Admin";
      }
    } else if (
      campaign_logs.admin_approved_status === "approved" &&
      campaign_logs.society_approved_status === "approved"
    ) {
      approved_by = "Society";
    }

    let cancelled_by = "";
    if (campaign_logs.admin_approved_status === "reject") {
      cancelled_by = "Admin";
    } else if (campaign_logs.society_approved_status === "reject") {
      cancelled_by = "Society";
    }

    //   campaign_logs.setDataValue('updatedAtFormatted', formattedUpdatedAt);
    campaign_logs.setDataValue("modified_by_name", modified_by_name);
    campaign_logs.setDataValue("approved_date", formatted_approved_date);
    campaign_logs.setDataValue(
      "admin_approved_date",
      formatted_admin_approved_date,
    );
    campaign_logs.setDataValue(
      "society_approved_date",
      formatted_society_approved_date,
    );
    campaign_logs.setDataValue("cancel_date", formatted_cancel_date);
    //   campaign_logs.setDataValue('approved_by', approved_by);
    campaign_logs.setDataValue("cancelled_by", cancelled_by);
    campaign_logs.setDataValue(
      "cancel_reason",
      campaign_logs.admin_cancel_reason || campaign_logs.society_cancel_reason,
    );

    return res.status(200).json({
      status: 200,
      message: "Campaign Log fetched successfully",
      data: {
        society,
        company,
        campaign: formatted_campaign,
        rel_managers: {
          name: rel_manager.user_name,
          designation: rel_manager.role_name,
          mobile_no: rel_manager.mobile_no,
        },
        //  society_profile,
        campaign_logs,
        advertisement,
      },
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.campaignDataTable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const campaign_status = req.query.campaign_status;
    const offset = (page - 1) * limit;

    const whereClause = {
      status: {
        [Op.in]: ["active", "inactive"],
      },
    };

    // ✅ Filter by company_id based on authenticated user
    if (req.user_type === "Company_Admin") {
      whereClause.company_id = req.user.id; // Company_Admin's ID is company_id
    } else if (req.user_type === "Company_User") {
      whereClause.company_id = req.user.company_id; // Company_User has company_id
    }

    // Search filter
    if (campaign_status) {
      whereClause.campaign_status = campaign_status;
    }

    if (search) {
      whereClause[Op.or] = [
        literal(`CAST("id" AS TEXT) ILIKE '%${search}%'`),
        { campaign_type: { [Op.iLike]: `%${search}%` } },
        { creative_type: { [Op.iLike]: `%${search}%` } },
        { campaign_name: { [Op.iLike]: `%${search}%` } },
        literal(`TO_CHAR("createdAt", 'YYYY-MM-DD') ILIKE '%${search}%'`),
      ];
    }

    const approvedCount = await Campaign.count({
      where: { ...whereClause, campaign_status: "approved" },
    });

    const pendingCount = await Campaign.count({
      where: { ...whereClause, campaign_status: "pending" },
    });

    const cancelledCount = await Campaign.count({
      where: { ...whereClause, campaign_status: "reject" },
    });

    const draftCount = await Campaign.count({
      where: { ...whereClause, campaign_status: "draft" },
    });

    const completedCount = await Campaign.count({
      where: { ...whereClause, campaign_status: "completed" },
    });

    const total = await Campaign.count({ where: whereClause });

    const campaign = await Campaign.findAll({
      where: whereClause,
      offset,
      limit,
      order: [["id", "DESC"]],
      attributes: [
        "id",
        "campaign_name",
        "company_id",
        "report_status",
        "creative_type",
        "campaign_type",
        "campaign_status",
        "createdAt",
        "status",
      ],
    });

    const formattedCampaigns = campaign.map((item) => {
      const createdAt = new Date(item.createdAt);
      const dayName = createdAt.toLocaleDateString("en-US", {
        weekday: "long",
      });
      const day = createdAt.getDate().toString().padStart(2, "0");
      const month = createdAt.toLocaleDateString("en-US", { month: "long" });
      const year = createdAt.getFullYear();

      return {
        ...item.toJSON(),
        createdAtFormatted: `${dayName} ${day}-${month} ${year}`,
      };
    });

    return res.status(200).json({
      status: 200,
      table_name: "company_campaigns",
      message: "Campaign fetched successfully",
      total,
      page,
      limit,
      draftCount,
      approvedCount,
      pendingCount,
      cancelledCount,
      completedCount,
      data: formattedCampaigns,
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Failed to fetch campaigns",
      error: err.message,
    });
  }
};

exports.getCampaignType = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user_type;
    let comapnyId = null;

    // Identify company ID from user type
    if (userType === "Company_Admin") {
      const user = await Company_Registration.findOne({
        where: { id: userId },
      });
      comapnyId = user.id;
    } else if (userType === "Company_User") {
      const companyUser = await Company_User.findOne({ where: { id: userId } });
      comapnyId = companyUser.company_id;
    }

    // Fetch company settings
    const companyData = await Company_Registration.findOne({
      where: { id: comapnyId },
      attributes: ["brand_promotion", "lead_generation", "survey"],
    });

    const { brand_promotion, lead_generation, survey } = companyData;

    let campaign;

    if (!companyData) {
      // Fetch campaign data since none of the fields are set
      campaign = await Campaign_Configuration.findOne({
        where: { status: "active" },
        order: [["id", "ASC"]],
        attributes: ["brand_promotion", "lead_generation", "survey"],
      });

      if (!campaign) {
        return res
          .status(404)
          .json({ status: 404, message: "Campaign not found" });
      }
    }

    return res.status(200).json({
      status: 200,
      message: "Campaign fetched successfully",
      data: campaign || companyData,
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({
        status: 500,
        message: "Internal server error",
        error: err.message,
      });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

exports.getSocietiesWithinRadius = async (req, res) => {
  try {
    const {
      city_id,
      area_id,
      campaign_city_id,
      campaign_area_id,
      my_ads_location_latitude,
      my_ads_location_longitude,
      // campaign_date,
      campaignDate: campaign_date, // rename here
      day,
      radius_km,
      media_type,
      apply_strict_filters,
    } = req.body;
    const platformRules = await fetchEffectivePlatformRules();
    const resolvedCityId = campaign_city_id || city_id || null;
    const resolvedAreaId = campaign_area_id || area_id || null;
    const strictFiltersEnabled =
      apply_strict_filters === true || apply_strict_filters === "true";

    let campaigns = [];
    let campaignsWithLogs = [];

    // 1. Fetch campaigns by campaign_date (if provided)
    if (campaign_date) {
      const campaigns = await Campaign.findAll({
        where: where(fn("DATE", col("campaign_date")), campaign_date),
        attributes: ["id", "company_id", "campaign_date"],
      });

      // if (campaigns.length === 0) {
      //     return res.status(404).json({ status: 404, message: "No campaigns found for the given date" });
      // }

      const campaignIds = campaigns.map((c) => c.id);

      const campaignLogs = await Campaign_Log.findAll({
        where: {
          campaign_id: {
            [Op.in]: campaignIds,
          },
        },
        attributes: ["id", "campaign_id", "society_id"],
      });

      campaignsWithLogs = campaigns.map((campaign) => {
        const logsForCampaign = campaignLogs.filter(
          (log) => log.campaign_id === campaign.id,
        );
        return {
          ...campaign.dataValues,
          logs: logsForCampaign,
        };
      });
    }

    // 2. Filter societies by selected geography first (city/area)
    const whereCondition = { status: "active" };
    if (resolvedCityId) whereCondition.city_id = resolvedCityId;
    if (resolvedAreaId) whereCondition.area_id = resolvedAreaId;

    // Optional strict filter (kept disabled by default to avoid over-filtering campaign dropdown)
    if (strictFiltersEnabled) {
      whereCondition[Op.or] = [
        { account_status: "approved" },
        { kyc_status: "approved" },
      ];
    }

    const societies = await Society_Registration.findAll({
      where: whereCondition,
      // attributes: ['id', 'longitude', 'latitude', 'city_id', 'area_id']
    });

    console.log("[get-societies-within-radius] Request filters", {
      city_id: resolvedCityId,
      area_id: resolvedAreaId,
      raw_city_id: city_id,
      raw_area_id: area_id,
      raw_campaign_city_id: campaign_city_id,
      raw_campaign_area_id: campaign_area_id,
      campaign_date: campaign_date || null,
      media_type: media_type || null,
      radius_km: radius_km || null,
      strict_filters_enabled: strictFiltersEnabled,
    });
    console.log("[get-societies-within-radius] Societies matched base query", {
      total: societies.length,
    });

    const applyRadiusFilter =
      my_ads_location_latitude && my_ads_location_longitude && radius_km;
    const societiesWithinRadius = [];
    let skippedByRadiusCount = 0;
    let missingLatLongCount = 0;
    let mediaNotOfferedCount = 0;

    for (const society of societies) {
      if (applyRadiusFilter) {
        if (!society.latitude || !society.longitude) {
          missingLatLongCount += 1;
          continue;
        }

        const distance = calculateDistance(
          parseFloat(my_ads_location_latitude),
          parseFloat(my_ads_location_longitude),
          parseFloat(society.latitude),
          parseFloat(society.longitude),
        );

        if (distance > parseFloat(radius_km)) {
          skippedByRadiusCount += 1;
          continue;
        }
      }

      const profile = await Society_Profile.findOne({
        where: { society_id: society.id },
        // attributes: ['id', 'society_id', 'ads_per_day']
      });

      // 🔢 Count how many times this society is used in campaign logs
      let used = 0;
      if (campaignsWithLogs.length > 0) {
        campaignsWithLogs.forEach((c) => {
          used += c.logs.filter((log) => log.society_id === society.id).length;
        });
      }

      const allowedValue = Number(profile?.ads_per_day);
      const hasValidDailyLimit =
        Number.isFinite(allowedValue) && allowedValue > 0;
      const allowed = hasValidDailyLimit ? allowedValue : null;
      const disable = hasValidDailyLimit ? used >= allowed : false;
      const disableReasons = [];
      const disableReasonCodes = [];

      if (disable && hasValidDailyLimit) {
        disableReasons.push(
          `Ad limit (${allowed}) reached for this society on ${campaign_date}`,
        );
        disableReasonCodes.push("ad_limit_reached");
      }

      let media_rate = null;
      let availabilityPreview = null;
      let isMediaSelectableForDate = true;
      if (media_type && isValidMediaType(media_type)) {
        const availabilityResult = await getRateCardAvailabilityForDate(
          society.id,
          media_type,
          campaign_date,
        );
        availabilityPreview = availabilityResult?.availability_preview || null;
        const activeRateCard = availabilityResult?.card || null;
        const displayRateCard =
          availabilityResult?.display_card || activeRateCard || null;

        // Keep society visible even when selected platform/date is unavailable.
        if (
          !activeRateCard &&
          availabilityResult?.reason_code === "platform_not_offered"
        ) {
          mediaNotOfferedCount += 1;
        }

        if (displayRateCard) {
          const recomputed = calculateRateBreakup(
            Number(displayRateCard.society_rate) || 0,
            normalizeMediaType(displayRateCard.media_type),
          );
          media_rate = {
            id: displayRateCard.id,
            media_type: displayRateCard.media_type,
            society_rate: recomputed.society_rate,
            platform_commission_pct: recomputed.platform_commission_pct,
            platform_rate: recomputed.platform_rate,
            company_rate: recomputed.company_rate,
            effective_from: displayRateCard.effective_from,
            effective_to: displayRateCard.effective_to,
            availability_days: Array.isArray(displayRateCard.availability_days)
              ? displayRateCard.availability_days
              : [],
            availability_month_days: Array.isArray(
              displayRateCard.availability_month_days,
            )
              ? displayRateCard.availability_month_days
              : [],
          };
        }

        if (!activeRateCard) {
          isMediaSelectableForDate = false;
          disableReasons.push(
            availabilityResult?.reason_message ||
              "Selected media slot is not offered by this society on chosen date",
          );
          if (availabilityResult?.reason_code) {
            disableReasonCodes.push(availabilityResult.reason_code);
          }
        }
      }

      // All media platforms this society offers with their rates (for per-asset selection)
      let offered_media_types = [];
      let media_assets = [];
      if (campaign_date) {
        const availableChecks = await Promise.all(
          MEDIA_TYPES.map(async (type) => {
            const card = await getActiveRateCardForDate(society.id, type, campaign_date);
            return { media_type: type, card };
          }),
        );
        offered_media_types = availableChecks
          .filter((item) => item.card)
          .map((item) => item.media_type);

        media_assets = availableChecks
          .filter((item) => item.card)
          .map((item) => {
            const breakup = calculateRateBreakup(
              Number(item.card.society_rate) || 0,
              normalizeMediaType(item.card.media_type),
            );
            return {
              key: item.media_type,
              label: MEDIA_TYPE_LABELS[item.media_type] || item.media_type,
              permission_cost: breakup.company_rate,
              society_rate: breakup.society_rate,
              platform_rate: breakup.platform_rate,
              rate_card_id: item.card.id,
            };
          });
      } else {
        const offeredCards = await Society_Media_Rate_Card.findAll({
          where: { society_id: society.id, status: "active" },
          raw: true,
        });
        const uniqueTypes = [
          ...new Set(
            (offeredCards || []).map((c) => c.media_type).filter(Boolean),
          ),
        ];
        offered_media_types = uniqueTypes;
        media_assets = uniqueTypes.map((type) => {
          const card = offeredCards.find((c) => c.media_type === type);
          const breakup = calculateRateBreakup(
            Number(card?.society_rate) || 0,
            normalizeMediaType(type),
          );
          return {
            key: type,
            label: MEDIA_TYPE_LABELS[type] || type,
            permission_cost: breakup.company_rate,
            society_rate: breakup.society_rate,
            platform_rate: breakup.platform_rate,
            rate_card_id: card?.id || null,
          };
        });
      }

      societiesWithinRadius.push({
        id: society.id,
        society_id: society.id,
        society_name: society.society_name || null,
        name: society.name || null,
        address: society.address || null,
        city_id: society.city_id || null,
        area_id: society.area_id || null,
        latitude: society.latitude || null,
        longitude: society.longitude || null,
        label: society.society_name || society.name || `Society ${society.id}`,
        society,
        profile,
        used,
        allowed,
        disable: disable || (media_type && !isMediaSelectableForDate),
        disable_message: disableReasons.join(" | "),
        disable_reasons: disableReasons,
        disable_reason_codes: disableReasonCodes,
        availability_preview: media_rate
          ? buildAvailabilityPreview(media_rate)
          : availabilityPreview,
        media_rate,
        offered_media_types,
        media_assets,
      });
    }

    console.log("[get-societies-within-radius] Post-filter summary", {
      returned: societiesWithinRadius.length,
      apply_radius_filter: !!applyRadiusFilter,
      skipped_by_radius: skippedByRadiusCount,
      missing_lat_long: missingLatLongCount,
      media_not_offered: mediaNotOfferedCount,
    });

    res.status(200).json({
      status: 200,
      message: "Societies fetched successfully",
      total: societiesWithinRadius.length,
      city_id: resolvedCityId,
      area_id: resolvedAreaId,
      media_platforms: Object.values(platformRules),
      selected_media_constraints: media_type
        ? platformRules[normalizeMediaType(media_type)] || null
        : null,
      // campaigns: campaignsWithLogs,
      data: societiesWithinRadius,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({
        status: 500,
        message: "Failed to fetch societies",
        error: error.message,
      });
  }
};

exports.createOrUpdateCampaign = async (req, res) => {
  try {
    const {
      id,
      campaign_name,
      campaign_date,
      campaign_city_id,
      campaign_area_id,
      campaign_address,
      my_ads_location_latitude,
      my_ads_location_longitude,
      radius_km,
      search_by_google_location,
      campaign_amount,
      campaign_status,
    } = req.body;

    const { userType, comapnyId, comapnyUserId } =
      await resolveCompanyContext(req);
    if (!comapnyId) {
      return res
        .status(400)
        .json({ status: 400, message: "Company not found" });
    }
    await ensureCampaignPaymentColumns();

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Validate campaign_date
    if (campaign_date && !moment(campaign_date).isValid()) {
      return res.status(400).json({ status: 400, message: "Invalid campaign_date" });
    }

    // Parse per-society asset selections: society_assets[societyId] = JSON string of assets array
    // Each asset: { key, label, permission_cost }
    const societyAssetsMap = {};

    // Primary: single JSON blob (avoids multer bracket-key issues)
    if (req.body.society_assets_json) {
      try {
        const parsed = JSON.parse(req.body.society_assets_json);
        Object.entries(parsed).forEach(([socId, assets]) => {
          societyAssetsMap[Number(socId)] = Array.isArray(assets) ? assets : [];
        });
      } catch {
        // ignore malformed JSON
      }
    }

    // Fallback: per-field bracket notation (legacy support)
    for (const key in req.body) {
      const match = key.match(/^society_assets\[(\d+)\]$/);
      if (match) {
        const socId = Number(match[1]);
        if (societyAssetsMap[socId] === undefined) {
          try {
            societyAssetsMap[socId] = JSON.parse(req.body[key]);
          } catch {
            societyAssetsMap[socId] = [];
          }
        }
      }
    }

    // Collect society IDs from society_assets keys + legacy society_ind_ids
    const selectedSocietyIds = Object.keys(societyAssetsMap).map(Number);
    // Also include legacy society_ind_ids for backward compat
    const legacySocietyIds = resolveRequestedSocietyIds(req.body);
    const allSocietyIds = [...new Set([...selectedSocietyIds, ...legacySocietyIds])];

    // Compute per-society subtotals from selected assets (permission costs)
    const subtotalBySociety = {};
    let resolvedCampaignAmount = 0;

    if (allSocietyIds.length > 0) {
      for (const societyId of allSocietyIds) {
        const assets = societyAssetsMap[societyId];
        if (Array.isArray(assets) && assets.length > 0) {
          const subtotal = assets.reduce((sum, a) => sum + Number(a.permission_cost || 0), 0);
          subtotalBySociety[societyId] = subtotal;
          resolvedCampaignAmount += subtotal;
        } else {
          subtotalBySociety[societyId] = 0;
        }
      }
      resolvedCampaignAmount = Number(resolvedCampaignAmount.toFixed(2));
    }

    // If no per-society assets provided, fall back to campaign_amount from body
    if (allSocietyIds.length === 0 || Object.values(subtotalBySociety).every(v => v === 0)) {
      resolvedCampaignAmount = Number(campaign_amount) || 0;
    }

    const requestedCampaignStatus = campaign_status || "draft";
    let resolvedPaymentStatus = "unpaid";
    let paidAt = null;

    if (requestedCampaignStatus === "pending") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          status: 400,
          message: "Payment is required before creating or submitting campaign",
        });
      }

      const isValidSignature = verifyRazorpaySignature({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      });

      if (!isValidSignature) {
        return res.status(400).json({
          status: 400,
          message: "Campaign payment verification failed",
        });
      }

      resolvedPaymentStatus = "paid";
      paidAt = new Date();

      await Payment_Order.update(
        {
          amount_paid: Math.round(resolvedCampaignAmount * 100),
          amount_due: 0,
          razorpay_order_status: "paid",
          notes: {
            purpose: "campaign_payment",
            company_id: comapnyId,
            company_user_id: comapnyUserId,
            payment_status: "paid",
            razorpay_payment_id,
            paid_at: paidAt,
            campaign_amount: resolvedCampaignAmount,
          },
          modified_ip_address: req.ip,
          modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
          modified_type: userType,
        },
        { where: { razorpay_order_id } },
      );
    }

    let campaign;
    let CampaignLogs = []; // Initialize empty array to store logs

    if (id) {
      // Try to find existing campaign by ID
      campaign = await Campaign.findOne({ where: { id } });

      if (campaign) {
        let finalCampaignStatus = campaign.campaign_status;

        // CAMPAIGN LOCK: Paid/pending campaigns cannot be altered
        if (campaign.campaign_status === "pending") {
          return res.status(403).json({
            status: 403,
            message: "Campaign is locked — payment has been made and no further changes are allowed.",
          });
        }

        finalCampaignStatus = requestedCampaignStatus;

        // Update the campaign
        campaign = await campaign.update({
          company_id: comapnyId,
          company_user_id: comapnyUserId,
          campaign_name,
          campaign_amount: resolvedCampaignAmount,
          campaign_date,
          campaign_city_id,
          campaign_area_id,
          campaign_address,
          my_ads_location_latitude,
          my_ads_location_longitude,
          radius_km,
          search_by_google_location,
          campaign_status: finalCampaignStatus,
          modified_ip_address: req.ip,
          modified_type: userType,
          modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
        });
        await persistCampaignPaymentMeta({
          campaignId: campaign.id,
          paymentStatus: resolvedPaymentStatus,
          paymentMode: requestedCampaignStatus === "pending" ? "online" : null,
          paymentOrderId: razorpay_order_id || null,
          paymentId: razorpay_payment_id || null,
          paidAt,
        });

        let userMessage = "Campaign updated successfully";

        const CampaignLogs = [];

        // Collect society IDs from new societyAssetsMap (primary) + legacy fields
        const usedSocietyIdsSet = new Set(allSocietyIds);
        const usedSocietyIds = [...usedSocietyIdsSet];

        // Delete logs for societies no longer selected
        const existingLogs = await Campaign_Log.findAll({
          where: { campaign_id: campaign.id },
          attributes: ["society_id"],
        });
        const existingSocietyIds = existingLogs.map((log) => log.society_id);
        const toDeleteSocietyIds = existingSocietyIds.filter(
          (id) => !usedSocietyIdsSet.has(id),
        );
        if (toDeleteSocietyIds.length > 0) {
          await Campaign_Log.destroy({
            where: { campaign_id: campaign.id, society_id: toDeleteSocietyIds },
          });
        }

        // Build log data for a society
        const buildLogData = (socId, extraFields = {}) => ({
          campaign_id: campaign.id,
          company_id: comapnyId,
          company_user_id: comapnyUserId,
          society_id: socId,
          campaign_name,
          campaign_date,
          campaign_area_id,
          selected_assets: societyAssetsMap[socId] || null,
          subtotal: subtotalBySociety[socId] || 0,
          campaign_ads_amount: subtotalBySociety[socId] || 0,
          campaign_status: finalCampaignStatus,
          ...extraFields,
        });

        // Process WhatsApp creative uploads per society
        const whatsappCreativeBySociety = {};
        if (Array.isArray(req.files)) {
          for (const file of req.files) {
            const match = file.fieldname.match(/^upload_societies_images_path\[(\d+)\]$/);
            if (match) {
              whatsappCreativeBySociety[Number(match[1])] = {
                path: `uploads/${file.filename}`,
                name: file.filename,
              };
            }
          }
        }

        // Upsert logs for each selected society
        for (const socId of usedSocietyIds) {
          const creative = whatsappCreativeBySociety[socId];
          const logData = buildLogData(socId, {
            ...(creative && {
              upload_societies_images_path: creative.path,
              upload_societies_images_name: creative.name,
            }),
          });

          const existingLog = await Campaign_Log.findOne({
            where: { campaign_id: campaign.id, society_id: socId },
          });

          if (existingLog) {
            await existingLog.update({
              ...logData,
              modified_ip_address: req.ip,
              modified_by: userType === "Company_User" ? comapnyUserId : comapnyId,
              modified_type: userType,
            });
            CampaignLogs.push(existingLog);
          } else {
            const newLog = await Campaign_Log.create({
              ...logData,
              created_ip_address: req.ip,
              created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
              created_type: userType,
            });
            CampaignLogs.push(newLog);
          }
        }

        if (finalCampaignStatus === "pending") {
          await Notification.create({
            company_ids: [comapnyId], // Uncomment if needed
            message: `Campaign #${campaign.id_prifix_campaign} has been created by the company and is awaiting approval.`,
            from: "company",
            to: "admin",
            notify_type: "individual",
            created_ip_address: req.ip,
          });
        }

        return res.status(200).json({
          status: 200,
          message: userMessage,
          data: {
            campaign,
            logs: CampaignLogs,
          },
        });
      }
    }
    // Before campaign is created
    let finalCampaignStatus = requestedCampaignStatus;

    let userMessage = "Campaign created successfully";
    if (requestedCampaignStatus === "draft") {
      userMessage = "Campaign saved as draft";
    }

    // Create a new campaign if no ID is provided or if campaign not found
    const newCampaign = await Campaign.create({
      company_id: comapnyId,
      company_user_id: comapnyUserId,
      campaign_amount: resolvedCampaignAmount,
      campaign_name,
      campaign_date,
      campaign_city_id,
      campaign_area_id,
      campaign_address,
      my_ads_location_latitude,
      my_ads_location_longitude,
      radius_km,
      search_by_google_location,
      campaign_status: finalCampaignStatus,
      created_ip_address: req.ip,
      created_type: userType,
      created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
    });

    const formattedId =
      newCampaign.id < 10 ? `0${newCampaign.id}` : `${newCampaign.id}`;
    const generatedPrefixCampaign = `ADZ10XCP${formattedId}`;
    await newCampaign.update({ id_prifix_campaign: generatedPrefixCampaign });
    await persistCampaignPaymentMeta({
      campaignId: newCampaign.id,
      paymentStatus: resolvedPaymentStatus,
      paymentMode: requestedCampaignStatus === "pending" ? "online" : null,
      paymentOrderId: razorpay_order_id || null,
      paymentId: razorpay_payment_id || null,
      paidAt,
    });

    // Collect per-society WhatsApp creatives from file uploads
    const newCampaignCreativeBySociety = {};
    if (Array.isArray(req.files)) {
      for (const file of req.files) {
        const match = file.fieldname.match(/^upload_societies_images_path\[(\d+)\]$/);
        if (match) {
          newCampaignCreativeBySociety[Number(match[1])] = {
            path: `uploads/${file.filename}`,
            name: file.filename,
          };
        }
      }
    }

    // Create a Campaign_Log for each selected society
    for (const socId of allSocietyIds) {
      const creative = newCampaignCreativeBySociety[socId];
      const log = await Campaign_Log.create({
        campaign_id: newCampaign.id,
        company_id: comapnyId,
        company_user_id: comapnyUserId,
        society_id: socId,
        campaign_name,
        campaign_date,
        campaign_area_id,
        selected_assets: societyAssetsMap[socId] || null,
        subtotal: subtotalBySociety[socId] || 0,
        campaign_ads_amount: subtotalBySociety[socId] || 0,
        campaign_status: finalCampaignStatus,
        ...(creative && {
          upload_societies_images_path: creative.path,
          upload_societies_images_name: creative.name,
        }),
        created_ip_address: req.ip,
        created_by: userType === "Company_User" ? comapnyUserId : comapnyId,
        created_type: userType,
      });
      CampaignLogs.push(log);
    }

    for (const log of CampaignLogs) {
      const formattedLogId = log.id < 10 ? `0${log.id}` : `${log.id}`;
      const generatedPrefixCampaignLog = `ADZ10XADS${formattedLogId}`;

      await log.update({ id_prifix_campaign_ads: generatedPrefixCampaignLog });
    }

    if (newCampaign.campaign_status === "pending") {
      await Notification.create({
        company_ids: [comapnyId], // Uncomment if needed
        message: `Campaign #${newCampaign.id_prifix_campaign} has been created by the company and is awaiting approval.`,
        from: "company",
        to: "admin",
        notify_type: "individual",
        created_ip_address: req.ip,
      });
    }

    return res.status(201).json({
      status: 201,
      message: userMessage,
      data: {
        newCampaign,
        logs: CampaignLogs,
      },
    });
  } catch (error) {
    console.error("Error in createOrUpdateCampaign:", error);
    return res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
