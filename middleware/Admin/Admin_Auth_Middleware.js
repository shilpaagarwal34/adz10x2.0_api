
const jwt = require('jsonwebtoken');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');

const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await Master_Admin.findByPk(decoded.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        req.user = {
            id: user.id,
            role_name: user.role_name,
            privileges: user.privileges || [] // JSONB array
        };

         // If user id is 1, treat as super admin and ignore privilege checks
        req.user.isSuperAdmin = user.id === 1;

        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid token' });
    }
};

module.exports = authenticateUser;