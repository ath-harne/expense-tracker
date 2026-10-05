import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },
    passwordHash: {
        type: String,
        required: true,
        select: false
    }
}, { timestamps: true });

UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);