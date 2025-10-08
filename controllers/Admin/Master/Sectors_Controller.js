
const Sector = require('@models/Admin/Master/Sector_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const { Op, Sequelize } = require('sequelize');
const { fn, col, where } = require('sequelize');

exports.createOrUpdate   = async (req, res) => {
         try{
               const { id, sector_name } = req.body;
               const { privileges, isSuperAdmin } = req.user;
               if(!sector_name) {
                    return res.status(400).json({status:400, message:'Sector name is required '});
               }

            const existingSectorWithSameName = await Sector.findOne({
                where: {
                    [Op.and]: [
                        Sequelize.where(
                            Sequelize.fn('LOWER', Sequelize.col('sector_name')),
                            Sequelize.fn('LOWER', sector_name)
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

               if (existingSectorWithSameName) {
                    return res.status(409).json({ status: 409, message: 'Sector name already exists' });
               }

               const firstAdmin = await Master_Admin.findOne({ order: [['id', 'ASC']] });
               const adminId = firstAdmin ? firstAdmin.id : null;

               if(id){

                if (!isSuperAdmin && !privileges.includes('company_sector_edit')) {
                    return res.status(403).json({ 
                            status: 403, 
                            message: 'Sorry, You Have No Permission For This Request' 
                    });
                }

                    const existingSector = await Sector.findByPk(id);
                    if (!existingSector) {
                         return res.status(404).json({ status: 404, message: 'Sector not found' });
                     } 

                     await existingSector.update({
                         sector_name,
                         updated_ip_address: req.ip,
                         modified_by:adminId
                     });

                     return res.status(200).json({ status: 200, message: 'Sector updated successfully', data: existingSector });
               } else {
                   if (!isSuperAdmin && !privileges.includes('company_sector_add')) {
                        return res.status(403).json({ 
                                status: 403, 
                                message: 'Sorry, You Have No Permission For This Request' 
                        });
                   }
                    const newSector = await Sector.create({
                         sector_name,
                         created_ip_address: req.ip,
                         created_by: adminId
                    });  
                    res.status(201).json({ status:201, message:"Sector created successfully", data:newSector});
               }
         }catch(err){
               return res.status(500).json({ status:500, error:err.message });
         }
}

exports.getSecotrsById = async (req, res) => {
     try {
         const { id } = req.params;
 
         const sectors = await Sector.findOne({
             where: {
                 id,
                 status: {
                     [Op.in]: ['active', 'inactive'] 
                 }
             }
         });
 
         if (!sectors) {
             return res.status(404).json({ message: 'Sector not found' });
         }
 
         return res.status(200).json({ status: 200, data: sectors });
     } catch (err) {
         res.status(500).json({ error: err.message });
     }
};
 
exports.secotrsDataTable = async (req, res) => {
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
                 fn('LOWER', col('sector_name')),
                 {
                     [Op.like]: `%${search.toLowerCase()}%`
                 }
             );
         }
 
         const total = await Sector.count({ where: whereClause });
 
         // Get city data with pagination and sorting
         const sectors = await Sector.findAll({
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
             table_name: 'sectors',
             message: 'Sectors fetched successfully',
             total,
             page,
             limit,
             data: sectors
         });
     } catch (err) {
         res.status(500).json({
             status: 500,
             message: "Failed to fetch cities",
             error: err.message
         });
     }
};
 
