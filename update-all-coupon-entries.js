require('module-alias/register');
require('dotenv').config();

const Wallet = require('@models/Company/Wallet/Wallet_Model');
const sequelize = require('@config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');
        
        // Find all coupon bonus entries
        const couponEntries = await Wallet.findAll({
            where: {
                description: { [require('sequelize').Op.like]: '%Coupon Bonus%' }
            }
        });
        
        console.log(`Found ${couponEntries.length} coupon bonus entries\n`);
        
        for (const bonusEntry of couponEntries) {
            // Extract the main payment ID from transaction_id (COUPON-pay_xxx -> pay_xxx)
            const mainPaymentId = bonusEntry.transaction_id.replace('COUPON-', '');
            
            // Find the main payment entry
            const mainEntry = await Wallet.findOne({
                where: {
                    transaction_id: mainPaymentId,
                    description: 'Fund Credited'
                }
            });
            
            if (mainEntry) {
                // Update coupon bonus entry
                await bonusEntry.update({
                    razorpay_payment_id: `COUPON-${mainEntry.razorpay_payment_id}`,
                    razorpay_order_id: mainEntry.razorpay_order_id
                });
                
                console.log(`✓ Updated entry ID ${bonusEntry.id}:`);
                console.log(`  Payment ID: COUPON-${mainEntry.razorpay_payment_id}`);
                console.log(`  Transaction ID: ${mainEntry.razorpay_order_id}\n`);
            } else {
                console.log(`⚠ Main entry not found for coupon entry ID ${bonusEntry.id}`);
            }
        }
        
        await sequelize.close();
        console.log('✓ All coupon entries updated');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
