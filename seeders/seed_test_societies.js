require('module-alias/register');
const sequelize = require('../config/db');

async function seed() {
  // 1. Insert Balewadi area under Pune (city_id=4)
  await sequelize.query(
    `INSERT INTO area (area_name, city_id, status, "createdAt", "updatedAt")
     VALUES ('Balewadi', 4, 'active', NOW(), NOW())
     ON CONFLICT DO NOTHING`
  );
  const [existingArea] = await sequelize.query(
    `SELECT id FROM area WHERE area_name='Balewadi' AND city_id=4 LIMIT 1`
  );
  const areaId = existingArea[0]?.id;
  console.log('Balewadi Area ID:', areaId);

  // 2. Society data
  const societies = [
    { name: 'Marvel Brisa',          address: 'Balewadi, Pune - 411045', lat: 18.5740, lng: 73.7620, flats: 240 },
    { name: 'Blue Ridge Township',   address: 'Balewadi, Pune - 411045', lat: 18.5760, lng: 73.7640, flats: 450 },
    { name: 'Amanora Park Town',     address: 'Balewadi, Pune - 411045', lat: 18.5720, lng: 73.7600, flats: 320 },
    { name: 'Megapolis Smart Homes', address: 'Balewadi, Pune - 411045', lat: 18.5780, lng: 73.7660, flats: 180 },
    { name: 'Paranjape Blue Ridge',  address: 'Balewadi, Pune - 411045', lat: 18.5750, lng: 73.7630, flats: 290 },
  ];

  // Media rate cards per asset type (permission costs per PRD)
  const mediaTypes = [
    { type: 'society_kiosk',            rate: 5000 },
    { type: 'lift_branding_panels',     rate: 2000 },
    { type: 'gate_entry_exit_branding', rate: 1000 },
    { type: 'whatsapp_promotional_day', rate: 2000 },
    { type: 'notice_board_sponsorship', rate: 1500 },
  ];

  for (const s of societies) {
    const email = s.name.toLowerCase().replace(/\s+/g, '.') + '@test.local';
    const mobile = '9' + String(Math.floor(100000000 + Math.random() * 900000000));

    const [regRows] = await sequelize.query(
      `INSERT INTO society_registration
         (society_name, name, address, city_id, area_id, pincode, latitude, longitude,
          email, mobile_number, password, amount, status, account_status, kyc_status,
          "createdAt", "updatedAt")
       VALUES (:sname, :sname, :address, 4, :areaId, 411045, :lat, :lng,
               :email, :mobile, 'placeholder', 0, 'active', 'approved', 'approved',
               NOW(), NOW())
       RETURNING id`,
      { replacements: { sname: s.name, address: s.address, areaId, lat: s.lat, lng: s.lng, email, mobile } }
    );
    const societyId = regRows[0]?.id;
    console.log(`  Created society: ${s.name} (ID: ${societyId})`);

    // Society profile with member/flat count and daily ad limit
    await sequelize.query(
      `INSERT INTO society_profile
         (society_id, number_of_flat, ads_per_day, "createdAt", "updatedAt")
       VALUES (:sid, :flats, 10, NOW(), NOW())`,
      { replacements: { sid: societyId, flats: s.flats } }
    );

    // Media rate cards
    for (const m of mediaTypes) {
      await sequelize.query(
        `INSERT INTO society_media_rate_cards
           (society_id, media_type, society_rate, effective_from, status, "createdAt", "updatedAt")
         VALUES (:sid, :mtype, :rate, '2025-01-01', 'active', NOW(), NOW())`,
        { replacements: { sid: societyId, mtype: m.type, rate: m.rate } }
      );
    }
    console.log(`    Rate cards created for ${s.name}`);
  }

  console.log('\nAll test societies seeded successfully!');
  process.exit(0);
}

seed().catch(e => {
  console.error('Seed error:', e.message);
  process.exit(1);
});
