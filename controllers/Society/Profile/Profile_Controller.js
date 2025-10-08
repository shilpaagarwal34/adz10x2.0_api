const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Ads_Slot = require('@models/Society/Auth/Society_Ads_Slot_Model');
const { Op, where } = require("sequelize");
const path = require('path');
const moment = require('moment');
const { error } = require('console');

exports.getSocietyProfile = async (req, res) => {
    try {
        // 👇 Start by detecting where the user is coming from
           let societyId = null;
           let societyUserId = null;
           let societyType = null;
           let societyUserType = null;
       
           let userId = req.user.id;
           let userType = req.user_type;
       
           if (userType === 'Society_Admin') {
             societyId = userId;
             societyType = userType;
           } else if (userType === 'Society_User') {
             societyUserId = userId;
             societyUserType = userType;

             const societyUser = await Society_User.findOne({ where: { id: societyUserId } });
             societyId = societyUser.society_id;
           }


        // Fetch society profile using society_id
       //  const profile = await Society_Profile.findOne({ where: { society_id: user.id } });
       const profile = await Society_Profile.findOne({ where: { society_id: societyId } });

       const anyDaySlotExists = await Ads_Slot.findOne({
            where: {
                society_id: societyId,
                status: 'active' // 👈 Only consider active slots
            }
        });

       if(userType = 'Society_User'){
           user = await Society_Registration.findOne({ where: { id: societyId } });
       }

         const check_edit = await Society_Registration.findOne({ where:{ id: societyId } });
             

        if (!profile) {
            return res.status(404).json({ status: 404, message: "Society profile not found" });
        }
        let completion = 0;

                   // 1. Basic Society Details (20%)
           const basicDetails = [
               user.society_name?.trim(),
               profile.number_of_flat,
               profile.society_email?.trim(),
               profile.whatsapp_group_name?.trim(),
               profile.number_of_members,
               profile.society_whatsapp_img_path,
               profile.address_line_1
            //    profile.address_line_2
           ];
           const filledBasic = basicDetails.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledBasic / basicDetails.length) * 20;

           // 2. Contact Information (15%)
           const contactInfo = [
               user.name?.trim(),
               user.mobile_number?.trim(),
               user.email?.trim()
           ];
           const filledContact = contactInfo.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledContact / contactInfo.length) * 15;

           // 3. Society Location (15%)
           const location = [
               user.latitude,
               user.longitude,
               user.address?.trim(),
               user.city_id,
               user.area_id,
               user.pincode
           ];
           const filledLocation = location.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledLocation / location.length) * 15;

// 4. Billing Details (20%)
const billing = [
   profile.account_holder_name?.trim(),
   profile.bank_name?.trim(),
   profile.branch_name?.trim(),
   profile.account_no?.trim(),
   profile.bank_ifsc_code?.trim(),
   profile.billing_address_line_1?.trim()
//    profile.billing_address_line_2?.trim()
];
const filledBilling = billing.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledBilling / billing.length) * 20;

// 5. Society Photos & Documents (20%)

const Photos = [
   profile.society_profile_img_1_path?.trim(),
   profile.society_profile_img_2_path?.trim(),
   profile.society_profile_img_3_path?.trim(),
   profile.society_profile_img_4_path?.trim(),
   profile.society_profile_img_5_path?.trim()
];
const filledPhotos = Photos.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledPhotos / Photos.length) * 20;


// 6. Advertisement Settings (5%)
const ads = [
   profile.ads_per_day
];
const filledAds = ads.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledAds / ads.length) * 5;

// Add 5% if any active ad slot exists for the society
if (anyDaySlotExists) {
    completion += 5;
}


