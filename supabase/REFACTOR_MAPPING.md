# Schema Refactor Mapping — Tvé code → Ryan's prod

## Table renames

| Current (tvé) | Target (Ryan) | Notes |
|---|---|---|
| `vendors` | `vendor_profiles` | UUID match |
| `jobs` | `vendor_requests` | UUID match, but M2M via request_vendors |
| `job_messages.job_id` | `job_messages.request_id` | Column rename |
| `job_messages.content` | `job_messages.message` | Column rename |
| (No table) | `request_vendors` | NEW: M2M join with per-vendor job_status |

## Column mapping — vendor_profiles

| Tvé column | Ryan column | Action |
|---|---|---|
| `id` (UUID) | `id` (UUID) | ✓ |
| `email` | `email` | ✓ |
| `first_name + last_name` | `name` | SPLIT/JOIN in app code |
| `business_name` | `business_name` (ADDITIVE — Ryan adding) | ✓ post-additive |
| `phone` | `phone` | ✓ |
| `address` | (state + city + zipcode) | UI split |
| `about` | `about` (ADDITIVE) | ✓ post-additive |
| `trades` (text) | `service_categories` (text[]) | Array conversion |
| `rating` | `rating` | ✓ |
| `radius_miles` | `radius_miles` (ADDITIVE) | ✓ post-additive |
| `insured` | `insured` (ADDITIVE) | ✓ post-additive |
| `notification_prefs` | `notification_prefs` (ADDITIVE) | ✓ post-additive |
| `expo_push_token` | NEEXISTUJE — use `device_tokens` table | REFACTOR |
| `status` | `status` | ✓ |
| `stripe_account_id` | `stripe_account_id` | ✓ |

## Column mapping — vendor_requests (jobs)

| Tvé column | Ryan column | Action |
|---|---|---|
| `id` (UUID) | `id` (UUID) | ✓ |
| `client_name` | `profiles.first_name + last_name` via client_id | JOIN |
| `client_phone` | `profiles.phone` via client_id | JOIN |
| `client_email` | `profiles.email` via client_id | JOIN |
| `address` | `location` | RENAME |
| `zip_code` | `zipcode` | ✓ |
| `trade` | `service_type` | RENAME |
| `description` | `description` | ✓ |
| `urgency` | `priority` (Low/Medium/High) | RENAME + value normalize |
| `status` | `status` (pending/in_progress/completed) | DIFFERENT values |
| `assigned_vendor_id` | NEEXISTUJE — through `request_vendors.vendor_id` | RELATIONSHIP REFACTOR |
| `eta_label` | `eta_label` (ADDITIVE) | ✓ post-additive |
| `eta_datetime` | `eta_datetime` (ADDITIVE) | ✓ post-additive |
| `checkin_time` | `checkin_time` (ADDITIVE) | ✓ post-additive |
| `checkout_time` | `checkout_time` (ADDITIVE) | ✓ post-additive |
| `completion_photo_ids` | `completion_photo_ids` (ADDITIVE) | ✓ post-additive |

## Relationship refactor

**Old model (tvé):**
```
vendors -- 1:N -- jobs (via assigned_vendor_id direct FK)
```

**New model (Ryan):**
```
vendor_profiles -- M:N -- vendor_requests (via request_vendors join)
                                ↓
                          job_status (per-vendor state)
```

Implications:
- A job can be broadcast to N vendors (each with their own job_status)
- Vendor's accept = update request_vendors.job_status = 'in_progress'
- Vendor's decline = update request_vendors.job_status = 'cancelled' (or row delete)
- Chat thread = job_messages WHERE request_id = vendor_requests.id (single thread per job, not per vendor)

## Status enum mapping

**vendor_requests.status:** `pending | in_progress | completed`

**request_vendors.job_status:** `pending | in_progress | on_the_way | arrived | working | completed | cancelled`

**Map tvé statuses do request_vendors.job_status:**

| Tvé status | request_vendors.job_status |
|---|---|
| 'offered' | 'pending' |
| 'accepted' | 'in_progress' |
| 'en_route' | 'on_the_way' |
| 'on_site' | 'arrived' |
| 'working' | 'working' |
| 'completed' | 'completed' |
| 'declined' | 'cancelled' |

## Push tokens refactor

**Old:** `vendors.expo_push_token text`

**New:** `device_tokens` table:
- INSERT on token registration
- ON CONFLICT (user_id, platform) UPDATE token, updated_at

## Files affected (preliminary)

Pending detailed grep. Expected ~80-120 files.
