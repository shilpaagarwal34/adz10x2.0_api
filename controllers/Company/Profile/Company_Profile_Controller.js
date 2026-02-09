const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Sector = require('@models/Admin/Master/Sector_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const { Op, where } = require("sequelize");
const path = require('path');

exports.getCompanyProfile = async (req, res) => {
     try {
          // Get token from header or query
        let rawToken = req.headers['authorization'] || req.query.token;

        if (!rawToken) {
            return res.status(401).json({ status: 401, message: "Token is required" });
        }
         // Remove "Bearer " prefix if present
         const cleanToken = rawToken.replace("Bearer ", "");

        let user = null;
        let userType = null;
        let companyId = null;
    
           // Find the user using the token
          user = await Company_Registration.findOne({ where: { token: cleanToken } });
          if (user) {
            userType = 'Company_Admin';
            companyId = user.id;
          }

           // If not found, try Society_User
                 if (!user) {
                     user = await Company_User.findOne({ where: { token: cleanToken } });
                     if (user) {
                         userType = 'Company_User';
                         companyId = user.company_id; // Use `society_id` field from Society_User
                     }
                 }
 
         if (!user) {
             return res.status(404).json({ status: 404, message: "User not found or invalid token" });
         }

        const check_edit = await Company_Registration.findOne({ where:{ id: companyId } });
            
         // Fetch company profile using company_id
         const company_profile = await Company_Profile.findOne({ where: { company_id: companyId } });

          if(userType = 'Company_User')
                {
                    user = await Company_Registration.findOne({ where: { id: companyId } });
                }
 
         if (!company_profile) {
             return res.status(404).json({ status: 404, message: "Company profile not found" });
         }

         // ✅ Get sector name from Sector table
        let sector_name = null;
        let sector_id = null;
        if (user.sector) {
            const sector = await Sector.findOne({ where: { id: user.sector } });
            if (sector) {
                sector_name = sector.sector_name;
                sector_id = sector.id;
            }
        }

        let completion = 0;

        // 1. Basic Society Details (20%)
const basicDetails = [
   user.company_name?.trim(),
   user.email?.trim(),
   user.company_brand_name?.trim(),
   user.sector?.trim(),
   user.company_profile_photo_path?.trim(),
   user.mobile_number?.trim(),
   company_profile.website?.trim()
];
const filledBasic = basicDetails.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledBasic / basicDetails.length) * 20;

// 2. Contact Information (20%)
const contactInfo = [
   user.name?.trim(),
   company_profile.company_mobile_number?.trim(),
   company_profile.company_email_id?.trim()
];
const filledContact = contactInfo.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledContact / contactInfo.length) * 20;

// 3. Society Location (20%)
const location = [
   user.city_id,
   user.area_id,
   user.pincode,
   user.address_line_1?.trim()
//    user.address_line_2?.trim()
];
const filledLocation = location.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledLocation / location.length) * 20;

// 4. Billing Details (20%)
const billing = [
    company_profile.party_name?.trim(),
    company_profile.gst_number?.trim(),
    company_profile.billing_address_line_1?.trim()
];
const filledBilling = billing.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledBilling / billing.length) * 20;

// 5. Advertisement Settings (20%)
const card = [
   company_profile.pan_card_path,
   company_profile.gst_certificate_path,
   company_profile.other_document_path
];
const filledAds = card.filter(field => field !== null && field !== undefined && field !== '').length;
completion += (filledAds / card.length) * 20;

const profileCompletion = Math.round(completion);
 
         return res.status(200).json({
             status: 200,
             message: "Company profile retrieved successfully",
             data: {
                profile_completion: profileCompletion,
               company_registration: {
                    id: user.id,
                    company_name: user.company_name,
                    user_type: user.user_type,
                    company_brand_name: user.company_brand_name,
                    company_profile_photo_path:user.company_profile_photo_path,
                    name: user.name,
                    email: user.email,
                    token: user.token, 
                    mobile_number: user.mobile_number,
                    city_id: user.city_id,
                    area_id: user.area_id,
                    is_otp_verified: user.is_otp_verified,
                    pincode: user.pincode,
                    address_line_1: user.address_line_1,
                    address_line_2: user.address_line_2,
                    // sector: user.sector,
                    sector_id: sector_id,
                    sector:sector_name,
                    account_status: user.account_status,
                    reletionship_manager_id: null,
                    amount: user.amount,
                    kyc_status: user.kyc_status,
                    company_aggrement_copy_path: user.company_aggrement_copy_path,
                    is_agree_terms_condition: user.is_agree_terms_condition,
                    company_profile: company_profile || null,
                    edit_permission: check_edit.allow_edit
               }
             }
         });
 
     } catch (error) {
         console.error(error);
         return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message  });
     }
}

