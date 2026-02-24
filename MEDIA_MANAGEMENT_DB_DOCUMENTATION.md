# Media Management Data Documentation

This document explains how **Society Media Management** data is stored and retrieved in the current system.

## 1) Primary Database Table

The page saves data in:

- `society_media_rate_cards`

Model source:

- `models/Society/Advertisement/Society_Media_Rate_Card_Model.js`

### Table structure (from Sequelize model)

| Column | Type | Required | Notes |
|---|---|---:|---|
| `id` | INTEGER (PK, auto increment) | Yes | Primary key |
| `society_id` | INTEGER | Yes | Society owner ID |
| `media_type` | STRING | Yes | Platform key (example: `lift_branding_panels`) |
| `society_rate` | FLOAT | Yes | Entered by society |
| `platform_commission_pct` | FLOAT | Yes | Derived by backend (25% default, 100% for WhatsApp) |
| `platform_rate` | FLOAT | Yes | Derived amount from commission |
| `company_rate` | FLOAT | Yes | Derived total (`society_rate + platform_rate`) |
| `society_terms` | JSON | Yes | Array of selected Society T&C strings |
| `whatsapp_details` | JSON | No | Extra details only for `whatsapp_promotional_day` |
| `effective_from` | DATEONLY | Yes | Rate validity start |
| `effective_to` | DATEONLY | No | Rate validity end (`null` means open-ended) |
| `created_ip_address` | STRING | No | Audit |
| `modified_ip_address` | STRING | No | Audit |
| `created_type` | STRING | No | Audit |
| `modified_type` | STRING | No | Audit |
| `created_by` | BIGINT | No | Audit |
| `modified_by` | BIGINT | No | Audit |
| `status` | ENUM(`active`,`delete`,`inactive`) | Yes | Soft-delete/status flag |
| `createdAt` | TIMESTAMP | Yes | Sequelize timestamp |
| `updatedAt` | TIMESTAMP | Yes | Sequelize timestamp |

---

## 2) What is DB-backed vs Config-backed

### Stored in DB (`society_media_rate_cards`)

- Offer selection (implicitly, by row existence with `status = 'active'`)
- `society_rate`
- Calculated values (`platform_commission_pct`, `platform_rate`, `company_rate`)
- Society selected T&C (`society_terms`)
- WhatsApp promotion metadata (`whatsapp_details`) for `whatsapp_promotional_day`
- Effective dates
- Audit fields

### Not stored in DB (currently code configuration)

Defined in:

- `helper/mediaRateHelper.js`

Configured values:

- Platform list (`MEDIA_TYPES`)
- Duration per platform (`MEDIA_PLATFORM_CONFIG[media_type].duration_days`)
- Generic T&C per platform (`MEDIA_PLATFORM_CONFIG[media_type].generic_terms`)
- Allowed Society checkbox options (`SOCIETY_APPENDABLE_TERMS_OPTIONS`)

> Important: If superadmin must manage duration/generic terms from UI, these should be moved to DB tables/config records.

---

## 3) API Endpoints Used by Media Management

Routes:

- `GET /api/society/media-rate-cards`
- `POST /api/society/media-rate-cards`

Route file:

- `routes/api.js`

Controller:

- `controllers/Society/Profile/Profile_Controller.js`

### GET behavior (`getSocietyMediaRateCards`)

Returns:

- existing active cards for society (`data`)
- platform list (`media_types`)
- allowed society T&C options (`society_terms_options`)
- merged display payload per platform (`platforms`) including:
  - `duration_days` (from helper config)
  - `generic_terms` (from helper config)
  - current active card (if any)

### POST behavior (`upsertSocietyMediaRateCards`)

Input payload:

```json
{
  "cards": [
    {
      "id": 123,
      "media_type": "lift_branding_panels",
      "society_rate": 2500,
      "society_terms": [
        "Society approval is mandatory before any live display."
      ],
      "whatsapp_details": {
        "selected_days": ["mon", "wed", "fri"],
        "from_time": "10:00",
        "to_time": "18:00",
        "whatsapp_group_name": "Tower A Residents",
        "whatsapp_image": "uploads/group-image.png",
        "number_of_flats": 250
      },
      "effective_from": "2026-02-16",
      "effective_to": null
    }
  ]
}
```

Server logic:

1. Validates `media_type` against allowed list.
2. Validates `society_rate > 0`.
3. Validates selected `society_terms` against allowed options.
4. Calculates and stores:
   - `platform_commission_pct`
   - `platform_rate`
   - `company_rate`
5. Prevents overlapping effective date ranges for same society + media type.
6. For `whatsapp_promotional_day`, validates and stores:
   - `selected_days` (Mon-Sun keys)
   - `from_time`, `to_time`
   - `whatsapp_group_name`
   - `whatsapp_image`
   - `number_of_flats`
7. Upserts card rows.
8. Soft-deletes previously active media rows not present in request (`status = 'delete'`).

---

## 4) Offered / Not Offered Mapping

Frontend toggle behavior:

- **Offered = ON** -> media card is included in POST payload.
- **Offered = OFF** -> media card is omitted from payload.

Backend persistence effect:

- Rows omitted from payload are soft-deleted (`status = 'delete'`).
- So offer state is represented by whether an active row exists.

---

## 5) Profile Completion Guard (Current Behavior)

Before saving media rates, frontend checks profile completion from Redux:

- `state.society.profile.profileCompletedPercentage`

If `< 100`:

- Save is blocked
- Popup asks user to complete profile
- On confirmation, redirects to `/society/profile`

This guard is currently **frontend-level** in:

- `portal/src/Components/Society/Profile/Edit/AdvertisementSetting.jsx`

---

## 6) Notes on Schema Updates

There is no separate migration file for this feature in repo currently.
Schema changes are applied via Sequelize sync with alter:

- `server.js` -> `sequelize.sync({ alter: true })`

So new column `society_terms` is created/updated automatically on server start.

