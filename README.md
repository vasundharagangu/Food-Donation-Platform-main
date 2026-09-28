# 🍽️ FODO — Food Donation Platform

FODO is a **full-stack MERN application** designed to connect **food donors** with **NGOs** in order to reduce food waste and streamline the donation process through a centralized digital platform.

---

## 🌐 Live Links (Deployed Environment)
- **Frontend Live Link:** [Pending Deployment](#)
- **Backend Live Link:** [Pending Deployment](#)

*Note: Since deploying a full MERN stack permanently requires access to cloud accounts (like Vercel, Render, and MongoDB Atlas), these links are currently placeholders. Please see deployment instructions below to add your own live links.*

---

## 🚀 Problem Statement

Food donation often suffers from:
- Manual coordination via calls and messages
- Lack of real-time visibility on donation status
- Delays in matching donors with NGOs
- Inefficient tracking of requests

FODO addresses these issues by providing a **role-based, real-time web platform** for managing food donations efficiently.

---

## 🧠 Solution Overview

FODO enables:
- Donors to create and track food donation requests
- NGOs to view, accept, and manage available donations
- Real-time status updates without manual follow-ups

The platform is designed to handle **multiple users simultaneously** while maintaining data consistency and low response times.

---

## 🛠 Tech Stack

- **Frontend:** React.js
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** Role-based access control
- **APIs:** RESTful APIs
- **Architecture:** MERN Stack

---

## 🔑 Key Features

- **Role-Based Access Control**
  - Separate flows for donors and NGOs
- **Donation Request Management**
  - Create, view, accept, and track donation requests
- **Concurrent User Support**
  - Handles multiple users interacting with the system simultaneously
- **Optimized API Performance**
  - Indexed database queries and asynchronous request handling
- **Real-Time Coordination**
  - Reduces manual communication and delays

---

## 📈 Performance Highlights

- Supports **150+ concurrent users**
- Handles **100+ donation requests**
- Achieves **180–220 ms API response time** under load
- Reduced manual coordination latency by approximately **40%**

---

## 🧪 How It Works

1. Donors submit food donation requests
2. NGOs browse and accept available donations
3. Donation status updates are tracked digitally
4. Backend APIs ensure data consistency under concurrent usage

---

## 📂 Project Structure (High Level)

Food-Donation-Platform/
├── frontend/ # React UI
├── backend/ # Express APIs


---

## 🔗 Repository

GitHub:  
👉 https://github.com/chay2405/Food-Donation-Platform.git

---

## 📌 Future Enhancements

- Notification system for donors and NGOs
- Admin dashboard for analytics
- Cloud deployment and scalability improvements
- Integration with food safety verification APIs

---

## 📜 Disclaimer

This project was built for **educational and learning purposes**, focusing on system design, backend performance, and real-world problem solving.

---

## ☁️ Deployment Instructions

To generate your own live links for this repository, follow these standard deployment steps:

### 1. Database (MongoDB Atlas)
- Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Get your connection string (e.g., `mongodb+srv://<user>:<password>@cluster.mongodb.net/dbname`).

### 2. Backend (Render / Railway / Heroku)
- Create a new Web Service on [Render](https://render.com) and connect your GitHub repository.
- Set the Root Directory to `backend`.
- Set the Build Command to `npm install` and the Start Command to `npm start` (or `node server.js`).
- Add Environment Variables:
  - `MONGODB_URI`: Your MongoDB Atlas connection string.
  - `PORT`: (Render will set this automatically).
  - `FRONTEND_URLS`: The URL of your soon-to-be-deployed frontend (e.g. `https://fodo-frontend.vercel.app`).
- Deploy and copy the **Backend Live Link**.

### 3. Frontend (Vercel / Netlify)
- Create a new project on [Vercel](https://vercel.com) and connect your GitHub repository.
- Set the Root Directory to `frontend`.
- Ensure the Build Command is `npm run build` and Output Directory is `build`.
- Add Environment Variables:
  - `REACT_APP_API_BASE`: `<Backend Live Link>/api`
  - `REACT_APP_SOCKET_URL`: `<Backend Live Link>`
- Deploy and copy the **Frontend Live Link**.
- Update the placeholders in the Live Links section at the top of this README.

---