const profileCompletion = Math.round(completion);

        return res.status(200).json({
            status: 200,
            message: "Society profile retrieved successfully",
            data: {
               profile_completion: profileCompletion, 
              society_registration: {
                   id: user.id,
                   society_name: user.society_name,
                   user_type: user.user_type,
                   name: user.name,
                   email: user.email,
                   token: user.token, 
                   mobile_number: user.mobile_number,
                   city_id: user.city_id,
                   area_id: user.area_id,
                   is_otp_verified: user.is_otp_verified,
                   pincode: user.pincode,
                   address: user.address,
                   latitude: user.latitude,
                   longitude: user.longitude,
                   society_profile_img_path: user.society_profile_img_path,
                   society_profile_img_name: user.society_profile_img_path,
                   reletionship_manager_id: null,
                   account_status: user.account_status,
                   amount: user.amount,
                   kyc_status: user.kyc_status,
                   aggrement_copy_path: user.aggrement_copy_path,
                   is_agree_terms_condition: user.is_agree_terms_condition,
                 
                   society_profile: profile || null,
                   edit_permission: check_edit.allow_edit
              }
            }

        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message  });
    }
}

exports.getSocietyProfiles = async (req, res) => {
    try {
   
        const authHeader = req.headers['authorization'];
        const bodyToken = req.body.token;

        // Use whichever token is available
        const rawToken = authHeader || bodyToken;
        if (!rawToken) {
            return res.status(401).json({ status: 401, message: "Token is required" });
        }

        // Remove "Bearer " prefix if present
        const cleanToken = rawToken.replace("Bearer ", "");

       let user = null;
       let userType = null;
       let societyId = null;

       // Try to find in Society_Registration
       user = await Society_Registration.findOne({ where: { token: cleanToken } });
       if (user) {
           userType = 'Society_Admin';
           societyId = user.id;
       }

       // If not found, try Society_User
       if (!user) {
           user = await Society_User.findOne({ where: { token: cleanToken } });
           if (user) {
               userType = 'Society_User';
               societyId = user.society_id; // Use `society_id` field from Society_User
           }
       }

       if (!user) {
           return res.status(404).json({ status: 404, message: "User not found or invalid token" });
       }

       //  // Find the user using the token
       //  const user = await Society_Registration.findOne({ where: { token: cleanToken } });

       //  if (!user) {
       //      return res.status(404).json({ status: 404, message: "User not found or invalid token" });
       //  }

        // Fetch society profile using society_id
       //  const profile = await Society_Profile.findOne({ where: { society_id: user.id } });
       const profile = await Society_Profile.findOne({ where: { society_id: societyId } });

       if(userType = 'Society_User'){
           user = await Society_Registration.findOne({ where: { id: societyId } });
       }

         const check_edit = await Society_Registration.findOne({ where:{ id: societyId } });
             

        if (!profile) {
            return res.status(404).json({ status: 404, message: "Society profile not found" });
        }
        let completion = 0;

                   // 1. Basic Society Details (20%)
           const basicDetails = [
               user.society_name?.trim(),
               profile.number_of_flat,
               profile.society_email?.trim(),
               profile.whatsapp_group_name?.trim(),
               profile.number_of_members,
               profile.society_whatsapp_img_path,
               profile.address_line_1,
               profile.address_line_2

           ];
           const filledBasic = basicDetails.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledBasic / basicDetails.length) * 20;

           // 2. Contact Information (15%)
           const contactInfo = [
               user.name?.trim(),
               user.mobile_number?.trim(),
               user.email?.trim()
           ];
           const filledContact = contactInfo.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledContact / contactInfo.length) * 15;

           // 3. Society Location (15%)
           const location = [
               user.latitude,
               user.longitude,
               user.address?.trim(),
               user.city_id,
               user.area_id,
               user.pincode
           ];
           const filledLocation = location.filter(field => field !== null && field !== undefined && field !== '').length;
           completion += (filledLocation / location.length) * 15;

// 4. Billing Details (20%)
const billing = [
   profile.account_holder_name?.trim(),
   profile.bank_name?.trim(),
   profile.branch_name?.trim(),
   profile.account_no?.trim(),
   profile.bank_ifsc_code?.trim(),
   profile.billing_address_line_1?.trim(),
   profile.billing_address_line_2?.trim()
];
const filledBilling = billing.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledBilling / billing.length) * 20;

// 5. Society Photos & Documents (20%)

