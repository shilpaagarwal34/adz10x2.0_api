
const Company_Register = require('@models/Company/Auth/Company_Registration_Model');
const Company_Profile = require('@models/Company/Auth/Company_Profile_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Sectors = require('@models/Admin/Master/Sector_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { Op, Sequelize  } = require("sequelize");
const { fn, col, where } = require('sequelize');
const path = require('path');

exports.companyDataTable = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // const { pending, approved, rejected, city_id, area_id, search } = req.query;
        const { kyc_status, city_id, area_id, search } = req.query;

        const sortField = req.query.sortField || 'id';
        const sortOrder = req.query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        // Base condition
        const whereClause = { 
          status: { [Op.ne]: 'delete' } 
        };
        
         // If Relationship Manager, filter societies by their ID
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
            whereClause.relationship_manager_id = req.user.id;
        }

        if (kyc_status) whereClause.kyc_status = kyc_status;

        // City and area filters
        if (city_id) whereClause.city_id = city_id;
        if (area_id) whereClause.area_id = area_id;

        if (search) {
            whereClause[Op.and] = {
                [Op.or]: [
                    where(fn('LOWER', col('company_name')), {
                        [Op.like]: `%${search.toLowerCase()}%`
                    }),
                    where(fn('LOWER', col('id_prifix_company')),{
                        [Op.like]: `%${search.toLowerCase()}%`
                    }),
                    where(fn('to_char', col('createdAt'), 'YYYY-MM-DD'), {
                        [Op.like]: `%${search}%`
                    })
                ]
            };
        }

        // Total count
        const total = await Company_Register.count({ where: whereClause });

        const approvedCount = await Company_Register.count({
          where: { ...whereClause, kyc_status: 'approved' }
        });

        const pendingCount = await Company_Register.count({
          where: { ...whereClause, kyc_status: 'pending' }
        });
        
        const rejectedCount = await Company_Register.count({
          where: { ...whereClause, kyc_status: 'rejected' }
        });

        // Get company data
        const companys = await Company_Register.findAll({
            where: whereClause,
            offset,
            limit,
            order: [[sortField, sortOrder]],
            attributes: ['id', 'company_name','id_prifix_company', 'city_id','name','mobile_number',  'createdAt', 'kyc_status','status'],
            raw: true
        });

        const companyIds = companys.map(s => s.id);

        // Get related profiles, cities, areas
          const [ cities] = await Promise.all([
        
            City.findAll({
                attributes: ['id', 'city_name'],
                raw: true
            }),
        ]);

        // Mapping
        const cityMap = Object.fromEntries(cities.map(c => [c.id, c.city_name]));
     //    const areaMap = Object.fromEntries(areas.map(a => [a.id, a.area_name]));

        // Merge data
        const mergedData = companys.map(company => ({
            ...company,
          //   number_of_flat: profileMap[company.id] || null,
            city_name: cityMap[company.city_id] || null,
          //  area_name: areaMap[company.area_id] || null,
            createdAt: new Date(company.createdAt).toISOString().split('T')[0]
        }));

        // Final response
        return res.status(200).json({
            status: 200,
            message: 'Company fetched successfully',
            table_name: 'company_registration',
            total,
            approvedCount,
            pendingCount,
            rejectedCount,
            page,
            limit,
            data: mergedData
        });

    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
};

