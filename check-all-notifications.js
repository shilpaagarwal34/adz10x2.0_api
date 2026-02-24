require('module-alias/register');
require('dotenv').config();

const Notification = require('@models/Notifications/Notification_Model');
const sequelize = require('@config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');
        
        // Check ALL recent notifications
        const allNotifications = await Notification.findAll({
            order: [['id', 'DESC']],
            limit: 10
        });
        
        console.log(`Found ${allNotifications.length} recent notifications:\n`);
        allNotifications.forEach(n => {
            console.log(`ID: ${n.id}`);
            console.log(`Company IDs: ${JSON.stringify(n.company_ids)}`);
            console.log(`Message: ${n.message ? n.message.substring(0, 60) + '...' : 'N/A'}`);
            console.log(`From: ${n.from}, To: ${n.to}, Type: ${n.types || 'N/A'}`);
            console.log(`Status: ${n.status}, Read: ${n.read_type}`);
            console.log(`Created: ${n.createdAt}`);
            console.log('---');
        });
        
        await sequelize.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