const Photos = [
   profile.society_profile_img_1_path?.trim(),
   profile.society_profile_img_2_path?.trim(),
   profile.society_profile_img_3_path?.trim(),
   profile.society_profile_img_4_path?.trim(),
   profile.society_profile_img_5_path?.trim()
];
const filledPhotos = Photos.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledPhotos / Photos.length) * 20;


// 6. Advertisement Settings (10%)
const ads = [
   profile.ad_slot_timing,
   profile.ads_per_day
];
const filledAds = ads.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledAds / ads.length) * 10;

const profileCompletion = Math.round(completion);


        return res.status(200).json({
            status: 200,
            message: "Society profile retrieved successfully",
            data: {
               profile_completion: profileCompletion, 
              society_registration: {
                   id: user.id,
                   society_name: user.society_name,
                   user_type: user.user_type,
                   name: user.name,
                   email: user.email,
                   token: user.token, 
                   mobile_number: user.mobile_number,
                   city_id: user.city_id,
                   area_id: user.area_id,
                   is_otp_verified: user.is_otp_verified,
                   pincode: user.pincode,
                   address: user.address,
                   latitude: user.latitude,
                   longitude: user.longitude,
                   society_profile_img_path: user.society_profile_img_path,
                   society_profile_img_name: user.society_profile_img_path,
                   reletionship_manager_id: null,
                   account_status: user.account_status,
                   amount: user.amount,
                   kyc_status: user.kyc_status,
                   aggrement_copy_path: user.aggrement_copy_path,
                   is_agree_terms_condition: user.is_agree_terms_condition,
                 
                   society_profile: profile || null,
                   edit_permission: check_edit.allow_edit
              }
            }

        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message  });
    }
}

exports.getSocietyProfileSlot = async (req, res) => {
    try {
    
        // 👇 Start by detecting where the user is coming from
           let societyId = null;
           let societyUserId = null;
           let societyType = null;
           let societyUserType = null;
       
           let userId = req.user.id;
           let userType = req.user_type;
       
           if (userType === 'Society_Admin') {
             societyId = userId;
             societyType = userType;
           } else if (userType === 'Society_User') {
             societyUserId = userId;
             societyUserType = userType;

             const societyUser = await Society_User.findOne({ where: { id: societyUserId } });
             societyId = societyUser.society_id;
           }

      // If still not found
      if (!societyId) {
        return res.status(404).json({ status: 404, message: "User not found or invalid token" });
      }
  
      // Fetch ads slots for the society
      const ads_slots = await Ads_Slot.findAll({ where: { society_id: societyId, status: 'active' } });
  
      return res.status(200).json({
        status: 200,
        message: "Ads slots fetched successfully",
        data: ads_slots
      });
  
    } catch (error) {
      return res.status(500).json({
        status: 500,
        message: "Something went wrong",
        error: error.message
      });
    }
};

