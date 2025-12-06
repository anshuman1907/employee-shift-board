Steps to Run:
# start backend:
1. cd backend
2. npm install
3. npm run dev

# Run frontend:
1. cd frontend
2. npm install
3. npm start


## Backend Features Added:

- JWT-based authentication
- Seeded users (admin + demo user)
- Staff members and their shifts saved in CSV file, we can move to 
- Business policies: each employee cannot have overlapping shifts on the date; every shift should be at least 4 hours long


## API Endpoints:
- POST /login { email, password } -> { token }
- GET /employees (authentication needed)
- POST /shifts (auth + admin) { employee_code, date, start_time, end_time }
- GET /shifts?employee=E002&date=2025-12-01 (authentication needed)
- DELETE /shift/:id (auth + admin)

## Demo credentials (for login page):
- Admin: admin@company.local / Admin@2025!
- Demo user: hire-me@anshumat.org / HireMe@2025!
- Demo credentials are pre-filled on the login page.


## Postman Collections:
<a href="./postman_collection.json">postman_collection</a>