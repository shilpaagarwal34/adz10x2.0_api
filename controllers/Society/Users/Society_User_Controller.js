const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const  Company_User = require('@models/Company/Users/Company_User_Model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, Sequelize } = require('sequelize');
const path = require('path');

exports.registerSocietyUser = async (req, res) => {
  try {
  
    // 👇 Start by detecting where the user is coming from
    let societyId = null;
    let societyUserId = null;
    let societyType = null;
    let societyUserType = null;

    const userId = req.user.id;
    const userType = req.user_type;

    if (userType === 'Society_Admin') {
      societyId = userId;
      societyType = userType;
    } else if (userType === 'Society_User') {
      societyUserId = userId;
      societyUserType = userType;

      const societyUser = await Society_User.findOne({ where: { id: societyUserId } });
      societyId = societyUser.society_id;
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
      society_profile_img_path
    } = req.body;

       // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ status: 400, message: "Invalid email format" });
        }

        // Common condition for email
    const emailExistsInOtherTables = await Promise.all([
      Society_User.findOne({ where: { email, ...(id ? { id: { [Op.ne]: id } } : {}) } }),
      Company_User.findOne({ where: { email } }),
      Society_Registration.findOne({ where: { email } }),
      Company_Registration.findOne({ where: { email } }),
    ]);

    if (emailExistsInOtherTables.some(record => record)) {
      return res.status(409).json({ message: 'Email already exists.' });
    }

        // Common condition for mobile_no
    const mobileExistsInOtherTables = await Promise.all([
      Society_User.findOne({ where: { mobile_number, ...(id ? { id: { [Op.ne]: id } } : {}) } }),
      Company_User.findOne({ where: { email } }),
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
        'society_profile_img_path',
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
      const existingUser = await Society_User.findByPk(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found for update.' });
      }

      // Prevent email duplication on update
      const emailExists = await Society_User.findOne({
        where: { email, id: { [Op.ne]: id } }
      });
      if (emailExists) {
        return res.status(409).json({ message: 'Another User already exists with this email.' });
      }

      let id_prifix_societys = existingUser.id_prifix_society_user;
      
      // const formattedId = existingUser.id < 10 ? `0${existingUser.id}` : `${existingUser.id}`;
      // const updatedPrefix = `ADZ10XSU${formattedId}`;

      const updatedData = {
        society_id:societyId,
        // id_prifix_society: updatedPrefix,
        society_user_id:societyUserId,
        user_name,
        email,
        mobile_number,
        role_name,
        privileges,
        address,
        society_profile_img_path:imagePaths["society_profile_img_path"],
        society_profile_img_name:imageNames["society_profile_img_path"],
        modified_ip_address:req.ip,
        modified_by:societyUserId || societyId,
        modified_type:societyUserType || societyType,
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
          id_prifix_society_user:id_prifix_societys,
          user_name: existingUser.user_name,
          user_type: existingUser.user_types,
          society_id:existingUser.society_id,
          society_user_id: existingUser.society_user_id,
          email: existingUser.email,
          mobile_number: existingUser.mobile_number,
          role_name: existingUser.role_name,
          privileges: existingUser.privileges,
          address: existingUser.address,
          society_profile_img_path:existingUser.society_profile_img_path,
          society_profile_img_name:existingUser.society_profile_img_name,
          modified_by: existingUser.modified_by,
          modified_type: existingUser.modified_type,
          status: existingUser.status
        }
      });

    } else {
      // 🆕 Create logic
      const existingUser = await Society_User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists with this email.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = await Society_User.create({
        // user_type: 'Society User',
        user_type:"Society_User",
        society_id:societyId,
        society_user_id:societyUserId,
        user_name,
        email,
        password: hashedPassword,
        mobile_number,
        role_name,
        privileges,
        address,
        society_profile_img_path: imagePaths["society_profile_img_path"],
        society_profile_img_name: imageNames["society_profile_img_path"],
        created_ip_address: req.ip,
        created_by:societyUserId || societyId,
        created_type:societyUserType || societyType,
      });

      const formattedId = newAdmin.id < 10 ? `0${newAdmin.id}` : `${newAdmin.id}`;
      const generatedPrefix = `ADZ10XSU${formattedId}`;

      await newAdmin.update({ id_prifix_society_user: generatedPrefix });

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

exports.systemSocietyDataTable = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    const loggedInUser = req.user;
    const userType = loggedInUser?.user_type;
    const userId = loggedInUser?.id;

    if (!userType || !userId) {
      return res.status(401).json({ status: 401, message: "Unauthorized. User info missing." });
    }

    // Base condition
    const whereClause = {
      status: {
        [Op.in]: ['active', 'inactive']
      }
    };

    // Filter based on user_type
    if (userType === 'Society_Admin') {
      whereClause.society_id = userId; // `id` in JWT = society_id
    } else if (userType === 'Society_User') {
      // whereClause.id = userId; // show only own record
      const loggedInUser = await Society_User.findOne({
              where: { id: userId, status: 'active' }
            });
            if (!loggedInUser) {
              return res.status(404).json({ message: 'Society user not found or inactive.' });
            }
            // Now use this to fetch only records created by this company_user_id
            whereClause.society_user_id = loggedInUser.society_user_id;
    }

    // Add search filters
    if (search) {
      whereClause[Op.and] = {
        [Op.or]: [
          Sequelize.where(Sequelize.cast(Sequelize.col('id'), 'TEXT'), {
            [Op.like]: `%${search}%`
          }),
          { id_prifix_society_user: { [Op.like]: `%${search}%` } },
          { user_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { role_name: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    // Total count
    const total = await Society_User.count({ where: whereClause });

    // Fetch data
    const Users = await Society_User.findAll({
      where: whereClause,
      offset,
      limit,
      attributes: {
        exclude: [
           'token', 'otp', 'last_login',
          'created_ip_address', 'modified_ip_address',
          'created_by', 'modified_by', 'createdAt', 'updatedAt'
        ]
      }
    });

    return res.status(200).json({
      status: 200,
      table_name: 'society_user',
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

exports.getSocietyUserById = async (req, res) => {
       try {
           const { id } = req.params;
   
           // Find city by ID and ensure it's active
           const user = await Society_User.findOne({
            // attributes: ['id', 'user_name', 'email', 'mobile_no', 'role_name'],
            attributes: ['id','society_id', 'id_prifix_society_user', 'user_name', 'email', 'mobile_number','role_name','password','privileges','address','society_profile_img_path','society_profile_img_name' ],
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

exports.changeSocietyPassword = async (req, res) => {
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
      if (userType === 'Society_Admin') {
        user = await Society_Registration.findByPk(userId);
      } else if (userType === 'Society_User') {
        user = await Society_User.findByPk(userId);
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
      console.error('Error in changeSocietyPassword:', error);
      return res.status(500).json({ message: 'Something went wrong.', error: error.message });
    }
};
  
exports.logoutSociety = async (req, res) => {
    try {
      // Just instruct client to delete the token
      return res.status(200).json({
        status: 200,
        message: 'Logged out successfully.',
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        message: 'Something went wrong during logout.',
        error: error.message,
      });
    }
};

exports.deleteSocietyAccount = async (req, res) => {
  try {
    const { id, user_type } = req.user;

    if (user_type === 'Society_Admin') {
      // Soft delete all users under this society
      await Society_User.update(
        { status: 'delete' },
        { where: { society_id: id } }
      );

      // Soft delete the society record
      const societyUpdate = await Society_Registration.update(
        { status: 'delete' },
        { where: { id } }
      );

      if (societyUpdate[0] === 0) {
        return res.status(404).json({ status: 404, message: 'Society not found.' });
      }

      return res.status(200).json({
        status: 200,
        message: 'Society and all related users marked as deleted.',
      });

    } else if (user_type === 'Society_User') {
      // First, get the user's record to find the society_id
      const user = await Society_User.findOne({ where: { id } });

      if (!user) {
        return res.status(404).json({ status: 404, message: 'User not found.' });
      }

      // Soft delete the user account
      await Society_User.update(
        { status: 'delete' },
        { where: { id } }
      );

      return res.status(200).json({
        delete_id:id,
        status: 200,
        message: 'User account and associated society marked as deleted.',
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