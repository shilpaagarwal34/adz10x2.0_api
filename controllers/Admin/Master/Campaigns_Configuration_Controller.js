const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { MEDIA_TYPES, getMediaPlatformConfig } = require('@helper/mediaRateHelper');

const parsePlatformRules = (incomingRules = {}) => {
    const parsed =
        typeof incomingRules === "string"
            ? (() => {
                  try {
                      return JSON.parse(incomingRules);
                  } catch (_) {
                      return {};
                  }
              })()
            : incomingRules || {};

    const normalizedRules = {};
    MEDIA_TYPES.forEach((mediaType) => {
        const defaults = getMediaPlatformConfig(mediaType);
        const candidate = parsed?.[mediaType] || {};
        const minLeadDays = Number(candidate.min_lead_days);
        const minActiveDays = Number(candidate.min_active_days);

        normalizedRules[mediaType] = {
            min_lead_days: Number.isFinite(minLeadDays) && minLeadDays >= 0 ? minLeadDays : Number(defaults.min_lead_days || 0),
            min_active_days:
                Number.isFinite(minActiveDays) && minActiveDays > 0 ? minActiveDays : Number(defaults.min_active_days || 1),
        };
    });

    return normalizedRules;
};

const buildMediaPlatforms = (platformRules = {}) =>
    MEDIA_TYPES.map((mediaType) => {
        const defaults = getMediaPlatformConfig(mediaType);
        const rule = platformRules?.[mediaType] || {};
        return {
            media_type: mediaType,
            label: defaults.label || mediaType,
            min_lead_days: Number(rule.min_lead_days ?? defaults.min_lead_days ?? 0),
            min_active_days: Number(rule.min_active_days ?? defaults.min_active_days ?? defaults.duration_days ?? 0),
        };
    });

exports.store = async (req, res) => {
     try {
        //  const userId = req.user.id; // logged-in user ID
         const { id, brand_promotion,lead_generation,survey,mon,tue,wed,thu,fri,sat,sun,from_time,to_time,society_commission, society_brand_promotion,society_lead_generation, society_survey, platform_rules } = req.body;
         const { privileges, isSuperAdmin } = req.user;
         const hasPlatformRules = Object.prototype.hasOwnProperty.call(req.body, "platform_rules");
         const normalizedPlatformRules = hasPlatformRules ? parsePlatformRules(platform_rules) : null;
     
        if (id) {
            const existingCampaign = await Campaign_Configuration.findByPk(id);
            if (!existingCampaign) {
                return res.status(404).json({ status: 404, message: 'Campaign not found' });
            }

            const updatePayload = { updated_ip_address: req.ip };
            if (hasPlatformRules) {
                updatePayload.platform_rules = normalizedPlatformRules;
            }

            const optionalFields = [
                'brand_promotion',
                'lead_generation',
                'survey',
                'mon',
                'tue',
                'wed',
                'thu',
                'fri',
                'sat',
                'sun',
                'from_time',
                'to_time',
                'society_commission',
                'society_brand_promotion',
                'society_lead_generation',
                'society_survey',
            ];

            optionalFields.forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                    updatePayload[field] = req.body[field];
                }
            });

            await existingCampaign.update(updatePayload);

            // Notifications (directly without checking for changes)
            if (brand_promotion || lead_generation || survey) {
                await Notification.create({
                    message: `Company Registration Campaign Amount is Updated`,
                    from: 'admin',
                    to: 'company',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'company'
                });
            }

            if (society_commission || society_brand_promotion || society_lead_generation || society_survey) {
                await Notification.create({
                    message: `Society Commission is Updated`,
                    from: 'admin',
                    to: 'society',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'society'
                });
            }

            const anyDayOrTimeSet = mon || tue || wed || thu || fri || sat || sun || from_time || to_time;
            if (anyDayOrTimeSet) {
                await Notification.create({
                    message: `Campaign Days Updated`,
                    from: 'admin',
                    to: 'society',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'society'
                });
            }

            return res.status(200).json({
                status: 200,
                message: 'Campaign configuration updated successfully',
                data: {
                    ...existingCampaign.toJSON(),
                    platform_rules: parsePlatformRules(existingCampaign.platform_rules || {}),
                    media_platforms: buildMediaPlatforms(parsePlatformRules(existingCampaign.platform_rules || {})),
                }
            });
        }else {
                // if (!isSuperAdmin && !privileges.includes('campaign_configuration_add')) {
                //     return res.status(403).json({ 
                //             status: 403, 
                //             message: 'Sorry, You Have No Permission For This Request' 
                //     });
                // }
             const create = await Campaign_Configuration.create({
                 brand_promotion,
                 lead_generation,
                 survey,
                 mon,
                 tue,
                 wed,
                 thu,
                 fri,
                 sat,
                 sun,
                 from_time,
                 to_time,
                 society_commission,
                 society_brand_promotion,
                 society_lead_generation,
                 society_survey,
                 platform_rules: parsePlatformRules(platform_rules),
                 created_ip_address: req.ip,
                //  created_by:userId
             });

             // Notify company if relevant fields exist
            if (brand_promotion || lead_generation || survey) {
                await Notification.create({
                    message: `Company Registration Campaign Amount is Created`,
                    from: 'admin',
                    to: 'company',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'company'
                });
            }

            // Notify society if relevant fields exist
            if (society_commission || society_brand_promotion || society_lead_generation || society_survey) {
                await Notification.create({
                    message: `Society Commission is Created`,
                    from: 'admin',
                    to: 'society',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'society'
                });
            }

            // Notify if any day or time fields exist
            const anyDayOrTimeSet = mon || tue || wed || thu || fri || sat || sun || from_time || to_time;
            if (anyDayOrTimeSet) {
                await Notification.create({
                    message: `Campaign Days Created`,
                    from: 'admin',
                    to: 'all',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    types: 'campaign'
                });
            }

             return res.status(201).json({
                 status: 201,
                 message: "Campaign configuration created successfully",
                 data: {
                    ...create.toJSON(),
                    platform_rules: parsePlatformRules(create.platform_rules || {}),
                    media_platforms: buildMediaPlatforms(parsePlatformRules(create.platform_rules || {})),
                 }
             });
         }
     } catch (error) {
         console.error("Campaign configuration error:", error);
         return res.status(500).json({
             status: 500,
             error: error.message
         });
     }
 };

exports.getCampaign = async (req, res) => {
    try {
        const campaign = await Campaign_Configuration.findOne({
          where:{ status:'active' },
            order: [['id', 'ASC']]
        });

        if (!campaign) {
            return res.status(404).json({ status:404,  message: 'Campaign not found' });
        }

        const normalizedPlatformRules = parsePlatformRules(campaign.platform_rules || {});
        return res.status(200).json({
            status: 200,
            message: 'Campaign fetched successfully',
            data: {
                ...campaign.toJSON(),
                platform_rules: normalizedPlatformRules,
                media_platforms: buildMediaPlatforms(normalizedPlatformRules),
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};