exports.getCompanyID = async (req, res) => {
  try {
        const { privileges, isSuperAdmin } = req.user;

          if (!isSuperAdmin && !privileges.includes('company_view')) {
              return res.status(403).json({ 
                      status: 403, 
                      message: 'Sorry, You Have No Permission For This Request' 
              });
        }

        const whereClause = {
          id: req.params.id,
          status: { [Op.ne]: 'delete' }
        };

        // ✅ Apply restriction for Relationship Manager
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
          whereClause.relationship_manager_id = req.user.id;
        }

        const companyData = await Company_Register.findOne({
          where: whereClause,
          raw: true
        });



      // const companyData = await Company_Register.findOne({
      //   where: {
      //     id: req.params.id,
      //     status: { [Op.ne]: 'delete' }
      //   },
      //   raw:true
      // });

      if (!companyData) {
        return res.status(404).json({ message: "Company not found" });
      }


      const approvedByAdmin = companyData.approved_by
        ? await Master_Admin.findByPk(companyData.approved_by, { raw: true })
        : null;

        const rejectedByAdmin = companyData.rejected_by
        ? await Master_Admin.findByPk(companyData.rejected_by, { raw: true })
        : null;

        const app_rej_date_time = companyData.approved_reject_date_time
        ? new Date(companyData.approved_reject_date_time).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        })
        : null;

  
      const {
        password,
        token,
        city_id,
        area_id,
        sector,
        created_ip_address,
        modified_ip_address,
        created_by,
        modified_by,
        createdAt,
        updatedAt,
        ...safeCompany
      } = companyData;
  
      // Fetch profile
      const profileRaw = await Company_Profile.findOne({
        where: { company_id: companyData.id },
        raw: true
      });
  
      let cleanProfile = {};
      if (profileRaw && profileRaw.id) {
        const {
          createdAt,
          updatedAt,
          created_ip_address,
          modified_ip_address,
          created_by,
          modified_by,
          ...restProfile
        } = profileRaw;
  
        cleanProfile = {
          ...restProfile,
          profile_id: profileRaw.id // map id → profile_id
        };
      }
  
      const city = await City.findByPk(city_id, { raw: true });
      const area = await Area.findByPk(area_id, { raw: true });
      const sector_names = await Sectors.findByPk(sector, { raw: true });
  
      const companyDetails = {
        ...safeCompany,
        
        ...cleanProfile,
        city_name: city ? city.city_name : null,
        area_name: area ? area.area_name : null,
        sector_name: sector_names ? sector_names.sector_name : null,
        approved_by_name: approvedByAdmin ? approvedByAdmin.user_name : null,
            rejected_by_name: rejectedByAdmin ? rejectedByAdmin.user_name : null,
            approved_reject_date_time: app_rej_date_time
      };
  
      return res.status(200).json({
        status: 200,
        message: "Company fetched successfully",
        data: companyDetails
      });
  
    } catch (error) {
      return res.status(500).json({ status: 500, error: error.message });
    }
};
  
exports.getCompanyCommission = async (req, res) => {
      try {
              company_commition = await Campaign_Configuration.findOne({
                  attributes: ['id', 'brand_promotion', 'lead_generation', 'survey'],
                  where: {
                      status: {
                          [Op.in]: ['active']
                      }
                  },
                  order:[['createdAt', 'ASC']]
              });
  
              if(!company_commition){
                  return res.status(404).json({
                      status:404,
                      message:'Company commition not found',
                  });
              }
             
              return res.status(200).json({
                  status:200,
                  message:'Company commition fetched successfully',
                  data:company_commition
              })
      } catch (error) {
          return res.status(500).json({ status:500, error:error.message });
      }
}

