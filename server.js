require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { User } = require("./config");
const { Medicine } = require("./config");

const app = express();
const PORT = process.env.PORT || 3000;
console.log("🔍 Loaded MONGO_URI:", process.env.MONGO_URI);

app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 14 * 24 * 60 * 60,
    }),
  })
);

const DATA_FILE = "medicine_schedule.json";
let medicineSchedule = [];
// Key timers by MongoDB document id
let reminderIntervals = {};

// Middleware
function requireLogin(req, res, next) {
  if (req.session.loggedIn) next();
  else res.redirect("/sign_in");
}

// File persistence used by dashboard (legacy; reminders moved to DB)
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
  }
  return [];
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4));
}

function sendEmailReminder(subject, message, toEmail) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: toEmail,
    subject,
    text: message,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("❌ Email error:", err);
    else console.log("✅ Email sent:", info.response);
  });
}

// Helper: schedule reminder for a medicine document (uses in-memory timer)
function scheduleReminderForMedicine(medicine, userId) {
  const id = medicine._id.toString();

  // Clear any existing interval for this id
  if (reminderIntervals[id]) {
    clearInterval(reminderIntervals[id]);
    delete reminderIntervals[id];
  }

  // Use mutable currentStart so we don't rely on reloading the doc each tick
  let currentStart = new Date(medicine.start_date);

  const interval = setInterval(async () => {
    try {
      const now = new Date();
      const end = medicine.end_date ? new Date(medicine.end_date) : null;

      if (end && now > end) {
        // Reached end of course; stop reminders and flip flag in DB
        clearInterval(interval);
        delete reminderIntervals[id];
        await Medicine.updateOne(
          { _id: id, userId },
          { $set: { reminder_set: false } }
        );
        return;
      }

      // Interpret frequency as seconds (as in your previous logic)
      const nextDose = new Date(currentStart.getTime() + medicine.frequency * 1000);

      if (nextDose <= now) {
        const msg = `Reminder: Time to take your medicine '${medicine.medicine_name}' - Dosage: ${medicine.dosage}`;
        console.log(msg);
        if (medicine.recipient_email) {
          sendEmailReminder("Medicine Reminder", msg, medicine.recipient_email);
        }

        // Advance the schedule and persist to DB
        currentStart = nextDose;
        medicine.start_date = nextDose;

        await Medicine.updateOne(
          { _id: id, userId },
          { $set: { start_date: nextDose, reminder_set: true } }
        );
      }
    } catch (e) {
      console.error("❌ Reminder interval error:", e);
    }
  }, 1000);

  reminderIntervals[id] = interval;
}

// Routes
app.get("/", (req, res) => {
  res.render("index", { loggedIn: req.session.loggedIn });
});

app.get("/add_medicine", requireLogin, (req, res) => {
  res.render("add_medicine", { loggedIn: req.session.loggedIn });
});

/**
 * Handler to add one or many medicines to MongoDB.
 * This was previously exported but never registered. It is now local and wired below.
 */
const handleAddMedicine = async (req, res, next) => {
  try {
    const n = parseInt(req.body.n, 10) || 0;

    // Ensure we have userId in session to associate docs
    let userId = req.session.userId;
    if (!userId && req.session.username) {
      // Backfill userId if missing
      const u = await User.findOne({ name: req.session.username }).select("_id");
      if (u) {
        userId = u._id;
        req.session.userId = u._id;
      }
    }

    const docs = [];

    for (let i = 0; i < n; i++) {
      const medicine_name = req.body[`medicine_name_${i}`];
      const dosage = req.body[`dosage_${i}`];
      const frequency = parseInt(req.body[`frequency_${i}`], 10);
      const duration_type = req.body[`duration_type_${i}`];
      const startDateStr = req.body[`start_date_${i}`];
      const recipient_email = req.body[`recipient_email_${i}`];

      if (!medicine_name || !dosage || !frequency || !duration_type || !startDateStr) {
        continue;
      }

      const start_date = new Date(startDateStr);
      const doc = {
        userId,
        medicine_name,
        dosage,
        frequency,
        duration_type,
        start_date,
        recipient_email,
        reminder_set: false,
      };

      if (duration_type === "days") {
        const duration = parseInt(req.body[`duration_${i}`], 10);
        if (!Number.isNaN(duration)) {
          const endDate = new Date(start_date);
          endDate.setDate(endDate.getDate() + duration);
          doc.end_date = endDate;
        }
      }

      docs.push(doc);
    }

    if (docs.length > 0) {
      await Medicine.insertMany(docs);
    }

    res.redirect("/show_details");
  } catch (err) {
    next(err);
  }
};

// Register the POST route so it is actually reachable
app.post("/add_medicine", requireLogin, handleAddMedicine);

