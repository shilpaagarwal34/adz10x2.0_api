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
            
            if (mainEntry && mainEntry.invoice_id) {
                // Update coupon bonus entry with receipt ID from main transaction
                await bonusEntry.update({
                    invoice_id: mainEntry.invoice_id
                });
                
                console.log(`✓ Updated entry ID ${bonusEntry.id}:`);
                console.log(`  Receipt ID: ${mainEntry.invoice_id}\n`);
            } else {
                console.log(`⚠ Main entry not found or has no invoice_id for coupon entry ID ${bonusEntry.id}`);
            }
        }
        
        await sequelize.close();
        console.log('✓ All coupon entries updated with Receipt IDs');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
