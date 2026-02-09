const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Company_User = require('@models/Company/Users/Company_User_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { Op, Sequelize } = require('sequelize');

exports.companyNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user_type;
    let companyId = null;

    // Identify the companyId based on user type
    if (userType === 'Company_Admin') {
      const user = await Company_Registration.findOne({ where: { id: userId } });
      companyId = user?.id;
    } else if (userType === 'Company_User') {
      const companyUser = await Company_User.findOne({ where: { id: userId } });
      companyId = companyUser?.company_id;
    }

    if (!companyId) {
      return res.status(400).json({ status: 400, message: "Invalid company user" });
    }

    const notifications = await Notification.findAndCountAll({
      where: {
        status: 'active',
        read_type: 'unread',
        to: 'company',
        [Op.or]: [
          Sequelize.literal(`"company_ids"::jsonb @> '[${companyId}]'`),
          { company_ids: null }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 200,
      table_name: 'notifications',
      count: notifications.count,      // total count
      data: notifications.rows         // actual rows
    });

  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

exports.companyNotificationClearAll = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 400, message: 'No notification IDs provided.' });
    }

   let clearNotification = await Notification.update(
      { read_type: 'read' }, // Fields to update
      {
        where: {
          id: ids, // Assuming your primary key is `id`
        },
      }
    );

    return res.status(200).json({
      status: 200,
      message: 'Notifications marked as read successfully.',
      clearNotification
    });

  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};