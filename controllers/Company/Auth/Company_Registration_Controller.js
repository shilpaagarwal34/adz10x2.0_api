

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Notification = require('@models/Notifications/Notification_Model');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { where, Op } = require('sequelize');

// Configure AWS SES

const ses = new AWS.SES({ apiVersion: '2010-12-01' });

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
})

exports.companyRegistration = async (req, res) => {
    try {
        const requiredFields = {
            company_name: "Company name is required",
            // company_brand_name: "Company brand name is required",
            name: "Name is required",
            email: "Email is required",
            mobile_number: "Mobile number is required",
            city_id: "City is required",
            pincode: "Pincode is required",
            address_line_1: "Address is required",
            // address_line_2: "Address is required",
            // sector: "Sector is required",
            is_agree_terms_condition: "You must agree to the terms and conditions"
        };

        // Check for missing required fields
        for (let field in requiredFields) {
            if (!req.body[field]) {
                return res.status(400).json({ status: 400, message: requiredFields[field] });
            }
        }

    
        let { company_name, company_brand_name, name, mobile_number, email, city_id, area_id, area_name, pincode, address_line_1, address_line_2, sector, is_agree_terms_condition } = req.body;
        mobile_number = mobile_number.toString();

         // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: 400, message: "Invalid email format" });
        }

        // Validate City
        const city = await City.findByPk(city_id);
        if (!city) {
            return res.status(404).json({ status: 404, message: "City not found" });
        }

        // If area_id is missing but area_name is provided, create a new area
        if (!area_id && area_name) {
            const existingArea = await Area.findOne({ where: { area_name, city_id } });
            if (existingArea) {
                area_id = existingArea.id; // Use existing area ID
            } else {
                const newArea = await Area.create({ city_id, area_name, status: 'active', created_ip_address: req.ip });
                area_id = newArea.id; // Use newly created area ID
            }
        }

        // Check if Area exists
        if (!area_id) {
            return res.status(400).json({ status: 400, message: "Area Name is required" });
        }

        // Check if email or mobile number already exists
        // const emailExists = await Company_Registration.findOne({ where: { email } });
        // const mobileExists = await Company_Registration.findOne({ where: { mobile_number } });

        const emailExists = await Company_Registration.findOne({
                    where: {
                        email,
                        status: { [Op.ne]: 'delete' }   // not equal to 'deleted'
                    }
                });

                const mobileExists = await Company_Registration.findOne({
                    where: {
                        mobile_number,
                        status: { [Op.ne]: 'delete' }   // not equal to 'deleted'
                    }
                });

        if (emailExists) {
            return res.status(400).json({ status: 400, message: "Email already exists" });
        }
        if (mobileExists) {
            return res.status(400).json({ status: 400, message: "Mobile number already exists" });
        }

        // Generate a unique 6-digit OTP
        let otp;
        let isOtpUnique = false;
        while (!isOtpUnique) {
            otp = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit random number
            const existingOtp = await Company_Registration.findOne({ where: { otp } });
            if (!existingOtp) {
                isOtpUnique = true; // Ensure OTP is unique
            }
        }

            // Extract the part before '@' from the email
        const emailPrefix = email.split('@')[0];

        // Get the last 4 digits of the mobile number
        const mobileSuffix = mobile_number.slice(-4);

        // Form the password
        const password = `${emailPrefix}@${mobileSuffix}`;

        // Generate random password and hash it
        // const plaintextPassword = crypto.randomBytes(6).toString('hex');
        const hashedPassword = await bcrypt.hash(password, 10);

        // const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

        // Store company registration with updated area_id
        const newCompany = await Company_Registration.create({
            company_name,
            company_brand_name,
            user_type: 'Company_Admin',
            name,
            mobile_number,
            email,
            city_id,
            area_id,
            pincode,
            address_line_1,
            address_line_2,
            sector,
            is_agree_terms_condition,
            password: hashedPassword,
            // token,
            otp,
            is_otp_verified: '0'
        });

         if (!newCompany || !newCompany.id) {
            return res.status(500).json({ status: 500, message: "Failed to create company" });
        }

        const userType = 'Company_Admin';

        const token = jwt.sign(
            { email, id: newCompany.id, userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 4. Update the company record with the generated token
        await newCompany.update({ token });

        const formattedId = newCompany.id < 10 ? `0${newCompany.id}` : `${newCompany.id}`;
        const generatedPrefix = `ADZ10XCA${formattedId}`;

        await newCompany.update({ id_prifix_company: generatedPrefix });

        // Create Company_Profile using newCompany.id
        const newCompanyProfile = await Company_Profile.create({
            company_id: newCompany.id,
            created_ip_address: req.ip,
            created_by: newCompany.id, // Fixed variable reference
            status: 'active'
        });

             const baseUrl = process.env.BASE_URL;
        const logoUrl = `${baseUrl}/assets/adz10x-logo.png`;

          const emailParams = {
            Source: process.env.AWS_SES_EMAIL,
            Destination: {
                ToAddresses: [email]
            },
            Message: {
                Subject: {
                    Data: "Verify Your ADZ10X Signup"
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
                                <p>Hi ${newCompany.name},</p>
                                <p>Your OTP for verifying your ADZ10X account is <strong>[${otp}]</strong>. This OTP is valid for the next 10 minutes.</p>
                                <p>If you didn’t initiate this, please ignore this message.</p>
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

        // await ses.sendEmail(emailParams).promise();
                try {
                    const response = await ses.sendEmail(emailParams).promise();
                    console.log("OTP email sent successfully:", response);
                } catch (emailError) {
                    console.error("Failed to send email:", emailError.message);
                    // // Rollback: Delete newly created company and profile
                    // await Company_Profile.destroy({ where: { company_id: newCompany.id } });
                    // await Company_Registration.destroy({ where: { id: newCompany.id } });
        
                    return res.status(500).json({
                        status: 500,
                        message: "Registration failed: Unable to send OTP email. Please try again.",
                        error: emailError.message
                    });
                }

                        // --- WhatsApp sending in its own try/catch ---
        try {
            const axios = require('axios');

            const whatsappData = JSON.stringify({
                apiKey: process.env.AISENSY_API_KEY,           // Replace with your real API key
                campaignName: "registration_otp",
                destination: mobile_number,            // Use dynamic mobile number from req.body
                userName: "ADz10x.com",
                templateParams: [
                    otp.toString()
                ],
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
                                text: otp.toString()
                            }
                        ]
                    }
                ],
                carouselCards: [],
                location: {},
                attributes: {},
                paramsFallbackValue: {
                    FirstName: "user"
                }
            });

            const whatsappConfig = {
                method: 'post',
                maxBodyLength: Infinity,
                url: 'https://backend.aisensy.com/campaign/t1/api/v2',
                headers: { 
                    'Content-Type': 'application/json'
                },
                data: whatsappData
            };

            // Fire and forget, but wrapped in try/catch for logging
            axios.request(whatsappConfig)
                .then(res => console.log("WhatsApp OTP sent successfully:", res.data))
                .catch(err => console.error("Failed to send WhatsApp OTP:", err.message));

        } catch (waError) {
            console.error("Unexpected error while triggering WhatsApp OTP:", waError.message);
        }

          // Create notification
               let notification = await Notification.create({
                    company_ids: [newCompany.id], // Ensure this is handled as JSON in DB
                    message: `New company "${company_name}" has been registered.`,
                    from: 'company',
                    to: 'admin',
                    notify_type: 'individual',
                    created_ip_address: req.ip,
                    created_by: newCompany.id,
                });

        return res.status(201).json({
            status: 201,
            message: "Company registered successfully. Please verify OTP sent to your email/WhatsApp. Login details will be emailed after OTP verification.",
            data: {
                token,
                notification,
                // otp,
                companyProfile: newCompanyProfile // Updated response key
            },
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ status: 500, message: "Internal Server Error", error: error.message });
    }
};