
const { Op, Sequelize } = require('sequelize');
const ExcelJS = require('exceljs');
const City = require('@models/Admin/Master/City_Model');
const { fn, col, where } = require('sequelize');

exports.getCitys = async (req, res) => {
    try {
        const cities = await City.findAll({
           attributes: ['id', 'city_name'],
           where: { status: 'active' },  // or status: 1 if it's stored as number
           order: [['city_name', 'ASC']]
       });

        res.status(200).json({
            status: 200,
            message: "success",
            data: cities
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.cityDataTable = async (req, res) => {
    try {
         const page = parseInt(req.query.page) || 1;
         const limit = parseInt(req.query.limit) || 10; 
         const search = req.query.search || ''; 
    
        const offset = (page - 1) * limit;

        const whereClause = {
            status: {
                [Op.in]: ['active', 'inactive']
            }
        };

        if (search) {
            whereClause[Op.and] = where(
                fn('LOWER', col('city_name')),
                {
                    [Op.like]: `%${search.toLowerCase()}%`
                }
            );
        }

        const total = await City.count({ where: whereClause });
 
        const cities = await City.findAll({
        where: whereClause,
        offset,
        limit,
        order: [['id', 'DESC']],
        attributes: {
            exclude: ['created_ip_address', 'modified_ip_address', 'created_by', 'modified_by', 'createdAt', 'updatedAt']
          }
        });

        return res.status(200).json({
            status: 200,
            table_name: 'city',
            message: 'Cities fetched successfully',
            total,
            page,
            limit,
            data: cities
        });
    } catch (err) {
        res.status(500).json({
            status: 500,
            message: "Failed to fetch cities",
            error: err.message
        });
    }
};

exports.createOrUpdateCity = async (req, res) => {
    try {
        const userId = req.user.id || null; 
        const roleName = req.user.role_name || null; 
        const { privileges, isSuperAdmin } = req.user;

        const { id, city_name } = req.body;

        if (!city_name) {
            return res.status(400).json({ status:400, message: 'City name is required' });
        }

        const existingCity = await City.findOne({
            where: {
                [Op.and]: [
                    Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('city_name')),
                        Sequelize.fn('LOWER', city_name)
                    ),
                    {
                        status: {
                            [Op.in]: ['active', 'inactive']
                        }
                    },
                    ...(id ? [{ id: { [Op.ne]: id } }] : [])
                ]
            }
        });

        if (existingCity) {
            return res.status(409).json({ status:409, message: 'City name already exists' });
        }

        let city;

        if (id) {

             // Update permission check
            if (!isSuperAdmin && !privileges.includes('city_edit')) {
                return res.status(403).json({ 
                    status: 403, 
                    message: 'Sorry, You Have No Permission For This Request' 
                });
            }

            city = await City.findByPk(id);

            if (city) {
                await city.update({ 
                    city_name,
                    modified_ip_address: req.ip,
                    modified_by:userId,
                    modified_type:roleName
                });
                return res.status(200).json({  status:200,  message: 'City updated successfully', data:city });
            } else {
                return res.status(404).json({ message: 'City not found' });
            }
        } else {
                    // Create permission check
            if (!isSuperAdmin && !privileges.includes('city_add')) {
                return res.status(403).json({ 
                    status: 403, 
                    message: 'Sorry, You Have No Permission For This Request' 
                });
            }

            city = await City.create({
                city_name,
                created_ip_address: req.ip,
                created_by:userId,
                created_type:roleName
            });
            return res.status(201).json({ status:201, message: 'City created successfully', data:city });
        }

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

 // Get city by ID
exports.getCityById = async (req, res) => {
    try {
        const { id } = req.params;

        const city = await City.findOne({
            where: {
                id,
                status: {
                    [Op.in]: ['active', 'inactive'] 
                }
            }
        });

        if (!city) {
            return res.status(404).json({ message: 'Active city not found' });
        }

        return res.status(200).json({ status: 200, data: city });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.exportCityListExcel = async (req, res) => {
  try {
    const cities = await City.findAll({
      where: { status: 'active' },
      attributes: ['city_name'],
      order: [['city_name', 'ASC']],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('City List');

    // Add header row
    worksheet.addRow(['City Name']);

    // Add each city name
    cities.forEach(city => {
      worksheet.addRow([city.city_name || '-']);
    });

    // Set headers for Excel export
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=City_List.xlsx'
    );

    // Stream workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export City Error:', err);
    res.status(500).json({
      message: 'Failed to export city list',
      error: err.message
    });
  }
};