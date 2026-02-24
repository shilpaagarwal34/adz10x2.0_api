require('module-alias/register');
require('dotenv').config();

const Notification = require('@models/Notifications/Notification_Model');
const sequelize = require('@config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');
        
        // Check recent wallet_credit notifications
        const notifications = await Notification.findAll({
            where: { types: 'wallet_credit' },
            order: [['id', 'DESC']],
            limit: 5
        });
        
        console.log(`Found ${notifications.length} wallet_credit notifications:\n`);
        notifications.forEach(n => {
            console.log(`ID: ${n.id}`);
            console.log(`Company IDs: ${JSON.stringify(n.company_ids)}`);
            console.log(`Message: ${n.message}`);
            console.log(`From: ${n.from}, To: ${n.to}`);
            console.log(`Status: ${n.status}`);
            console.log(`Created: ${n.createdAt}`);
            console.log('---');
        });
        
        // Check all recent notifications for company
        const allCompanyNotifications = await Notification.findAll({
            where: {
                to: 'company',
                status: 'active'
            },
            order: [['id', 'DESC']],
            limit: 10
        });
        
        console.log(`\nAll company notifications (last 10): ${allCompanyNotifications.length}`);
        
        await sequelize.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
