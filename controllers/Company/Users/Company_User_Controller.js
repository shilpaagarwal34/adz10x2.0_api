const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const  Company_User = require('@models/Company/Users/Company_User_Model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, Sequelize } = require('sequelize');
const path = require('path');

exports.registerCompanyUser = async (req, res) => {
  try {
       // 👇 Start by detecting where the user is coming from
        let companyId = null;
        let companyUserId = null;
        let companyType = null;
        let companyUserType = null;
    
        const userId = req.user.id;
        const userType = req.user_type;

        if (userType === 'Company_Admin') {
          companyId = userId;
          companyType = userType;
        } else if (userType === 'Company_User') {
          companyUserId = userId;
          companyUserType = userType;
    
          const companyUser = await Company_User.findOne({ where: { id: companyUserId } });
          companyId = companyUser.company_id;
        }
    

    const {
      id,
      user_type,
      user_name,
      email,
      password,
      mobile_number,
      role_name,
      privileges,
      address,
    } = req.body;

       // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: 400, message: "Invalid email format" });
        }

        // Common condition for email
    const emailExistsInOtherTables = await Promise.all([
     Company_User.findOne({ where: { email, ...(id ? { id: { [Op.ne]: id } } : {}) } }),
     Society_User.findOne({ where: { email } }),
      Society_Registration.findOne({ where: { email } }),
      Company_Registration.findOne({ where: { email } }),
    ]);

    if (emailExistsInOtherTables.some(record => record)) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

        // Common condition for mobile_no
    const mobileExistsInOtherTables = await Promise.all([
      Company_User.findOne({ where: { mobile_number, ...(id ? { id: { [Op.ne]: id } } : {}) } }),
      Society_User.findOne({ where: { email } }),
      Society_Registration.findOne({ where: { mobile_number } }),
      Company_Registration.findOne({ where: { mobile_number } }),
    ]);

    if (mobileExistsInOtherTables.some(record => record)) {
      return res.status(409).json({ message: 'Mobile number already exists.' });
    }

    // Validate privileges is an array or object (optional but recommended)
    if (privileges && typeof privileges !== 'object') {
      return res.status(400).json({ message: 'Privileges must be an object or array.' });
    }
      // Handle multiple images dynamically 
      const imageFields = [
        'company_profile_img_path',
      ];
        let imagePaths = {};
        let imageNames = {};

        imageFields.forEach(field => {
            if (req.files[field] && req.files[field][0]) {
                imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                imageNames[field] = path.basename(req.files[field][0].filename);
            }
        });

    // 🆕 Update logic
    if (id) {
      const existingUser = await Company_User.findByPk(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found for update.' });
      }

      // Prevent email duplication on update
      const emailExists = await Company_User.findOne({
        where: { email, id: { [Op.ne]: id } }
      });
      if (emailExists) {
        return res.status(409).json({ message: 'Another User already exists with this email.' });
      }

      let id_prifix_company_users = existingUser.id_prifix_company_user

      const updatedData = {
        company_id:companyId,
        // id_prifix_company_user: updatedPrefix,
        company_user_id:companyUserId,
        user_name,
        email,
        // password: updatedPassword,
        mobile_number,
        role_name,
        privileges,
        address,
        company_profile_img_path:imagePaths["company_profile_img_path"],
        company_profile_img_name:imageNames["company_profile_img_path"],
        modified_ip_address:req.ip,
        modified_by:companyUserId || companyId,
        modified_type:companyUserType || companyType,
      };


       // Only hash and update password if it's provided
            if (password && password.trim() !== '') {
                updatedData.password = await bcrypt.hash(password, 10);
            }

            await existingUser.update(updatedData);

      return res.status(200).json({
        status:200,
        message: 'User updated successfully.',
        data: {
          id: existingUser.id,
          id_prifix_company_user: id_prifix_company_users,
          user_type:existingUser.user_type,
          user_type:existingUser.user_type,
          user_name: existingUser.user_name,
          company_id:existingUser.company_id,
          company_user_id: existingUser.company_user_id,
          email: existingUser.email,
          mobile_number: existingUser.mobile_number,
          role_name: existingUser.role_name,
          privileges: existingUser.privileges,
          address: existingUser.address,
          company_profile_img_path:existingUser.company_profile_img_path,
          company_profile_img_name:existingUser.company_profile_img_name,
          modified_by: existingUser.modified_by,
          modified_type: existingUser.modified_type,
          status: existingUser.status
        }
      });

    } else {
      // 🆕 Create logic
      const existingUser = await Company_User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists with this email.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = await Company_User.create({
        user_type: 'Company_User',
        company_id:companyId,
        company_user_id:companyUserId,
        user_name,
        email,
        password: hashedPassword,
        mobile_number,
        role_name,
        privileges,
        address,
        company_profile_img_path: imagePaths["company_profile_img_path"],
        company_profile_img_name: imageNames["company_profile_img_path"],
        created_ip_address: req.ip,
        created_by:companyUserId || companyId,
        created_type:companyUserType || companyType,
      });

      const formattedId = newAdmin.id < 10 ? `0${newAdmin.id}` : `${newAdmin.id}`;
      const generatedPrefix = `ADZ10XCU${formattedId}`;

      await newAdmin.update({ id_prifix_company_user: generatedPrefix });

      return res.status(201).json({
        status:201,
        message: 'New user registered successfully.',
        data:newAdmin
      });
    }
  } catch (error) {
    console.error('Error registering/updating admin:', error);
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

exports.systemCompanyDataTable = async (req, res) => {
    try {
         // 1. Extract query parameters with fallbacks 
         const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || 10; 
         const search = req.query.search || ''; 
  
        // Calculate offset for pagination
        const offset = (page - 1) * limit;


        const loggedInUser = req.user;
        const userType = loggedInUser?.user_type;
        const userId = loggedInUser?.id;

        if (!userType || !userId) {
          return res.status(401).json({ status: 401, message: "Unauthorized. User info missing." });
        }

        // Create where clause for filtering
        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive'] // Include only active and inactive
            },
        };

               // Apply company-based filtering
               if (req.user_type === 'Company_Admin') {
                  whereClause.company_id = req.user.id; // Company_Admin's ID
              } else if (req.user_type === 'Company_User') {
                  whereClause.company_id = req.user.company_id; // Company_User's company ID
              }

      if (search) {
        whereClause[Op.and] = {
            [Op.or]: [
                Sequelize.where(Sequelize.cast(Sequelize.col('id'), 'TEXT'), {
                    [Op.like]: `%${search}%`
                }),
                { id_prifix_company_user: { [Op.like]: `%${search}%` } },
                { user_name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { role_name: { [Op.like]: `%${search}%` } }
            ]
        };
    }

        // Count total records
        const total = await Company_User.count({ where: whereClause });

        // Get city data with pagination and sorting
        const Users = await Company_User.findAll({
        where: whereClause,
        offset,
        limit,
        attributes: {
            exclude: ['token','otp','last_login','created_ip_address', 'modified_ip_address', 'created_by', 'modified_by', 'createdAt', 'updatedAt']
          }
        });

        return res.status(200).json({
            status: 200,
            table_name: 'company_user',
            message: 'Users fetched successfully',
            total,
            page,
            limit,
            data: Users
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch users",
            error: err.message
        });
    }
};

exports.getCompanyUserById = async (req, res) => {
       try {
           const { id } = req.params;
   
           // Find city by ID and ensure it's active
           const user = await Company_User.findOne({
            // attributes: ['id', 'user_name', 'email', 'mobile_no', 'role_name'],
            attributes: ['id','company_id', 'id_prifix_company_user', 'user_name', 'email', 'mobile_number','role_name','password','privileges','address','company_profile_img_path','company_profile_img_name' ],
               where: {
                   id,
                   status: {
                       [Op.in]: ['active', 'inactive'] // Include only active and inactive
                   }
               }
           });
   
           if (!user) {
               return res.status(404).json({ message: 'Active user not found' });
           }

           const userData = user.toJSON();
            if(Array.isArray(userData.privileges)){
              userData.privileges = userData.privileges.join(',');
            }
           return res.status(200).json({ status: 200, data: userData , message:"User fetched successfully" });
       } catch (err) {
           res.status(500).json({ error: err.message });
       }
};

exports.changeCompanyPassword = async (req, res) => {
       try {
         const { old_password, new_password } = req.body;
     
         if (!old_password || !new_password) {
           return res.status(400).json({ message: 'Old and new passwords are required.' });
         }
     
         const userId = req.user?.id;
         const userType = req.user?.user_type;
     
         if (!userId || !userType) {
           return res.status(401).json({ message: 'Unauthorized. User details not found.' });
         }
     
         let user;
         if (userType === 'Company_Admin') {
           user = await Company_Registration.findByPk(userId);
         } else if (userType === 'Company_User') {
           user = await Company_User.findByPk(userId);
         } else {
           return res.status(400).json({ message: 'Invalid user type.' });
         }
     
         if (!user) {
           return res.status(404).json({ message: 'User not found.' });
         }
     
         const isMatch = await bcrypt.compare(old_password, user.password);
         if (!isMatch) {
           return res.status(401).json({ message: 'Old password is incorrect.' });
         }
     
         if (new_password.length < 6) {
           return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
         }
     
         const isSame = await bcrypt.compare(new_password, user.password);
         if (isSame) {
           return res.status(400).json({ message: 'New password cannot be the same as old password.' });
         }
     
         const hashedPassword = await bcrypt.hash(new_password, 10);
         await user.update({
           password: hashedPassword,
           modified_ip_address: req.ip
         });
     
         return res.status(200).json({ message: 'Password changed successfully.' });
     
       } catch (error) {
         console.error('Error in changeCompanyPassword:', error);
         return res.status(500).json({ message: 'Something went wrong.', error: error.message });
       }
};
     
exports.deleteCompanyAccount = async (req, res) => {
    try {
      const { id, user_type } = req.user;
  
      if (user_type === 'Company_Admin') {
        // Soft delete all users under this society
        await Company_User.update(
          { status: 'delete' },
          { where: { company_id: id } }
        );
  
        // Soft delete the society record
        const companyUpdate = await Company_Registration.update(
          { status: 'delete' },
          { where: { id } }
        );
  
        if (companyUpdate[0] === 0) {
          return res.status(404).json({ status: 404, message: 'Company not found.' });
        }
  
        return res.status(200).json({
          status: 200,
          message: 'Company and all related users marked as deleted.',
        });
  
      } else if (user_type === 'Company_User') {
        // First, get the user's record to find the society_id
        const user = await Company_User.findOne({ where: { id } });
  
        if (!user) {
          return res.status(404).json({ status: 404, message: 'User not found.' });
        }
  
        // Soft delete the user account
        await Company_User.update(
          { status: 'delete' },
          { where: { id } }
        );
  
        return res.status(200).json({
          delete_id:id,
          status: 200,
          message: 'User account and associated company marked as deleted.',
        });
  
      } else {
        return res.status(400).json({ status: 400, message: 'Invalid user type.' });
      }
  
    } catch (error) {
      console.error('Error deleting account:', error);
      return res.status(500).json({
        status: 500,
        message: 'Something went wrong.',
        error: error.message,
      });
    }
};