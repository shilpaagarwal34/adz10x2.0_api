require('module-alias/register');
require('dotenv').config();

const Wallet = require('@models/Company/Wallet/Wallet_Model');
const sequelize = require('@config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');
        
        // Find the coupon bonus entry
        const bonusEntry = await Wallet.findOne({
            where: { transaction_id: 'COUPON-pay_SCrHmi4nvg2VqY' }
        });
        
        if (!bonusEntry) {
            console.log('Coupon bonus entry not found');
            await sequelize.close();
            return;
        }
        
        // Find the main payment entry
        const mainEntry = await Wallet.findOne({
            where: {
                transaction_id: 'pay_SCrHmi4nvg2VqY',
                description: 'Fund Credited'
            }
        });
        
        if (!mainEntry) {
            console.log('Main payment entry not found');
            await sequelize.close();
            return;
        }
        
        // Update coupon bonus entry with payment IDs from main entry
        await bonusEntry.update({
            razorpay_payment_id: mainEntry.razorpay_payment_id,
            razorpay_order_id: mainEntry.razorpay_order_id
        });
        
        console.log('✓ Updated coupon bonus entry:');
        console.log(`  Payment ID: ${mainEntry.razorpay_payment_id}`);
        console.log(`  Transaction ID: ${mainEntry.razorpay_order_id}`);
        
        await sequelize.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
