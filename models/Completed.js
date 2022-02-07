import { Schema, model } from "mongoose";

const { ObjectId } = Schema;

const completedSchema = new Schema(
  {
    user: {
      type: ObjectId,
      ref: "User",
    },
    course: {
      type: ObjectId,
      ref: "Course",
    },
    lessons: [],
  },
  { timestamps: true }
);

export default model("Completed", completedSchema);
