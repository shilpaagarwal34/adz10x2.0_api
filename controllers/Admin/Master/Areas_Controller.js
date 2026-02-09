const Area = require('@models/Admin/Master/Area_Model');
const City = require('@models/Admin/Master/City_Model');
const ExcelJS = require('exceljs');
const { Op, Sequelize } = require("sequelize");
const { fn, col, where } = require('sequelize');

exports.getAreas = async (req, res) => {
      try {
          const { city_id } = req.params;  // Get city_id from route params
  
          const areas = await Area.findAll({
              where: { city_id },
              order: [['area_name', 'ASC']],
              attributes: ['id', 'city_id', 'area_name']
          });
  
          res.status(200).json({
              status: 200,
              message: "success",
              data: areas
          });
  
      } catch (err) {
          res.status(500).json({ error: err.message });
      }
};

exports.areaDataTable = async (req, res) => {
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
                fn('LOWER', col('area_name')),
                {
                    [Op.like]: `%${search.toLowerCase()}%`
                }
            );
        }

        const total = await Area.count({ where: whereClause });

        const areas = await Area.findAll({
            where: whereClause,
            offset,
            limit,
            order: [['id', 'DESC']],
            attributes: {
                exclude: ['created_ip_address', 'modified_ip_address', 'created_by', 'modified_by', 'createdAt', 'updatedAt']
            },      
            raw: true
        });

        // Get all unique city_ids from areas
        const cityIds = [...new Set(areas.map(area => area.city_id))];

        // Fetch cities by those IDs
        const cities = await City.findAll({
            where: {
                id: {
                    [Op.in]: cityIds
                }
            },
            attributes: ['id', 'city_name'],
            raw: true
        });

        // Create a map of city_id -> city_name
        const cityMap = {};
        cities.forEach(city => {
            cityMap[city.id] = city.city_name;
        });

        // Add city_name to each area
        const finalAreas = areas.map(area => ({
            ...area,
            city_name: cityMap[area.city_id] || ''
        }));

        return res.status(200).json({
            status: 200,
            table_name: 'area',
            message: 'Areas fetched successfully',
            total,
            page,
            limit,
            data: finalAreas
        });

    } catch (err) {
        return res.status(500).json({
            status: 500,
            message: 'Failed to fetch areas',
            error: err.message
        });
    }
};

// Get Area by ID (only if status is active)
exports.getAreaById = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await Area.findOne({
            where: {
                id,
                status: {
                    [Op.in]: ['active', 'inactive'] // Include only active and inactive
                }
            }
        });

        if (!area) {
            return res.status(404).json({ message: 'Active area not found' });
        }

        res.status(200).json({ status: 200, data: area });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createOrUpdateArea  = async (req, res) => {
    try {
     
        const { id, city_id, area_name } = req.body;
        const { privileges, isSuperAdmin } = req.user;

            if(!city_id){
                return res.status(400).json({ status:400, message:'City ID is required' });
            }

            if (!area_name) {
                return res.status(400).json({ status:400, message: 'Area name is required' });
            }

            // check if city is exist
            const city = await City.findByPk(city_id);
            if (!city) {
                return res.status(404).json({ status:400, message:'City not found' });
            }

          
            const checkExsitingarea = await Area.findOne({
                where: {
                    [Op.and]: [
                        Sequelize.where(
                            Sequelize.fn('LOWER', Sequelize.col('area_name')),
                            Sequelize.fn('LOWER', area_name)
                        ),
                        { city_id },
                        ...(id ? [{ id: { [Op.ne]: id } }] : [])
                    ]
                }
            });
            
            if (checkExsitingarea) {
                return res.status(409).json({ status:409, message: 'Area already exists for this city' });
            }
           
            let area;
            
            if(id){

            if (!isSuperAdmin && !privileges.includes('area_edit')) {
                return res.status(403).json({ 
                        status: 403, 
                        message: 'Sorry, You Have No Permission For This Request' 
                });
            }
                area = await Area.findByPk(id);

                if (area) {
                    await area.update({
                        city_id,
                        area_name,
                        modified_ip_address:req.ip,
                        // modified_by:userId
                    });
                    return res.status(200).json({ status:200, message: 'Area updated successfully', data: area });
                } else {
                    return res.status(404).json({ message: 'Area not found' });
                }
            }else{

            if (!isSuperAdmin && !privileges.includes('area_add')) {
                return res.status(403).json({ 
                        status: 403, 
                        message: 'Sorry, You Have No Permission For This Request' 
                });
            }
                area = await Area.create({
                    city_id,
                    area_name,
                    created_ip_address:req.ip,
                    // created_by: userId
                });
                return res.status(201).json({ status:201, message: 'Area created successfully', data: area });
            }

    } catch(err){
        return res.status(500).json({ status:500, error: err.message });
    }
}

exports.exportAreaListExcel = async (req, res) => {
  try {
    const areas = await Area.findAll({
      where: { status: 'active' }, // optional filter
      attributes: ['area_name'],
      order: [['area_name', 'ASC']],
      raw: true
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Area List');

    // Add header row
    worksheet.addRow(['Area Name']);

    // Add each area name
    areas.forEach(area => {
      worksheet.addRow([area.area_name || '-']);
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Area_List.xlsx'
    );

    // Write Excel file to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Failed to export area list',
      error: err.message
    });
  }
};
