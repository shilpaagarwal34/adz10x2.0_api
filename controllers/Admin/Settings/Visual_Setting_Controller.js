const Visual_Setting = require('@models/Admin/Settings/Visual_Model');
const path = require('path');

exports.visualSettingAddUpdate = async (req, res) => {
    try {
        const { id } = req.body;

        const userId = req.user?.id || null; // logged-in user ID
        const roleName = req.user?.role_name || null; // logged-in user role

        const imageFields = [
            "full_logo_image_path",
            "mini_logo_image_path",
            "logo_email_image_path"
        ];

        let imagePaths = {};
        let imageNames = {};

        imageFields.forEach(field => {
            if (req.files[field] && req.files[field][0]) {
                imagePaths[field] = `uploads/${req.files[field][0].filename}`;
                imageNames[field] = path.basename(req.files[field][0].filename);
            }
        });

        let result;

        if (id) {
            const existing = await Visual_Setting.findByPk(id);
            if (!existing) {
                return res.status(404).json({
                    status: 404,
                    message: "Record not found"
                });
            }

            await Visual_Setting.update({
                full_logo_image_path: imagePaths["full_logo_image_path"],
                full_logo_image_name: imageNames["full_logo_image_path"],
                mini_logo_image_path: imagePaths["mini_logo_image_path"],
                mini_logo_image_name: imageNames["mini_logo_image_path"],
                logo_email_image_path: imagePaths["logo_email_image_path"],
                logo_email_image_name: imageNames["logo_email_image_path"],
                modified_ip_address: req.ip,
                modified_by: userId,
                modified_type: roleName
            }, {
                where: { id: id }
            });

            result = await Visual_Setting.findByPk(id);

            return res.status(200).json({
                status: 200,
                message: "Visual settings updated successfully",
                data: result
            });

        } else {
            result = await Visual_Setting.create({
                full_logo_image_path: imagePaths["full_logo_image_path"],
                full_logo_image_name: imageNames["full_logo_image_path"],
                mini_logo_image_path: imagePaths["mini_logo_image_path"],
                mini_logo_image_name: imageNames["mini_logo_image_path"],
                logo_email_image_path: imagePaths["logo_email_image_path"],
                logo_email_image_name: imageNames["logo_email_image_path"],
                created_ip_address: req.ip,
                created_by: userId,
                created_type: roleName
            });

            return res.status(201).json({
                status: 201,
                message: "Visual settings created successfully",
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

exports.getVisualSetting = async (req, res) => {
    try {
        const visual = await Visual_Setting.findOne({
          where:{ status:'active' },
            order: [['id', 'ASC']]
        });

        if (!visual) {
            return res.status(404).json({ status:404,  message: 'Visual setting not found' });
        }

        return res.status(200).json({ status: 200, message: 'Data fetched successfully', data: visual });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};