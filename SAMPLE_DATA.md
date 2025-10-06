# Sample Data for Waitlist Management System

This document contains information about the sample data that can be seeded into the database for testing and development purposes.

## Running the Seeds

To populate the database with sample data:

```bash
# Run migrations first (if not already done)
npm run migrate

# Seed the database with sample data
npm run seed

# Or reset and seed everything
npm run db:reset
```

## Sample Tenants

| Tenant Name | Timezone | Business Type |
|-------------|----------|---------------|
| Bella Vista Salon | America/New_York | Hair Salon |
| Downtown Barbershop | America/Los_Angeles | Barbershop |
| Elite Spa & Wellness | America/Chicago | Spa & Wellness |

## Sample User Accounts

### Bella Vista Salon
- **Admin**: admin@bellavista.com / admin123
- **Manager**: manager@bellavista.com / manager123
- **Staff**: emily@bellavista.com / staff123
- **Staff**: jessica@bellavista.com / staff123

### Downtown Barbershop
- **Admin**: admin@downtownbarber.com / admin123
- **Staff**: tony@downtownbarber.com / staff123
- **Staff**: carlos@downtownbarber.com / staff123

### Elite Spa & Wellness
- **Admin**: admin@elitespa.com / admin123
- **Manager**: manager@elitespa.com / manager123
- **Staff**: sophia@elitespa.com / staff123

## Sample Services

### Bella Vista Salon
- Haircut & Style (60 min) - $65.00
- Hair Color (120 min) - $120.00
- Highlights (150 min) - $150.00
- Blowout (45 min) - $45.00

### Downtown Barbershop
- Classic Haircut (30 min) - $25.00
- Beard Trim (20 min) - $15.00
- Hot Towel Shave (45 min) - $35.00
- Haircut & Beard Package (45 min) - $35.00

### Elite Spa & Wellness
- Swedish Massage (60 min) - $90.00
- Deep Tissue Massage (90 min) - $130.00
- European Facial (75 min) - $85.00
- Manicure & Pedicure (90 min) - $65.00
- Body Wrap (120 min) - $110.00
- Wellness Consultation (45 min) - $75.00

## Sample Staff Members

### Bella Vista Salon
- Emily Chen - Hair Stylist
- Jessica Williams - Color Specialist
- Maria Rodriguez - Senior Stylist

### Downtown Barbershop
- Tony Martinez - Master Barber
- Carlos Rivera - Barber
- Jake Wilson - Junior Barber

### Elite Spa & Wellness
- Sophia Davis - Massage Therapist
- Lisa Park - Esthetician
- Rachel Green - Nail Technician
- Jennifer Lee - Wellness Coach

## Notes

- All passwords are hashed using bcrypt
- UUIDs are used for all primary keys
- Sample data includes realistic business scenarios for testing
- Each tenant is isolated with their own users, staff, and services
- All users are active by default

## Security Note

**Important**: These are sample credentials for development/testing only. Never use these credentials in production environments.