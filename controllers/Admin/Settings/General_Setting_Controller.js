const General_Setting = require('@models/Admin/Settings/General_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const bcrypt = require('bcryptjs');

exports.generalSettingAddUpdate = async (req, res) => {
    try {
        const {
            id,
            email,
            mobile_no,
            address,
            facebook_url,
            linkedin_url,
            instagram_url,
            twitter_url,
            skype_url
        } = req.body;

        const userId = req.user?.id || null;
        const roleName = req.user?.role_name || null;

        let result;

        console.log('ids', id);
        

        if (id) {
            const existing = await General_Setting.findByPk(id);
            if (!existing) {
                return res.status(404).json({
                    status: 404,
                    message: "Record not found"
                });
            }

            await General_Setting.update({
                email,
                mobile_no,
                address,
                facebook_url,
                linkedin_url,
                instagram_url,
                twitter_url,
                skype_url,
                modified_ip_address: req.ip,
                modified_by: userId,
                modified_type: roleName
            }, {
                where: { id: id }
            });

            // Fetch updated data
            result = await General_Setting.findByPk(id);

            return res.status(200).json({
                status: 200,
                message: "Data updated successfully",
                data: result
            });

        } else {
            result = await General_Setting.create({
                email,
                mobile_no,
                address,
                facebook_url,
                linkedin_url,
                instagram_url,
                twitter_url,
                skype_url,
                created_ip_address: req.ip,
                created_by: userId,
                created_type: roleName
            });

            return res.status(201).json({
                status: 201,
                message: "Data created successfully",
                data: result
            });
        }

    } catch (error) {
        return res.status(500).json({
            status: 500,
            message: "Internal server error",
            error: error.message
        });
    }
};

exports.getGeneralSetting = async (req, res) => {
    try {
        const general = await General_Setting.findOne({
          where:{ status:'active' },
            order: [['id', 'ASC']]
        });

        if (!general) {
            return res.status(404).json({ status:404,  message: 'General setting not found' });
        }

        return res.status(200).json({ status: 200, message: 'General fetched successfully', data: general });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { old_password, new_password, confirm_password } = req.body;

    // Step 1: Basic Validation
    if (!old_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'Old, new, and confirm passwords are required.' });
    }

    const userId = req.user?.id || null;
    const roleName = req.user?.role_name || null;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. User details not found.' });
    }

    // Step 3: Fetch the admin user
    const user = await Master_Admin.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Step 4: Validate old password
    const isMatch = await bcrypt.compare(old_password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Old password is incorrect.' });
    }

      // Step 2: Check confirm password matches
    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'New password and confirm password do not match.' });
    }

    // Step 5: Password length check
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    // Step 6: Prevent reusing old password
    const isSame = await bcrypt.compare(new_password, user.password);
    if (isSame) {
      return res.status(400).json({ message: 'New password cannot be the same as old password.' });
    }

    // Step 7: Hash and save new password
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await user.update({
      password: hashedPassword,
      modified_ip_address: req.ip,
      modified_by: userId,
      modified_type: roleName
    });

    return res.status(200).json({ message: 'Password changed successfully.' });

  } catch (error) {
    console.error('Error in changeAdminPassword:', error);
    return res.status(500).json({
      message: 'Something went wrong.',
      error: error.message
    });
  }
};
