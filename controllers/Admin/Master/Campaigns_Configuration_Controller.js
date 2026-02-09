const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Notification = require('@models/Notifications/Notification_Model');

exports.store = async (req, res) => {
     try {
        //  const userId = req.user.id; // logged-in user ID
         const { id, brand_promotion,lead_generation,survey,mon,tue,wed,thu,fri,sat,sun,from_time,to_time,society_commission, society_brand_promotion,society_lead_generation, society_survey } = req.body;
         const { privileges, isSuperAdmin } = req.user;
     
        if (id) {
            const existingCampaign = await Campaign_Configuration.findByPk(id);
            if (!existingCampaign) {
                return res.status(404).json({ status: 404, message: 'Campaign not found' });
            }

            await existingCampaign.update({
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
                updated_ip_address: req.ip,
            });

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
                data: existingCampaign
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
                 data: create
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

        return res.status(200).json({ status: 200, message: 'Campaign fetched successfully', data: campaign });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};