exports.societyRegistrationUpdateImage = async (req, res) => {
    
    try {
       
           let societyId = null;
           let societyUserId = null;
           let societyType = null;
           let societyUserType = null;
       
           let userId = req.user.id;
           let userType = req.user_type;
            let user_id = null;
       
           if (userType === 'Society_Admin') {
             societyId = userId;
            //  societyType = userType;
             societyType = 'Society_Admin';
           } else if (userType === 'Society_User') {
             user_id = userId;
            //  societyUserType = userType;
              societyType = 'Society_User';

             const societyUser = await Society_User.findOne({ where: { id: societyUserId } });
             societyId = societyUser.society_id;
           }

        if (!societyId) {
            return res.status(404).json({ status: 404, message: "User not found or invalid token" });
        }

          const check_edit = await Society_Registration.findOne({ where:{ id: societyId } });
            
       if (check_edit.kyc_status === 'approved') {
                if (!check_edit.allow_edit) {
                    return res.status(403).json({
                        status: 403,
                        message: "Allow edit permission for admin."
                    });
                }
        }

        let profile = await Society_Profile.findOne({ where: { society_id: societyId } });

        // If profile does not exist, return an error
        if (!profile) {
            return res.status(404).json({ status: 404, message: "Society profile not found, please create first" });
        }

        // Required field validation
        const requiredFields = {
            society_name: "Society name is required",
            name: "Name is required",
            mobile_number: "Mobile number is required",
            email: "Email is required",
            city_id: "City is required",
            pincode: "Pincode is required",
            address: "Address is required",
        };

        for (let field in requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ status: 400, message: requiredFields[field] });
            }
        }

        console.log('files', req.files['society_profile_img_1_5_path']);
        
            // Get newly uploaded images
        let uploadedImages = req.files['society_profile_img_1_5_path'] || [];
        let image_1_5_Paths = uploadedImages.map(file => `uploads/${file.filename}`);
        let image_1_5_Names = uploadedImages.map(file => file.filename);

        let updatedFields = {};

        if (!profile.society_profile_img_1_path && image_1_5_Paths.length > 0) {
            updatedFields.society_profile_img_1_path = image_1_5_Paths.shift();
            updatedFields.society_profile_img_1_name = image_1_5_Names.shift();
        }
        if (!profile.society_profile_img_2_path && image_1_5_Paths.length > 0) {
            updatedFields.society_profile_img_2_path = image_1_5_Paths.shift();
            updatedFields.society_profile_img_2_name = image_1_5_Names.shift();
        }
        if (!profile.society_profile_img_3_path && image_1_5_Paths.length > 0) {
            updatedFields.society_profile_img_3_path = image_1_5_Paths.shift();
            updatedFields.society_profile_img_3_name = image_1_5_Names.shift();
        }
        if (!profile.society_profile_img_4_path && image_1_5_Paths.length > 0) {
            updatedFields.society_profile_img_4_path = image_1_5_Paths.shift();
            updatedFields.society_profile_img_4_name = image_1_5_Names.shift();
        }
        if (!profile.society_profile_img_5_path && image_1_5_Paths.length > 0) {
            updatedFields.society_profile_img_5_path = image_1_5_Paths.shift();
            updatedFields.society_profile_img_5_name = image_1_5_Names.shift();
        }

        // Handle multiple images dynamically
        const imageFields = [
            "society_profile_img_path",
            "society_whatsapp_img_path",
            "pan_card_path",
            "gst_certificate_path",
            "other_document_path"
        ];
        
        let imagePaths = {};
        let imageNames = {};

        imageFields.forEach(field => {
            if (req.files[field] && req.files[field][0]) {
                imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                imageNames[field] = path.basename(req.files[field][0].filename);
            }
        });

        // Determine if PAN card path is missing or required
        const isPanCardRequired = 
        !profile || // profile doesn't exist
        !profile.pan_card_path || profile.pan_card_path === ""; // or pan_card_path is empty

        // Validate PAN card file if required
        if (isPanCardRequired && (!req.files["pan_card_path"] || !req.files["pan_card_path"][0])) {
        return res.status(400).json({ status: 400, error: "PAN card is required." });
        }

        // Validate city
        const city = await City.findByPk(req.body.city_id);
        if (!city) {
            return res.status(404).json({ status: 404, message: "City not found" });
        }

        // Handle area_id
        let area_id = req.body.area_id;
        if (!area_id && req.body.area_name) {
            const existingArea = await Area.findOne({ where: { area_name: req.body.area_name, city_id: req.body.city_id } });
            area_id = existingArea ? existingArea.id : (await Area.create({ city_id: req.body.city_id, area_name: req.body.area_name, status: 'active', created_ip_address: req.ip })).id;
        }
        if (!area_id) {
            return res.status(400).json({ status: 400, message: "Area Name is required" });
        }
            // Run all queries in parallel using Promise.all()
        const [SocietyemailExists, SocietymobileExists, CompanyemailExists, CompanymobileExists] = await Promise.all([
            Society_Registration.findOne({ where: { email: req.body.email, id: { [Op.ne]: societyId }, status: { [Op.ne]: 'delete' } } }),
            Society_Registration.findOne({ where: { mobile_number: req.body.mobile_number, id: { [Op.ne]: societyId }, status: { [Op.ne]: 'delete' } } }),
            Company_Registration.findOne({ where: { email: req.body.email, id: { [Op.ne]: societyId }, status: { [Op.ne]: 'delete' } } }),
            Company_Registration.findOne({ where: { mobile_number: req.body.mobile_number, id: { [Op.ne]: societyId }, status: { [Op.ne]: 'delete' } } })
        ]);

        if (SocietyemailExists || CompanyemailExists) {
            return res.status(400).json({ status: 400, message: "Email already exists" });
        }

        if (SocietymobileExists || CompanymobileExists) {
            return res.status(400).json({ status: 400, message: "Mobile number already exists" });
        }
        // Update society registration
     const society_registrations = await Society_Registration.update({
            society_name: req.body.society_name,
            name: req.body.name,
            society_user_id:user_id,
            mobile_number: req.body.mobile_number,
            email: req.body.email,
            city_id: req.body.city_id,
            area_id,
            
            pincode: req.body.pincode,
            address: req.body.address,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            society_profile_img_path: imagePaths["society_profile_img_path"],
            society_profile_img_name: imageNames["society_profile_img_path"],
            modified_by: userId,
            modified_ip_address: req.ip,
            modified_type: societyType || userType
        }, {
            where: { id: societyId }
        });


        await profile.update({
            // society_id: user.id,
            society_id: societyId,
            society_user_id:user_id,
            number_of_flat: req.body.number_of_flat,
            society_email: req.body.society_email,
            whatsapp_group_name: req.body.whatsapp_group_name,
            number_of_members:req.body.number_of_members,
            society_whatsapp_img_path: imagePaths["society_whatsapp_img_path"],
            society_whatsapp_img_name: imageNames["society_whatsapp_img_path"],
            address_line_1: req.body.address_line_1,
            address_line_2: req.body.address_line_2,
            account_holder_name: req.body.account_holder_name,
            bank_name: req.body.bank_name,
            account_no: req.body.account_no,
            branch_name: req.body.branch_name,
            bank_ifsc_code: req.body.bank_ifsc_code,
            billing_address_line_1: req.body.billing_address_line_1,
            billing_address_line_2: req.body.billing_address_line_2,
            society_profile_img_1_path: updatedFields.society_profile_img_1_path || profile.society_profile_img_1_path,
            society_profile_img_2_path: updatedFields.society_profile_img_2_path || profile.society_profile_img_2_path,
            society_profile_img_3_path: updatedFields.society_profile_img_3_path || profile.society_profile_img_3_path,
            society_profile_img_4_path: updatedFields.society_profile_img_4_path || profile.society_profile_img_4_path,
            society_profile_img_5_path: updatedFields.society_profile_img_5_path || profile.society_profile_img_5_path,
            society_profile_img_1_name: updatedFields.society_profile_img_1_name || profile.society_profile_img_1_name,
            society_profile_img_2_name: updatedFields.society_profile_img_2_name || profile.society_profile_img_2_name,
            society_profile_img_3_name: updatedFields.society_profile_img_3_name || profile.society_profile_img_3_name,
            society_profile_img_4_name: updatedFields.society_profile_img_4_name || profile.society_profile_img_4_name,
            society_profile_img_5_name: updatedFields.society_profile_img_5_name || profile.society_profile_img_5_name,
        
            pan_card_path: imagePaths["pan_card_path"],
            pan_card_name: imageNames["pan_card_path"],
            gst_certificate_path: imagePaths["gst_certificate_path"],
            gst_certificate_name: imageNames["gst_certificate_path"],
            other_document_path: imagePaths["other_document_path"],
            other_document_name: imageNames["other_document_path"],
            google_page_url: req.body.google_page_url || '',
            // ads_per_day: req.body.ads_per_day,
            ads_per_day: req.body.ads_per_day === '' || req.body.ads_per_day === 'null'
            ? null
            : Number(req.body.ads_per_day), 
            modified_ip_address: req.ip,
            modified_by: userId,
            modified_type: societyType || userType,
            status: 'active'
        });

        const slots = JSON.parse(req.body.ads_slot) || [];

        console.log('slots', slots);
        
        const savedSlots = [];

        if (slots.length === 0) {
    // No new slots – delete all existing active slots for the society
    await Ads_Slot.update(
        {
            status: 'delete',
            modified_by: userId,
            modified_type: societyType || userType,
        },
        {
            where: {
                society_id: societyId,
                status: 'active',
            },
        }
    );
} else {
    // New slots provided – process them
    for (const slot of slots) {
        if (slot.is_checked) {
            const { days, from_time, to_time } = slot;

            // Soft delete existing active slot for same day
            await Ads_Slot.update(
                {
                    status: 'delete',
                    modified_by: userId,
                    modified_type: societyType || userType,
                },
                {
                    where: {
                        society_id: societyId,
                        days: days,
                        status: 'active',
                    },
                }
            );

            const savedSlot = await Ads_Slot.create({
                society_id: societyId,
                society_user_id: user_id,
                days: days,
                from_time: from_time,
                to_time: to_time,
                is_checked: true,
                created_by: userId,
                created_ip_address: req.ip,
                status: 'active',
                created_type: societyType || userType,
            });

            savedSlots.push(savedSlot);
        }
    }
}

        return res.status(200).json({
            status: 200,
            message: "Society details updated successfully",
            data: { society_registration:society_registrations , society_profile: profile, slot:savedSlots }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message  });
    }
};

