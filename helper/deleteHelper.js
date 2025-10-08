const db = require('@config/db');
const { QueryTypes } = require('sequelize');

const softDeleteRecord = async (tableName, id) => {
  try {
    const query = `UPDATE ${tableName} SET status = 'delete' WHERE id = :id`;
    await db.query(query, {
      replacements: { id },
      type: QueryTypes.UPDATE,
    });

     // Special case: if the main table is 'company_campaigns', also delete logs
    if (tableName === 'company_campaigns') {
      const logQuery = `UPDATE company_campaigns_logs SET status = 'delete' WHERE campaign_id = :id`;
      await db.query(logQuery, {
        replacements: { id },
        type: QueryTypes.UPDATE,
      });
    }


    return { success: true, message: 'Data Deleted Successfully!' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const toggleStatus = async (tableName, id) => {
  try {
    const [result] = await db.query(
      `SELECT status FROM ${tableName} WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      }
    );

    if (!result) {
      return { success: false, message: 'Record not found' };
    }

    const newStatus = result.status === 'active' ? 'inactive' : 'active';

    await db.query(
      `UPDATE ${tableName} SET status = :newStatus WHERE id = :id`,
      {
        replacements: { newStatus, id },
        type: QueryTypes.UPDATE,
      }
    );

    return {
      success: true,
      message: 'Status Changed Successfully!',
      user_status: newStatus,
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// ✅ Fix: Export both functions together
module.exports = {
  softDeleteRecord,
  toggleStatus
};
