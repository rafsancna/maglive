import type { SafeAdminDto } from "@maglive/contracts";
import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

export type User = {
  email: string;
  passwordHash: string;
  role: "admin";
  active: boolean;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      unique: true,
      index: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
      immutable: true,
      required: true
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
      index: true
    },
    lastLoginAt: Date,
    passwordChangedAt: Date
  },
  {
    collection: "users",
    timestamps: true,
    versionKey: "version",
    toJSON: {
      transform(_document, returnedObject) {
        Reflect.deleteProperty(returnedObject, "passwordHash");
        return returnedObject;
      }
    },
    toObject: {
      transform(_document, returnedObject) {
        Reflect.deleteProperty(returnedObject, "passwordHash");
        return returnedObject;
      }
    }
  }
);

export const UserModel: Model<User> =
  (mongoose.models.User as Model<User> | undefined) ?? mongoose.model<User>("User", userSchema);

export function toSafeAdminDto(user: UserDocument): SafeAdminDto {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role
  };
}
