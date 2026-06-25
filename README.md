# Task Management App

A simple full-stack task management application with user authentication, task CRUD operations, and a responsive UI.

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:4000` in your browser.

## Features

- Register and login users
- Create, read, update, delete tasks
- Tasks are scoped to the authenticated user
- Responsive design for desktop and mobile

## Notes

- Uses SQLite database file `tasks.db`
- Default JWT secret is `taskapp_secret_key`; set `JWT_SECRET` for production