exports.deleteSocietyProfileImage = async (req, res) => {
    try {
        const { profile_id, image_id } = req.body;

        if (!profile_id || !image_id) {
            return res.status(400).json({ status: 400, message: "Profile ID and image name are required" });
        }

        // Find the society profile by ID
        let profile = await Society_Profile.findOne({ where: { id: profile_id } });
        if (!profile) {
            return res.status(404).json({ status: 404, message: "Society profile not found" });
        }

        // Dynamically generate the field name based on imageName
        const imageField = `society_profile_img_${image_id}_path`;  // Construct the field name dynamically
        const imageNameField = `society_profile_img_${image_id}_name`;

        // if (!profile[imageField]) {
        //     return res.status(404).json({ status: 404, message: "Image not found in the database" });
        // }

        // Nullify the image field in the database
        await profile.update({
            [imageField]: null,  // Set the field to null after deleting the reference
            [imageNameField]: null 
        });

        return res.status(200).json({ status: 200, message: "Image deleted successfully" });

    } catch (error) {
        console.error("Error occurred:", error);
        return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
    }
};

exports.getCampaignDays = async (req, res) => {
    try {
        const campaign_days = await Campaign_Configuration.findOne({
            attributes: ['id', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'from_time', 'to_time'],
            where: { status: 'active' },
            order: [['createdAt', 'ASC']]
        });

        if (!campaign_days) {
            return res.status(404).json({ status: 404, message: 'Campaign days not found' });
        }

        const daysMap = [
            { key: 'mon', label: 'Monday' },
            { key: 'tue', label: 'Tuesday' },
            { key: 'wed', label: 'Wednesday' },
            { key: 'thu', label: 'Thursday' },
            { key: 'fri', label: 'Friday' },
            { key: 'sat', label: 'Saturday' },
            { key: 'sun', label: 'Sunday' }
        ];

        // Safe time formatting to "hh:mm AM/PM"
        const formatTime = (timeStr) => {
            if (!timeStr) return '--'; // or null based on your preference

            const [hour, minute] = timeStr.split(':');
            const date = new Date();
            date.setHours(hour);
            date.setMinutes(minute);
            return new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(date);
        };

        const fromFormatted = formatTime(campaign_days.from_time);
        const toFormatted = formatTime(campaign_days.to_time);

        const responseData = daysMap.map(day => ({
            day: day.label,
            from_time: fromFormatted,
            to_time: toFormatted,
            is_checked: !!campaign_days[day.key]
        }));

        return res.status(200).json({
            status: 200,
            message: 'Campaign days fetched successfully',
            data: responseData
        });

    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
};