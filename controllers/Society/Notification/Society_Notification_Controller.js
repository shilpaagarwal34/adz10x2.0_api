const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const  Society_User = require('@models/Society/Users/Society_User_Model');
const  Company_User = require('@models/Company/Users/Company_User_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { Op, Sequelize } = require('sequelize');

exports.societyNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user_type;
    let societyId = null;

    // Identify the societyId based on user type
    if (userType === 'Society_Admin') {
      const user = await Society_Registration.findOne({ where: { id: userId } });
      societyId = user?.id;
    } else if (userType === 'Society_User') {
      const societyUser = await Society_User.findOne({ where: { id: userId } });
      societyId = societyUser?.society_id;
    }

    if (!societyId) {
      return res.status(400).json({ status: 400, message: "Invalid society user" });
    }

    const notifications = await Notification.findAndCountAll({
      where: {
        status: 'active',
        read_type: 'unread',
        to: 'society',
        [Op.or]: [
          Sequelize.literal(`"society_ids"::jsonb @> '[${societyId}]'`),
          { society_ids: null }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 200,
      table_name: 'notifications',
      count: notifications.count,
      data: notifications.rows
    });

  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

exports.societyNotificationClearAll = async (req, res) => {
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