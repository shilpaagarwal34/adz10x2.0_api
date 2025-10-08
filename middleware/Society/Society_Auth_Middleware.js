
const jwt = require('jsonwebtoken');
const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
const Society_User = require('@models/Society/Users/Society_User_Model');

const authenticateSocietyUser = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: Missing or malformed token' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const userType = decoded.userType;

        if (!userId || !userType) {
            return res.status(400).json({ message: 'Invalid token payload' });
        }

        let user = null;

        if (userType === 'Society_Admin') {
            user = await Society_Registration.findOne({ where: { id: userId, status: 'active' } });
        } else if (userType === 'Society_User') {
            user = await Society_User.findOne({ where: { id: userId, status: 'active' } });
        } else {
            return res.status(400).json({ message: 'Invalid user' });
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.user = user;
        req.user_type = userType;

        next();

    } catch (err) {
        console.error('JWT verification error:', err);
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

module.exports = authenticateSocietyUser;



// const jwt = require('jsonwebtoken');
// const Society_Registration = require('@models/Society/Auth/Society_Registration_Model');
// const Company_Registration = require('@models/Company/Auth/Company_Registration_Model');
// const  Society_User = require('@models/Society/Users/Society_User_Model');
// const  Company_User = require('@models/Company/Users/Company_User_Model');
// const authenticateSocietyUser = async (req, res, next) => {
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

//         // Search in Society_Registration
//         user = await Society_Registration.findOne({ where: { id: userId, status: 'active' } });
//         if (user) userType = 'Society_Admin';

//         // If not found, check Company_Registration
//         if (!user) {
//             user = await Company_Registration.findOne({ where: { id: userId, status: 'active' } });
//             if (user) userType = 'Company_Admin';
//         }

//         // If still not found, check Society_User
//         if (!user) {
//             user = await Society_User.findOne({ where: { id: userId } });
//             if (user) userType = 'Society_User';
//         }

//         // If still not found, check Company_User
//         if (!user) {
//             user = await Company_User.findOne({ where: { id: userId } });
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

// module.exports = authenticateSocietyUser;