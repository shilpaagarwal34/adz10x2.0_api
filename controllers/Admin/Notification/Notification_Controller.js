const Notification = require('@models/Notifications/Notification_Model');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
// JSON removed, Op and Sequelize retained
const { Op, Sequelize } = require('sequelize'); 
const sequelize = require('@config/db');

exports.adminNotification = async (req, res) => {
  try {
    const { role_name, id: userId } = req.user;

    // Base query for all notifications
    let notifications = await Notification.findAndCountAll({
      where: { 
        status: 'active',
        read_type: 'unread',
        to: 'admin'
      },
      order: [['createdAt', 'DESC']]
    });

    let filteredNotifications = notifications.rows;

    // If the logged-in user is a Relationship Manager
    if (role_name === 'RELATIONSHIP MANAGER') {
      // Fetch societies assigned to this RM
      const societies = await Society_Registration.findAll({
        where: { relationship_manager_id: userId, status: 'active' },
        attributes: ['id'],
      });
      const societyIds = societies.map(s => Number(s.id));

      // Fetch companies assigned to this RM
      const companies = await Company_Registration.findAll({
        where: { relationship_manager_id: userId, status: 'active' },
        attributes: ['id'],
      });
      const companyIds = companies.map(c => Number(c.id));

      // Filter notifications based on RM-assigned societies or companies
      filteredNotifications = notifications.rows.filter(noti => {
        // JSONB array of society_ids or company_ids in notification
        const notiSocieties = noti.dataValues.society_ids || [];
        const notiCompanies = noti.dataValues.company_ids || [];

        // Check if any of the IDs match
        const societyMatch = notiSocieties.some(id => societyIds.includes(Number(id)));
        const companyMatch = notiCompanies.some(id => companyIds.includes(Number(id)));

        return societyMatch || companyMatch;
      });
    }

    return res.status(200).json({
      status: 200,
      table_name: 'notifications',
      count: filteredNotifications.length,
      data: filteredNotifications
    });

  } catch (error) {
    return res.status(500).json({ status: 500, error: error.message });
  }
};

exports.adminNotificationss = async (req, res) => {
  try {
    const { role_name, id: userId } = req.user;

    // Default clause for all other users (admin, superadmin, etc.)
    let whereClause = {
      status: 'active',
      read_type: 'unread',
      to: 'admin',
    };

    // If the logged-in user is a Relationship Manager
    if (role_name === 'RELATIONSHIP MANAGER') {
      // Fetch societies assigned to this RM
      const societies = await Society_Registration.findAll({
        where: { relationship_manager_id: userId, status: 'active' },
        attributes: ['id'],
      });
      const societyIds = societies.map(s => Number(s.id));

      // Fetch companies assigned to this RM
      const companies = await Company_Registration.findAll({
        where: { relationship_manager_id: userId, status: 'active' },
        attributes: ['id'],
      });
      const companyIds = companies.map(c => Number(c.id));

      // If no societies or companies assigned → return empty result
      if (!societyIds.length && !companyIds.length) {
        return res.status(200).json({
          status: 200,
          table_name: 'notifications',
          count: 0,
          data: [],
        });
      }

      // Build where clause for RM to fetch only relevant notifications
      whereClause = {
        status: 'active',
        read_type: 'unread',
        to: 'admin', // Only admin notifications
        [Op.or]: [],
      };

     if (societyIds.length) {
  whereClause[Op.or].push(
    Sequelize.literal(`society_ids::jsonb ?| array[${societyIds.map(id => `'${id}'`).join(',')}]`)
  );
}

if (companyIds.length) {
  whereClause[Op.or].push(
    Sequelize.literal(`company_ids::jsonb ?| array[${companyIds.map(id => `'${id}'`).join(',')}]`)
  );
}

   // Fetch notifications based on constructed whereClause
const notifications = await Notification.findAndCountAll({
  where: whereClause,
  order: [['createdAt', 'DESC']],
});

// Log notifications for debugging
console.log('---Notifications for RM---');
console.log('Count:', notifications.count);
console.log('Rows:', notifications.rows.map(n => n.toJSON())); // Converts Sequelize instances to plain objects

// Return response
return res.status(200).json({
  status: 200,
  table_name: 'notifications',
  count: notifications.count,
  data: notifications.rows,
});
    }else{
      return "admin";
    }


  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: 500, error: error.message });
  }
};

exports.adminNotificationClearAll = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ status: 400, message: 'No notification IDs provided.' });
    }

   let clearNotification = await Notification.update(
      { read_type: 'read' },
      {
        where: {
          id: ids, 
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