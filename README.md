# 💊🕒 Medicine Reminder & Management System  

> 🧠 A smart web-based application built with **Node.js**, **Express**, **MongoDB**, and **EJS** that helps users **track their medicines**, **schedule reminders**, and receive **email notifications** automatically.

---

## 🌟 Features  

✨ **User Authentication** – Secure sign-up, login, and profile management using bcrypt & express-session.  
💉 **Medicine Management** – Add, view, or remove medicines with detailed dosage and frequency info.  
📩 **Email Reminders** – Automatic Gmail-based notifications for each scheduled dose.  
📅 **Smart Scheduling** – Timers run in real time using in-memory intervals linked to MongoDB data.  
📊 **Dashboard** – Overview of total medicines & active reminders.  
🔐 **Session Handling** – Persistent sessions stored in MongoDB.  
🧾 **Profile Management** – Update username, email, or password directly from the dashboard.  

---

## 🛠️ Tech Stack  

| Category | Tools Used |
|-----------|-------------|
| 🌐 Backend | [Node.js](https://nodejs.org/) + [Express.js](https://expressjs.com/) |
| 🗄️ Database | [MongoDB](https://www.mongodb.com/) + [Mongoose](https://mongoosejs.com/) |
| 🔐 Authentication | [bcrypt](https://www.npmjs.com/package/bcrypt), [express-session](https://www.npmjs.com/package/express-session), [connect-mongo](https://www.npmjs.com/package/connect-mongo) |
| 📤 Email Service | [Nodemailer](https://nodemailer.com/about/) |
| 🎨 Frontend | [EJS Templates](https://ejs.co/) + Static Public Assets (CSS/JS) |
| ⚙️ Others | dotenv, body-parser, fs, path |

---

## 🚀 Getting Started  

### 🧩 Prerequisites  
Make sure you have:  
- 🟢 Node.js (v16+ recommended)  
- 🍃 MongoDB (local or cloud via MongoDB Atlas)  
- 📧 A Gmail account for sending reminders  

---

### ⚙️ Installation  

1️⃣ **Clone this repository**
```bash
git clone https://github.com/your-username/medicine-reminder.git
cd medicine-reminder
2️⃣ Install dependencies

bash
Copy code
npm install
3️⃣ Create a .env file in the root directory
Example:

env
Copy code
PORT=3000
MONGO_URI=your_mongodb_connection_string
SESSION_SECRET=your_secret_key
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
4️⃣ Run the app

bash
Copy code
node app.js
✅ Server will start at:
👉 http://localhost:3000

📁 Folder Structure
bash
Copy code
medicine-reminder/
│
├── public/              # Static assets (CSS, JS, images)
├── views/               # EJS templates
├── config.js            # Database models (User & Medicine)
├── app.js               # Main Express application
├── .env                 # Environment variables
└── package.json
📬 Email Reminder Flow
📌 When you add a medicine with an email ID:

The system calculates the frequency interval.

A background timer triggers reminders.

The user receives a friendly email notification every time it’s medicine time.

Once the course duration ends, reminders automatically stop.

👤 User Routes Overview
Route	Description
/	Homepage
/sign_up	Create new account
/sign_in	Login existing user
/logout	End session
/profile	View & update user profile
/add_medicine	Add medicines
/show_details	List all added medicines
/set_reminder	Enable/disable reminders
/remove_medicine	Delete medicine entry
/dashboard	Overview stats
/contact & /about	Static info pages

🔒 Security
Passwords are hashed using bcrypt.

Sessions are securely stored with connect-mongo.

Environment variables are hidden via .env.

No plain-text credentials are ever saved.

📧 Example Reminder Email
Subject: Medicine Reminder
Body: 💊 Reminder: Time to take your medicine 'Paracetamol' - Dosage: 500mg

💻 Preview
🖥️ Dashboard Example
Displays total medicines & active reminders.
📩 Email Notifications
Arrive automatically at scheduled intervals.

🤝 Contributing
Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to improve.

🧑‍💻 Author
👨‍💻 Md Saif Ali
🔗 GitHub Profile

📄 License
🪪 This project is licensed under the MIT License – feel free to use, modify, and distribute.

⭐ Support
If you like this project, don’t forget to star ⭐ it on GitHub!
Your support motivates further improvements 💖