exports.assignManagerCompany = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in user ID
    const {
      id,
      relationship_manager_id,
      brand_promotion,
      lead_generation,
      survey,
      remark,
      kyc_status,
    } = req.body;

    if (!id) {
      return res.status(400).json({ status: 400, message: "ID are required" });
    }

    const user = await Company_Register.findOne({
      where: {
        id,
        status: { [Op.in]: ['active', 'inactive'] }
      }
    });

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found or not active/inactive" });
    }

    // ✅ Partial Update if already approved
    if (user.kyc_status === 'approved') {
      const updatePartialData = {};
      let updatedFields = [];

      
    if (relationship_manager_id !== undefined && relationship_manager_id !== user.relationship_manager_id) {
      updatePartialData.relationship_manager_id = relationship_manager_id;
      updatedFields.push("Relationship Manager");
    }

      if (brand_promotion !== undefined && brand_promotion !== user.brand_promotion) {
        updatePartialData.brand_promotion = brand_promotion;
        updatedFields.push("Brand Promotion");
      }

      if (lead_generation !== undefined && lead_generation !== user.lead_generation) {
        updatePartialData.lead_generation = lead_generation;
        updatedFields.push("Lead Generation");
      }

      if (survey !== undefined && survey !== user.survey) {
        updatePartialData.survey = survey;
        updatedFields.push("Survey");
      }

      if (updatedFields.length > 0) {
        updatePartialData.modified_by = userId;
        updatePartialData.modified_ip_address = req.ip;
        updatePartialData.modified_type = 'Admin';

        await Company_Register.update(updatePartialData, { where: { id } });

        await Notification.create({
          company_ids: [id],
          message: `Updated fields: ${updatedFields.join(', ')}`,
          from: 'admin',
          to: 'company',
          notify_type: 'individual',
          read_type: 'unread',
          created_ip_address: req.ip,
          created_by: userId
        });

        const updatedUser = await Company_Register.findByPk(id);

        return res.status(200).json({
          status: 200,
          message: `Admin Campaign Amount updated successfully: ${updatedFields.join(', ')}`,
          data: updatedUser
        });
      }
    }

    if ((kyc_status !== 'rejected' && !relationship_manager_id)) {
      return res.status(400).json({ status: 400, message: "Relationship manager is required" });
    }

    // ✅ Continue if not already approved (initial assignment / approval / rejection)
    const imageFields = ['company_aggrement_copy_path'];
    let imagePaths = {};
    let imageNames = {};

    imageFields.forEach(field => {
      if (req.files?.[field]?.[0]) {
        imagePaths[field] = `uploads/${req.files[field][0].filename}`;
        imageNames[field] = path.basename(req.files[field][0].filename);
      }
    });

    let updateData = {};

    if (kyc_status === 'approved') {
      updateData = {
        relationship_manager_id,
        brand_promotion,
        lead_generation,
        survey,
        kyc_status,
        company_aggrement_copy_path: imagePaths["company_aggrement_copy_path"],
        aggrement_copy_name: imageNames["company_aggrement_copy_path"],
        allow_edit: false,
        approved_by: userId,
        approved_reject_date_time: new Date(),
        modified_by: userId,
        modified_type: 'Admin',
      };

      await Notification.create({
        company_ids: [id],
        message: `KYC Approved for Company`,
        from: 'admin',
        to: 'company',
        notify_type: 'individual',
        read_type: 'unread',
        created_ip_address: req.ip,
        created_by: userId
      });
    } else if (kyc_status === 'rejected') {
      updateData = {
        kyc_status,
        remark: remark || null,
        rejected_by: userId,
        modified_ip_address: req.ip,
        approved_reject_date_time: new Date(),
        modified_by: userId,
        modified_type: 'Admin'
      };

      await Notification.create({
        company_ids: [id],
        message: `KYC Rejected for Company`,
        from: 'admin',
        to: 'company',
        notify_type: 'individual',
        read_type: 'unread',
        created_ip_address: req.ip,
        created_by: userId
      });
    }

    await Company_Register.update(updateData, { where: { id } });

    const updatedUser = await Company_Register.findByPk(id);

    console.log('updatedUser', updatedUser);
    

    return res.status(200).json({
      status: 200,
      message: "Manager assigned successfully",
      data: updatedUser
    });

  } catch (error) {
    return res.status(500).json({ status: 500, message: "Server error", error: error.message });
  }
};

exports.comapnyMoveRejeactPending = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, kyc_status } = req.body;

        const moveData = await Company_Register.findByPk(id);

        if (!moveData) {
            return res.status(404).json({
                status: 404,
                message: "Company not found"
            });
        }

        // Update the kyc_status to 'pending'
        await moveData.update({ 
                kyc_status: 'pending',
                modified_by:userId,
                modified_type:'Admin'
            });

        return res.status(200).json({
            status: 200,
            message: "Company moved successfully",
            data: moveData
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            error: error.message
        });
    }
};

 exports.comapnyAllowEdit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, allow_edit } = req.body;

        const moveData = await Company_Register.findByPk(id);

        if (!moveData) {
            return res.status(404).json({
                status: 404,
                message: "Company not found"
            });
        }

        // Update the kyc_status to 'pending'
        await moveData.update({ 
                allow_edit: allow_edit,
                modified_by:userId,
                modified_type:'Admin'
            });

        return res.status(200).json({
            status: 200,
            message: "Allow edit successfully",
            data: moveData
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            error: error.message
        });
    }
};