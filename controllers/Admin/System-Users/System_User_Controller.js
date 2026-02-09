const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op, Sequelize, where } = require('sequelize');
const moment = require('moment-timezone');
const path = require('path');

exports.registerAdminSystemUser = async (req, res) => {
  try {
    const {id, user_type, user_name, email, password, mobile_no, role_name, privileges, role_id, address } = req.body;
    
    // Validate privileges is an array or object (optional but recommended)
    if (privileges && typeof privileges !== 'object') {
      return res.status(400).json({ message: 'Privileges must be an object or array.' });
    }
       // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ status: 400, message: "Invalid email format" });
    }
      // Handle multiple images dynamically 
      const imageFields = [
        'user_profile_image_path',
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
      const existingUser = await Master_Admin.findByPk(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found for update.' });
      }
      // Prevent email duplication on update
      const emailExists = await Master_Admin.findOne({
        where: { email, id: { [Op.ne]: id } }
      });
      if (emailExists) {
        return res.status(409).json({ message: 'Another admin already exists with this email.' });
      }

      // If password is provided, hash it
      let id_prifix_admins = existingUser.id_prifix_admin;
     
      const formattedId = existingUser.id < 10 ? `0${existingUser.id}` : `${existingUser.id}`;
      const updatedPrefix = `ADZ10XAU${formattedId}`;

      const updatedData = {
        user_type,
        user_name,
        email,
        mobile_no,
        role_name,
        privileges,
        role_id,
        address,
        user_profile_image_path:imagePaths["user_profile_image_path"],
        user_profile_image_name:imageNames["user_profile_image_path"],
        modified_ip_address:req.ip,
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
          user_name: existingUser.user_name,
          id_prifix_admin: id_prifix_admins,
          email: existingUser.email,
          mobile_no: existingUser.mobile_no,
          role_name: existingUser.role_name,
          privileges: existingUser.privileges,
          address: existingUser.address,
          user_profile_image_path:existingUser.user_profile_image_path,
          user_profile_image_name:existingUser.user_profile_image_name
        }
      });

    } else {
      // 🆕 Create logic
      const existingUser = await Master_Admin.findOne({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: 'Admin already exists with this email.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdmin = await Master_Admin.create({
        user_type,
        user_name,
        email,
        password: hashedPassword,
        mobile_no,
        role_name,
        privileges,
        role_id,
        address,
        user_profile_image_path: imagePaths["user_profile_image_path"],
        user_profile_image_name: imageNames["user_profile_image_path"],
        created_ip_address: req.ip,
        // created_by
      });

      const formattedId = newAdmin.id < 10 ? `0${newAdmin.id}` : `${newAdmin.id}`;
      const generatedPrefix = `ADZ10XAU${formattedId}`;

      await newAdmin.update({ id_prifix_admin: generatedPrefix });

      return res.status(201).json({
        message: 'New user registered successfully.',
        data: {
          id: newAdmin.id,
          id_prifix_admin: newAdmin.id_prifix_admin,
          user_name: newAdmin.user_name,
          email: newAdmin.email,
          mobile_no: newAdmin.mobile_no,
          role_name: newAdmin.role_name,
          privileges: newAdmin.privileges,
          user_profile_image_path: newAdmin.user_profile_image_path,
          user_profile_image_name:newAdmin.user_profile_image_name
        }
      });
    }
  } catch (error) {
    console.error('Error registering/updating admin:', error);
    return res.status(500).json({ message: 'Something went wrong.', error: error.message });
  }
};

exports.systemUserDataTable = async (req, res) => {
    try {
         // 1. Extract query parameters with fallbacks 
         const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || 10; 
         const search = req.query.search || ''; 
         const sortField = req.query.sortField || 'id'; 
         const sortOrder = req.query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Calculate offset for pagination
        const offset = (page - 1) * limit;

        // Create where clause for filtering
        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive'] // Include only active and inactive
            },
            id:{
              [Op.ne]:1
            }
        };

      if (search) {
        whereClause[Op.and] = {
            [Op.or]: [
                Sequelize.where(Sequelize.cast(Sequelize.col('id'), 'TEXT'), {
                    [Op.like]: `%${search}%`
                }),
                { user_name: { [Op.like]: `%${search}%` } },
                { id_prifix_admin: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { role_name: { [Op.like]: `%${search}%` } }
            ]
        };
    }

        // Count total records
        const total = await Master_Admin.count({ where: whereClause });

        // Get city data with pagination and sorting
        const Users = await Master_Admin.findAll({
        where: whereClause,
        offset,
        limit,
        order: [[sortField, sortOrder]],
        attributes: {
            exclude: ['password','access_token','otp','role_id','last_login','created_ip_address', 'modified_ip_address', 'created_by', 'modified_by', 'createdAt', 'updatedAt']
          }
        });

        return res.status(200).json({
            status: 200,
            table_name: 'master_admin',
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
   
exports.getUserById = async (req, res) => {
       try {
           const { id } = req.params;
           // Find city by ID and ensure it's active
           const user = await Master_Admin.findOne({
            // attributes: ['id', 'user_name', 'email', 'mobile_no', 'role_name'],
            attributes: ['id', 'user_name', 'email', 'mobile_no','role_name','privileges','address','user_profile_image_path','user_profile_image_name' ],
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