exports.companyProfileUpdate = async (req, res) => {
    try{
         token = req.body.token || req.headers.authorization || req.body;

         if(!token){
              return res.status(400).json({
                   status:400,
                   message:"Token is required"
              });
         }

         const cleanToken = token.replace("Bearer ", "");

         let CompanyType = null;
         let UserType = null

           // Find user by token
                 let user = await Company_Registration.findOne({ where: { token: cleanToken } });
                     if (user) {
                        CompanyType = 'Company_Admin';
                         companyId = user.id;
                     }

                     let user_id = null;
                      // Try Society_User if not found
                 if (!user) {
                      user = await Company_User.findOne({ where: { token: cleanToken } });
                     
                     if (user) {
                         UserType = 'Company_User';
                         user_id  = user.id;
                         companyId = user.company_id;
                         // user = user.society_id
                     }
                 }
         
        const check_edit = await Company_Registration.findOne({ where:{ id: companyId } });
            
       if (check_edit.kyc_status === 'approved') {
                if (!check_edit.allow_edit) {
                    return res.status(403).json({
                        status: 403,
                        message: "Allow edit permission for admin."
                    });
                }
        }

         const profile = await Company_Profile.findOne({ where:{ company_id:companyId } })

         if(!profile){
              return res.status(400).json({
                   status:400,
                   message: "Company profile not found, please create first"
              });
         }

         const requiredFields = {
              company_name: "Company name is required",
              company_brand_name: "Company brand name is required",
              name: "Name is required",
              email: "Email is required",
              mobile_number: "Mobile number is required",
              city_id: "City is required",
              pincode: "Pincode is required",
              address_line_1: "Address is required",
            //   address_line_2: "Address is required",
              sector: "Sector is required",
         }

         for (let field in requiredFields) {
           if (!req.body[field]) {
               return res.status(400).json({ status:400, message: requiredFields[field] });
           }
       }
       
       // Handle multiple images dynamically 
       const imageFields = [
         'company_profile_photo_path',
         'pan_card_path',
         'gst_certificate_path',
         'other_document_path'
       ];
    
         let imagePaths = {};
         let imageNames = {};
 
         imageFields.forEach(field => {
             if (req.files[field] && req.files[field][0]) {
                 imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                 imageNames[field] = path.basename(req.files[field][0].filename);
             }
         });
         
         // Validate city
         const city = await City.findByPk(req.body.city_id);
         if (!city) {
              return res.status(404).json({ status:404, message: "City not found" });
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

        mobile_numbers = req.body.mobile_number.toString();
               // Run all queries in parallel using Promise.all()
       const [SocietyemailExists, SocietymobileExists, CompanyemailExists, CompanymobileExists] = await Promise.all([
           Society_Registration.findOne({ where: { email: req.body.email, id: { [Op.ne]: companyId }, status: { [Op.ne]: 'delete' } } }),
           Society_Registration.findOne({ where: { mobile_number: mobile_numbers, id: { [Op.ne]: companyId }, status: { [Op.ne]: 'delete' } } }),
           Company_Registration.findOne({ where: { email: req.body.email, id: { [Op.ne]: companyId }, status: { [Op.ne]: 'delete' } } }),
           Company_Registration.findOne({ where: { mobile_number: mobile_numbers, id: { [Op.ne]: companyId }, status: { [Op.ne]: 'delete' } } })
       ]);

       if (SocietyemailExists || CompanyemailExists) {
           return res.status(400).json({ status: 400, message: "Email already exists" });
       }

       if (SocietymobileExists || CompanymobileExists) {
           return res.status(400).json({ status: 400, message: "Mobile number already exists" });
       }
       
          // Update company registration
        await Company_Registration.update({
           company_name: req.body.company_name,
           company_user_id:user_id ,
           company_brand_name: req.body.company_brand_name,
           company_profile_photo_path: imagePaths["company_profile_photo_path"],
           company_profile_photo_name: imageNames["company_profile_photo_path"],
           email: req.body.email,
           name: req.body.name,
           mobile_number: mobile_numbers,
           city_id: req.body.city_id,
           area_id,
           pincode: req.body.pincode,
           address_line_1:req.body.address_line_1,
           address_line_2:req.body.address_line_2,
           sector: req.body.sector,
           party_name: req.body.party_name,
           gst_number: req.body.gst_number,
           modified_by: user.id,
           modified_ip_address: req.ip,
           modified_type: CompanyType || UserType
       }, {
        where: { id: companyId }
    });

       await profile.update({
            company_id: companyId,
            company_user_id:user_id,
            website: req.body.website,
            company_email_id: req.body.company_email_id,
            company_mobile_number: req.body.company_mobile_number,
            account_holder_name: req.body.account_holder_name,
            bank_name:req.body.bank_name,
            account_no: req.body.account_no,
            branch_name: req.body.branch_name,
            bank_ifsc_code: req.body.bank_ifsc_code,
            billing_address_line_1: req.body.billing_address_line_1,
            billing_address_line_2: req.body.billing_address_line_2,
            party_name: req.body.party_name,
            gst_number: req.body.gst_number,
            pan_card_path: imagePaths["pan_card_path"],
            pan_card_name: imageNames["pan_card_path"],
            gst_certificate_path: imagePaths["gst_certificate_path"],
            gst_certificate_name: imageNames["gst_certificate_path"],
            other_document_path: imagePaths["other_document_path"],
            other_document_name: imageNames["other_document_path"],
            modified_ip_address: req.ip,
            modified_by: user.id,
            modified_type: CompanyType || UserType,
            status: 'active'
       });
       
       return res.status(200).json({
           status:200,
           message: "Company details updated successfully",
           data: { company_registration: user, company_profile: profile  }
       });
    }catch (error){
         return res.status(500).json({ status:500, message:"Internal Server Error", error:error.message });
    }
}
