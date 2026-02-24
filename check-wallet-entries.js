require('module-alias/register');
require('dotenv').config();

const Wallet = require('@models/Company/Wallet/Wallet_Model');
const sequelize = require('@config/db');

(async () => {
    try {
        await sequelize.authenticate();
        console.log('✓ Database connected\n');
        
        const recentWallets = await Wallet.findAll({
            order: [['id', 'DESC']],
            limit: 10,
            attributes: ['id', 'amount', 'description', 'coupon_code', 'transaction_id', 'createdAt', 'company_id']
        });
        
        console.log('Recent wallet entries (last 10):');
        console.log('='.repeat(80));
        recentWallets.forEach(w => {
            console.log(`ID: ${w.id} | Amount: ₹${w.amount} | Desc: ${w.description} | Coupon: ${w.coupon_code || 'none'} | TXN: ${w.transaction_id}`);
        });
        console.log('='.repeat(80));
        
        // Check for coupon bonus entries specifically
        const couponEntries = await Wallet.findAll({
            where: {
                description: { [require('sequelize').Op.like]: '%Coupon Bonus%' }
            },
            order: [['id', 'DESC']],
            limit: 5
        });
        
        console.log(`\nCoupon bonus entries found: ${couponEntries.length}`);
        if (couponEntries.length > 0) {
            couponEntries.forEach(w => {
                console.log(`  - ID: ${w.id}, Amount: ₹${w.amount}, Coupon: ${w.coupon_code}, TXN: ${w.transaction_id}`);
            });
        }
        
        await sequelize.close();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