// Toggle reminder using MongoDB
app.post("/set_reminder", requireLogin, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const medicineId = req.body.medicine_id || req.body.medicineId;
    const medicineName = req.body.medicine_name;

    // Prefer id, fallback to name for backward compatibility
    const query = { userId };
    if (medicineId) query._id = medicineId;
    else if (medicineName) query.medicine_name = medicineName;

    const medicine = await Medicine.findOne(query);
    if (!medicine) {
      console.warn("⚠️ Medicine not found for reminder toggle", query);
      return res.redirect("/show_details");
    }

    const id = medicine._id.toString();

    if (medicine.reminder_set) {
      // Turn off
      if (reminderIntervals[id]) {
        clearInterval(reminderIntervals[id]);
        delete reminderIntervals[id];
      }
      medicine.reminder_set = false;
      await medicine.save();
    } else {
      // Turn on
      medicine.reminder_set = true;
      await medicine.save();
      scheduleReminderForMedicine(medicine.toObject(), userId);
    }

    res.redirect("/show_details");
  } catch (err) {
    next(err);
  }
});

// Remove medicine from MongoDB (and stop any running reminder)
app.post("/remove_medicine", requireLogin, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const medicineId = req.body.medicine_id || req.body.medicineId;
    const medicineName = req.body.medicine_name;

    // Find the document first to clear interval safely
    const query = { userId };
    if (medicineId) query._id = medicineId;
    else if (medicineName) query.medicine_name = medicineName;

    const medicine = await Medicine.findOne(query).select("_id");
    if (!medicine) {
      console.warn("⚠️ Medicine not found for removal", query);
      return res.redirect("/show_details");
    }

    const id = medicine._id.toString();

    if (reminderIntervals[id]) {
      clearInterval(reminderIntervals[id]);
      delete reminderIntervals[id];
    }

    await Medicine.deleteOne({ _id: id, userId });
    res.redirect("/show_details");
  } catch (err) {
    next(err);
  }
});

// Read medicines from MongoDB so the newly added entries are visible
app.get("/show_details", requireLogin, async (req, res, next) => {
  try {
    const filter = req.session.userId ? { userId: req.session.userId } : {};
    const meds = await Medicine.find(filter).sort({ createdAt: -1 }).lean();
    res.render("show_details", {
      medicine_schedule: meds,
      loggedIn: req.session.loggedIn,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/sign_up", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    const existingUser = await User.findOne({ name: username });
    if (existingUser) return res.send("User already exists. Please choose a different username.");

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name: username,
      password: hashedPassword,
      email: email || "",
    });
    console.log("✅ Signup successful:", newUser);

    // set session so profile shows correct info
    req.session.loggedIn = true;
    req.session.username = newUser.name;
    req.session.email = newUser.email || "";
    req.session.userId = newUser._id; // ensure userId available for medicine association

    return res.redirect("/profile");
  } catch (err) {
    console.error("❌ Signup error:", err);
    return res.status(500).send("Error during signup.");
  }
});

app.post("/sign_in", async (req, res) => {
  try {
    const user = await User.findOne({ name: req.body.username });
    if (!user) return res.send("Username not found");

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) return res.send("Wrong password");

    // set session and include username + email + userId
    req.session.loggedIn = true;
    req.session.username = user.name;
    req.session.email = user.email || "";
    req.session.userId = user._id;

    return res.redirect("/");
  } catch (err) {
    console.error("❌ Login error:", err);
    return res.status(500).send("Login error");
  }
});

app.get("/sign_in", (req, res) => {
  res.render("sign_in", { loggedIn: req.session.loggedIn });
});

app.get("/sign_up", (req, res) => {
  res.render("sign_up", { loggedIn: req.session.loggedIn });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/dashboard", requireLogin, (req, res) => {
  // Still using legacy file data for dashboard counts; optionally migrate to DB later
  const schedule = loadData();
  const totalMedicines = schedule.length;
  const activeReminders = schedule.filter((m) => m.reminder_set).length;

  res.render("dashboard", {
    totalMedicines,
    activeReminders,
    loggedIn: req.session.loggedIn,
  });
});

app.get("/contact", (req, res) => {
  res.render("contact", { loggedIn: req.session.loggedIn });
});
app.get("/about", (req, res) => {
  res.render("about", { loggedIn: req.session.loggedIn });
});

// require login to view/edit profile and pass session values to template
app.get("/profile", requireLogin, (req, res) => {
  res.render("profile", {
    loggedIn: req.session.loggedIn,
    username: req.session.username || "",
    email: req.session.email || "",
  });
});

// update profile: find user by current session username, update fields and session
app.post("/profile", requireLogin, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const currentUsername = req.session.username;
    const user = await User.findOne({ name: currentUsername });
    if (!user) return res.send("User not found");

    if (username && username !== user.name) {
      const collision = await User.findOne({ name: username });
      if (collision) return res.send("Username already taken.");
      user.name = username;
    }

    if (email) {
      user.email = email;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    req.session.username = user.name;
    req.session.email = user.email || "";

    console.log("✅ Profile updated successfully:", user);
    res.redirect("/profile");
  } catch (err) {
    console.error("❌ Profile update error:", err);
    res.status(500).send("Error updating profile.");
  }
});

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      ssl: true,
      tls: true,
      tlsInsecure: false,
    });
    console.log("✅ Database Connected Successfully");

    medicineSchedule = loadData();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Database cannot be Connected", err);
    process.exit(1);
  }
}

startServer();