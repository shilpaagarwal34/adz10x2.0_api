const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');

const bcrypt = require('bcryptjs');

async function createDefaultAdminUser() {
  try {
    const existingAdmin = await Master_Admin.findOne({ where: { id: 1 } });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('12345678', 10);

      await Master_Admin.create({
        id: 1,
        user_type: 'system',
        user_id: null,
        user_name: 'ADZ10X',
        email: 'realtyroof@gmail.com',
        password: hashedPassword,
        mobile_no: '9876543210',
        role_id: '1',
        role_name: 'Super Admin',
        id_prifix_admin:'ADZ10XA01',
        status: 'active',
      });

      console.log(' Default Admin user created');
    } else {
      console.log('ℹ Default Admin user already exists');
    }
  } catch (err) {
    console.error(' Failed to create default Admin user:', err.message);
  }
}

module.exports = createDefaultAdminUser;
