import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type Language = {
  code: string;
  languageTag: string;
  acceptLanguageAliases: string[];
  direction: "ltr" | "rtl";
  fallback: string;
  label: string;
  nativeLabel: string;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type LanguageDocument = HydratedDocument<Language>;

const languageSchema = new Schema<Language>(
  {
    code: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 24,
      match: /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/,
    },
    languageTag: { type: String, required: true, trim: true, maxlength: 64 },
    acceptLanguageAliases: {
      type: [String],
      required: true,
      default: () => [],
      validate: {
        validator: (value: string[]) => value.length <= 20,
        message: "A language cannot have more than 20 Accept-Language aliases.",
      },
    },
    direction: { type: String, enum: ["ltr", "rtl"], required: true },
    fallback: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    nativeLabel: { type: String, required: true, trim: true, maxlength: 80 },
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  {
    collection: "languages",
    timestamps: true,
    versionKey: false,
  },
);

languageSchema.index({ code: 1 }, { unique: true });
languageSchema.index({ languageTag: 1 }, { unique: true });

export const LanguageModel: Model<Language> =
  (mongoose.models.Language as Model<Language> | undefined) ??
  mongoose.model<Language>("Language", languageSchema);
