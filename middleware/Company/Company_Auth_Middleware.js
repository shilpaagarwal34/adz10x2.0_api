const jwt = require('jsonwebtoken');
const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
const Company_User = require('@models/Company/Users/Company_User_Model');

const authenticateCompanyUser = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { id, userType } = decoded;

        let user = null;

        if (userType === 'Company_Admin') {
            user = await Company_Registration.findOne({
                where: { id, status: 'active' }
            });
        } else if (userType === 'Company_User') {
            user = await Company_User.findOne({
                where: { id, status: 'active' },
                attributes: ['id', 'email', 'company_id','user_name'] // 👈 include necessary fields
            });
        } else {
            return res.status(403).json({ message: 'Invalid user type' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found or inactive' });
        }

        req.user = user;
        req.user_type = userType;

        next();

    } catch (err) {
        console.error(err);
        return res.status(403).json({ message: 'Invalid token' });
    }
};

module.exports = authenticateCompanyUser;









// const jwt = require('jsonwebtoken');
// const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');

// const  Company_User = require('@models/Company/Users/Company_User_Model');
// const authenticateCompanyUser = async (req, res, next) => {
//     const authHeader = req.headers['authorization'];

//     if (!authHeader || !authHeader.startsWith('Bearer ')) {
//         return res.status(401).json({ message: 'Unauthorized' });
//     }

//     const token = authHeader.split(' ')[1];

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         const userId = decoded.id;

//         let user = null;
//         let userType = null;

//         // Search in Company_Registration
//         user = await Company_Registration.findOne({ where: { id: userId, status: 'active' } });
//         if (user) userType = 'Company_Admin';

//         // If still not found, check Company_User
//         // if (!user) {
//         //     user = await Company_User.findOne({ where: { id: userId, status: 'active' } });
//         //     if (user) userType = 'Company_User';
//         // }

//         // In middleware
//         if (!user) {
//             user = await Company_User.findOne({
//                 where: { id: userId, status: 'active' },
//                 attributes: ['id', 'email', 'company_id'] // ✅ explicitly include company_id
//             });
//             if (user) userType = 'Company_User';
//         }

//         // If user is still not found
//         if (!user) {
//             return res.status(404).json({ message: 'User not found' });
//         }

//         // Attach user and type to request
//         req.user = user;
//         req.user_type = userType;

//         next();

//     } catch (err) {
//         console.error(err);
//         return res.status(403).json({ message: 'Invalid token' });
//     }
// };

// module.exports = authenticateCompanyUser;