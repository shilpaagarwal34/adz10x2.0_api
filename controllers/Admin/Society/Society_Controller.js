const Society_Register = require('@models/Society/Auth/Society_Registration_Model');
const Society_Profile = require('@models/Society/Auth/Society_Profile_Model');
const Ads_Slot = require('@models/Society/Auth/Society_Ads_Slot_Model');
const City = require('@models/Admin/Master/City_Model');
const Area = require('@models/Admin/Master/Area_Model');
const Campaign_Configuration = require('@models/Admin/Master/Campaign_Configuration_Model');
const Master_Admin = require('@models/Admin/Auth/Master_Admin_Model');
const Notification = require('@models/Notifications/Notification_Model');
const { Op} = require("sequelize");
const { fn, col, where } = require('sequelize');
const path = require('path');
const { raw } = require('express');

exports.societyDataTable = async (req, res) => {
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
            // status: 'active'
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
                    where(fn('LOWER', col('society_name')), {
                        [Op.like]: `%${search.toLowerCase()}%`
                    }),
                    where(fn('LOWER', col('id_prifix_society')),{
                        [Op.like]: `%${search.toLowerCase()}%`
                    }),
                    where(fn('to_char', col('createdAt'), 'YYYY-MM-DD'), {
                        [Op.like]: `%${search}%`
                    })
                ]
            };
        }
        // Total count
        const total = await Society_Register.count({ where: whereClause });

        const approvedCount = await Society_Register.count({
            where: { ...whereClause, kyc_status: 'approved' }
          });
  
          const pendingCount = await Society_Register.count({
            where: { ...whereClause, kyc_status: 'pending' }
          });
          
          const rejectedCount = await Society_Register.count({
            where: { ...whereClause, kyc_status: 'rejected' }
          });
  

        // Get society data
        const societys = await Society_Register.findAll({
            where: whereClause,
            offset,
            limit,
            order: [[sortField, sortOrder]],
            attributes: ['id', 'society_name','id_prifix_society', 'createdAt', 'kyc_status','status','city_id','area_id'],
            raw: true
        });

        const societyIds = societys.map(s => s.id);

        // Get related profiles, cities, areas
        const [profiles, cities, areas] = await Promise.all([
            Society_Profile.findAll({
                where: { society_id: { [Op.in]: societyIds } },
                attributes: ['society_id', 'number_of_flat'],
                raw: true
            }),
            City.findAll({
                attributes: ['id', 'city_name'],
                raw: true
            }),
            Area.findAll({
                attributes: ['id', 'area_name'],
                raw: true
            })
        ]);

        // Mapping
        const profileMap = Object.fromEntries(profiles.map(p => [p.society_id, p.number_of_flat]));
        const cityMap = Object.fromEntries(cities.map(c => [c.id, c.city_name]));
        const areaMap = Object.fromEntries(areas.map(a => [a.id, a.area_name]));

        // Merge data
        const mergedData = societys.map(society => ({
            ...society,
            number_of_flat: profileMap[society.id] || null,
            city_name: cityMap[society.city_id] || null,
            area_name: areaMap[society.area_id] || null,
            createdAt: new Date(society.createdAt).toISOString().split('T')[0]
        }));

        // Final response
        return res.status(200).json({
            status: 200,
            message: 'Society fetched successfully',
            table_name: 'society_registration',
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

exports.getScoietyID = async (req, res) => {
    try {

        // const { privileges, isSuperAdmin } = req.user;

        //    if (!isSuperAdmin && !privileges.includes('societies_view')) {
        //         return res.status(403).json({ 
        //                 status: 403, 
        //                 message: 'Sorry, You Have No Permission For This Request' 
        //         });
        //   }


        //   const whereClause = { 
        //     // status: 'active'
        //     status: { [Op.ne]: 'delete' } 
        // };

        //   // If Relationship Manager, filter societies by their ID
        // if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
        //     whereClause.relationship_manager_id = req.user.id;
        // }
            
        // const society = await Society_Register.findOne({
        //     where: {
        //         id: req.params.id,
        //         status: { [Op.ne]: 'delete' }
        //     },
        //     raw: true
        // });

        const whereClause = {
          id: req.params.id,
          status: { [Op.ne]: 'delete' }
        };

        // ✅ Apply restriction for Relationship Manager
        if (req.user.role_name === 'RELATIONSHIP MANAGER' && !req.user.isSuperAdmin) {
          whereClause.relationship_manager_id = req.user.id;
        }

        const society = await Society_Register.findOne({
          where: whereClause,
          raw: true
        });

        if (!society) {
            return res.status(404).json({ message: "Society not found" });
        }

        const approvedByAdmin = society.approved_by
        ? await Master_Admin.findByPk(society.approved_by, { raw: true })
        : null;

        const rejectedByAdmin = society.rejected_by
        ? await Master_Admin.findByPk(society.rejected_by, { raw: true })
        : null;

        const app_rej_date_time = society.approved_reject_date_time
        ? new Date(society.approved_reject_date_time).toLocaleString('en-GB', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        })
        : null

        // Remove sensitive fields from society
        const {
            // password,
            token,
            city_id,
            area_id,
            created_ip_address,
            modified_ip_address,
            created_by,
            modified_by,
            createdAt,
            updatedAt,
            ...safeSociety
        } = society;

        const password = society.password;

        // Fetch profile
        const profileRaw = await Society_Profile.findOne({
            where: { society_id: society.id },
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

        const city = await City.findByPk(society.city_id, { raw: true });
        const area = await Area.findByPk(society.area_id, { raw: true });

         // 🔥 Fetch ad slots based on society_id
         const adsSlots = await Ads_Slot.findAll({
            where: { society_id: society.id, status: 'active' },
            raw: true
        });

        const societyDetails = {
            ...safeSociety,
            password,
            ...cleanProfile,
            city_name: city ? city.city_name : null,
            area_name: area ? area.area_name : null,
            approved_by_name: approvedByAdmin ? approvedByAdmin.user_name : null,
            rejected_by_name: rejectedByAdmin ? rejectedByAdmin.user_name : null,
            approved_reject_date_time: app_rej_date_time,
            ads_slots: adsSlots
        };

        return res.status(200).json({
            status: 200,
            message: "Society fetched successfully",
            data: societyDetails
        });

    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
};

exports.getSocietyCommission = async (req, res) => {
    try {
            society_commition = await Campaign_Configuration.findOne({
                attributes: ['id', 'society_commission', 'society_brand_promotion', 'society_lead_generation','society_survey'],
                where: {
                    status: {
                        [Op.in]: ['active']
                    }
                },
                order:[['createdAt', 'ASC']]
            });

            if(!society_commition){
                return res.status(404).json({
                    status:404,
                    message:'Society commition not found',
                });
            }
           
            return res.status(200).json({
                status:200,
                message:'Society commition fetched successfully',
                data:society_commition
            })
    } catch (error) {
        return res.status(500).json({ status:500, error:error.message });
    }
}

exports.assignManagerSociety = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, relationship_manager_id, society_commission, society_brand_promotion, society_lead_generation, society_survey, remark, kyc_status, ads_per_day } = req.body;

    if (!id) {
      return res.status(400).json({ status: 400, message: "ID are required" });
    }

    const user = await Society_Register.findOne({
      where: {
        id,
        status: { [Op.in]: ['active', 'inactive'] }
      }
    });

    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found" });
    }

      // ✅ Partial Update if already approved
    if (user.kyc_status === 'approved') {
      const updatePartialData = {};
      let updatedFields = [];

      if (society_commission !== undefined && society_commission !== user.society_commission) {
        updatePartialData.society_commission = society_commission;
      }

      if (society_brand_promotion !== undefined && society_brand_promotion !== user.society_brand_promotion) {
        updatePartialData.society_brand_promotion = society_brand_promotion;
        updatedFields.push("Brand Promotion");
      }

      if (society_lead_generation !== undefined && society_lead_generation !== user.society_lead_generation) {
        updatePartialData.society_lead_generation = society_lead_generation;
        updatedFields.push("Lead Generation");
      }

      if (society_survey !== undefined && society_survey !== user.society_survey) {
        updatePartialData.society_survey = society_survey;
        updatedFields.push("Survey");
      }

      if (updatedFields.length > 0) {
        updatePartialData.modified_by = userId;
        updatePartialData.modified_ip_address = req.ip;
        updatePartialData.modified_type = 'Admin';

        await Society_Register.update(updatePartialData, { where: { id } });

        await Notification.create({
          society_ids: [id],
          message: `Updated fields: ${updatedFields.join(', ')}`,
          from: 'admin',
          to: 'society',
          notify_type: 'individual',
          read_type: 'unread',
          created_ip_address: req.ip,
          created_by: userId
        });

        const updatedUser = await Society_Register.findByPk(id);

        return res.status(200).json({
          status: 200,
          message: `Admin Society Commission updated successfully: ${updatedFields.join(', ')}`,
          data: updatedUser
        });
      }
    }

    if ((kyc_status !== 'rejected' && !relationship_manager_id)) {
      return res.status(400).json({ status: 400, message: "Relationship manager is required" });
    }

    // Process image uploads
    const imageFields = ['aggrement_copy_path'];
    let imagePaths = {}, imageNames = {};

    imageFields.forEach(field => {
      if (req.files[field]?.[0]) {
        imagePaths[field] = `uploads/${req.files[field][0].filename}`;
        imageNames[field] = path.basename(req.files[field][0].filename);
      }
    });

    // Prepare update data
    let updateData = {};

    if (kyc_status === 'approved') {
      updateData = {
        relationship_manager_id,
        society_commission,
        society_brand_promotion,
        society_lead_generation,
        society_survey,
        kyc_status,
        allow_edit: false,
        aggrement_copy_path: imagePaths["aggrement_copy_path"],
        aggrement_copy_name: imageNames["aggrement_copy_path"],
        modified_ip_address: req.ip,
        approved_by: userId,
        approved_reject_date_time: new Date()
      };

          // ✅ Create notification for KYC approved
      await Notification.create({
        society_ids: [id],
        message: `KYC Approved for Society "${user.society_name}".`,
        from: 'admin',
        to: 'society',
        notify_type: 'individual',
        created_ip_address: req.ip,
         types: 'society',
        created_by: userId
      });

    } else if (kyc_status === 'rejected') {
      updateData = {
        kyc_status,
        remark: remark || null,
        rejected_by: userId,
        modified_ip_address: req.ip,
        approved_reject_date_time: new Date()
      };

            // ✅ Create notification for KYC approved
      await Notification.create({
        society_ids: [id],
        message: `KYC Rejected for Society "${user.society_name}".`,
        from: 'admin',
        to: 'society',
        notify_type: 'individual',
        read_type: 'unread',
        created_ip_address: req.ip,
         types: 'society',
        created_by: userId
      });

    } else if (!kyc_status && relationship_manager_id) {
      updateData = {
        relationship_manager_id,
        modified_ip_address: req.ip,
        approved_by: userId,
        approved_reject_date_time: new Date()
      };
    }

    // Update Society_Register
    await Society_Register.update(updateData, { where: { id } });

    // Update ads_per_day if provided
    let ads;
    if (ads_per_day !== undefined) {
      ads = await Society_Profile.update(
        { ads_per_day },
        { where: { society_id: id } }
      );
    }

    // Soft delete existing slots (per day basis)
    const slots = JSON.parse(req.body.ads_slot || '[]');
    const savedSlots = [];

    for (const slot of slots) {
      if (slot.is_checked) {
        const { days, from_time, to_time } = slot;

        await Ads_Slot.update(
          {
            status: 'delete',
            modified_by: userId,
            modified_type: 'Admin'
          },
          {
            where: {
              society_id: id,
              days: days,
              status: 'active'
            }
          }
        );

        const savedSlot = await Ads_Slot.create({
          society_id: id,
          days,
          from_time,
          to_time,
          is_checked: true,
          created_by: userId,
          created_ip_address: req.ip,
          status: 'active',
          created_type: 'Admin'
        });

        savedSlots.push(savedSlot);
      }
    }

    if (savedSlots.length > 0) {
      await Notification.create({
        society_ids: [id],
        message: 'Campaign Days Updated',
        from: 'admin',
        to: 'society',
        notify_type: 'individual',
        created_ip_address: req.ip,
        created_by: userId
      });
    }

    const updatedUser = await Society_Register.findByPk(id);

    return res.status(200).json({
      status: 200,
      message: "Manager assigned successfully",
      data: {
        updatedUser,
        ads,
        slot: savedSlots
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      status: 500,
      message: "Server error",
      error: error.message
    });
  }
};

exports.assignAdsSlotSocietyAdmin = async (req, res) => {
  try {
    const userId = req.user.id; // logged-in user ID
    const { id, ads_per_day } = req.body;

    // ✅ Step 1: Update ads_per_day in Society_Profile if provided
    if (ads_per_day !== undefined) {
      await Society_Profile.update(
        { ads_per_day },
        { where: { society_id: id } }
      );
    }

    const updatedUser = await Society_Register.findByPk(id);

    // ✅ Step 2: Soft-delete all active slots for this society
    await Ads_Slot.update(
      {
        status: 'delete',
        modified_by: userId,
        modified_type: 'Admin'
      },
      {
        where: {
          society_id: id,
          status: 'active'
        }
      }
    );

    // ✅ Step 3: Parse new slot data from request
    const slots = JSON.parse(req.body.ads_slot) || [];
    const savedSlots = [];

    // ✅ Step 4: Create new active slots
    for (const slot of slots) {
      if (slot.is_checked) {
        const { days, from_time, to_time } = slot;

        const savedSlot = await Ads_Slot.create({
          society_id: id,
          days,
          from_time,
          to_time,
          is_checked: true,
          created_by: userId,
          created_ip_address: req.ip,
          status: 'active',
          created_type: 'Admin'
        });

        savedSlots.push(savedSlot);
      }
    }

     await Notification.create({
          society_ids: [id],
          message: `Campaign Days Updated`,
          from: 'admin',
          to: 'society',
          notify_type: 'individual',
          created_ip_address: req.ip,
      });

    // ✅ Step 5: Return response
    return res.status(200).json({
      status: 200,
      message: "Slot saved successfully",
      data: {
        updatedUser,
        slots: savedSlots
      }
    });

  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Server error",
      error: error.message
    });
  }
};

exports.getSocietyProfileSlotAdmin = async (req, res) => {
    try {
        
     const id = req.params.id;
  
      // Fetch ads slots for the society
      const ads_slots = await Ads_Slot.findAll({ where: { society_id: id, status: 'active' } });
  
      return res.status(200).json({
        status: 200,
        message: "Ads slots fetched successfully",
        data: ads_slots
      });
  
    } catch (error) {
      return res.status(500).json({
        status: 500,
        message: "Something went wrong",
        error: error.message
      });
    }
  };

exports.societyMoveRejeactPending = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, kyc_status } = req.body;

        const moveData = await Society_Register.findByPk(id);

        if (!moveData) {
            return res.status(404).json({
                status: 404,
                message: "Society not found"
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
            message: "Society moved successfully",
            data: moveData
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            error: error.message
        });
    }
};

 exports.societyAllowEdit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id, allow_edit } = req.body;

        const moveData = await Society_Register.findByPk(id);

        if (!moveData) {
            return res.status(404).json({
                status: 404,
                message: "Society not found"
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