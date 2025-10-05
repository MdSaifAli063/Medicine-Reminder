const mongoose = require("mongoose");

// Create Schema
const Loginschema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, // Ensure username is unique
  },
  password: {
    type: String,
    required: true,
  },
});

// collection part
// Note: Model name is "users" (unusual). If you change it, ensure you update all usages.
const User = mongoose.model("users", Loginschema);

// Medicine schema/model
const MedicineSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users", // matches the model name above
      required: false, // set true if every medicine must belong to a user
    },
    medicine_name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    frequency: { type: Number, required: true, min: 1 },
    duration_type: { type: String, required: true }, // e.g., "days"
    start_date: { type: Date, required: true },
    end_date: { type: Date },
    recipient_email: { type: String, trim: true, lowercase: true },
    reminder_set: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Medicine = mongoose.model("Medicine", MedicineSchema);

module.exports = { User, Medicine, mongoose };