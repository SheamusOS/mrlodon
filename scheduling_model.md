# Trails & Tails Dog Adventures — Scheduling Model

## Purpose
Provide a clear data model and scheduling flow for customers who want to schedule dog walks on the Trails & Tails Dog Adventures website.

## Core Entities
### Customer
- `id` (UUID)
- `full_name` (string)
- `email` (string)
- `phone` (string)
- `preferred_contact` (enum: `email`, `phone`, `text`)
- `address` (string)
- `timezone` (IANA string, e.g., `America/Los_Angeles`)
- `notes` (string, optional)

### Pet
- `id` (UUID)
- `customer_id` (UUID)
- `name` (string)
- `breed` (string, optional)
- `size` (enum: `small`, `medium`, `large`)
- `age_years` (number, optional)
- `temperament` (string, optional)
- `special_needs` (string, optional)
- `vet_contact` (string, optional)

### Service
- `id` (UUID)
- `name` (enum: `solo_walk`, `group_walk`, `hike_adventure`, `drop_in`)
- `duration_minutes` (integer)
- `price_cents` (integer)
- `max_group_size` (integer, optional)
- `description` (string)

### Walker
- `id` (UUID)
- `full_name` (string)
- `email` (string)
- `phone` (string)
- `service_areas` (array of strings)
- `working_hours` (object; see Availability)
- `skills` (array of strings, optional)

### Availability
Store availability per walker to drive the booking calendar.
- `walker_id` (UUID)
- `weekday` (enum: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`)
- `start_time` (HH:MM)
- `end_time` (HH:MM)
- `capacity` (integer; number of concurrent bookings)

### Booking Request
Submitted by the customer before confirmation.
- `id` (UUID)
- `customer_id` (UUID)
- `pet_ids` (array of UUID)
- `service_id` (UUID)
- `preferred_date` (YYYY-MM-DD)
- `preferred_time_window` (object: `start_time`, `end_time`)
- `recurrence` (enum: `one_time`, `weekly`, `biweekly`, `custom`)
- `recurrence_details` (string, optional)
- `notes` (string, optional)
- `status` (enum: `pending`, `confirmed`, `declined`)

### Booking
Confirmed schedule entry.
- `id` (UUID)
- `customer_id` (UUID)
- `pet_ids` (array of UUID)
- `service_id` (UUID)
- `walker_id` (UUID)
- `start_at` (timestamp)
- `end_at` (timestamp)
- `status` (enum: `scheduled`, `completed`, `canceled`, `no_show`)
- `price_cents` (integer)
- `payment_status` (enum: `unpaid`, `paid`, `refunded`)
- `notes` (string, optional)

## Scheduling Flow
1. Customer submits a **Booking Request** with pets, service, preferred date/time window, and recurrence.
2. System matches against **Availability** and **Service** constraints.
3. If an acceptable slot is found, create a **Booking** and assign a **Walker**.
4. Send confirmation to the customer; allow customer to reschedule or cancel with policy rules.

## Validation Rules
- `start_at`/`end_at` must fall within assigned walker availability.
- `end_at - start_at` must match the selected service duration.
- Group services must not exceed `max_group_size` for the service.
- Recurring bookings should be expanded into future **Booking** instances.

## Example JSON Payloads
### Booking Request (from website form)
```json
{
  "customer_id": "c3a96b7e-1d2e-4f5d-9f0a-9cc0e0e0c0d9",
  "pet_ids": ["bd2a61b1-5952-4b0e-91a3-1c60c5d52b13"],
  "service_id": "a7a4b4c0-8f68-43cf-bb5e-2ec6b1d2e7d4",
  "preferred_date": "2025-05-20",
  "preferred_time_window": {
    "start_time": "10:00",
    "end_time": "12:00"
  },
  "recurrence": "weekly",
  "notes": "Please bring a gentle harness."
}
```

### Booking (confirmed)
```json
{
  "customer_id": "c3a96b7e-1d2e-4f5d-9f0a-9cc0e0e0c0d9",
  "pet_ids": ["bd2a61b1-5952-4b0e-91a3-1c60c5d52b13"],
  "service_id": "a7a4b4c0-8f68-43cf-bb5e-2ec6b1d2e7d4",
  "walker_id": "5d6b1d1a-3b6e-4e1a-8c5b-8de6c6c5e2d3",
  "start_at": "2025-05-20T10:00:00-07:00",
  "end_at": "2025-05-20T11:00:00-07:00",
  "status": "scheduled",
  "price_cents": 3500,
  "payment_status": "unpaid"
}
```
