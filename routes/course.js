import express from "express";
import formidable from "express-formidable";

const router = express.Router();

// middlewares
import { requireSignin, isInstructor, isEnrolled } from "../middlewares";

// controllers
import {
  uploadImage,
  removeImage,
  createCourse,
  updateCourse,
  singleCourse,
  videoUpload,
  videoRemove,
  addLesson,
  updateLesson,
  removeLesson,
  publishCourse,
  unpublishCourse,
  allPublishedCourses,
  checkEnrollment,
  freeEnrollment,
  paidEnrollment,
  stripeSuccess,
  userCourses,
  markCompleted,
  listCompleted,
  markInompleted,
} from "../controllers/course";

// image
router.post("/course/upload-image", requireSignin, uploadImage);
router.post("/course/remove-image", requireSignin, removeImage);

// course
router.get("/courses", allPublishedCourses);
router.post("/course", requireSignin, isInstructor, createCourse);
router.put("/course/publish/:slug", requireSignin, isInstructor, publishCourse);
router.put(
  "/course/unpublish/:slug",
  requireSignin,
  isInstructor,
  unpublishCourse
);
router.put("/course/:slug", requireSignin, isInstructor, updateCourse);
router.get("/course/:slug", singleCourse);

// video
router.post(
  "/course/video-upload/:instructorId",
  requireSignin,
  isInstructor,
  formidable(),
  videoUpload
);
router.post(
  "/course/video-remove/:instructorId",
  requireSignin,
  isInstructor,
  videoRemove
);

// lesson
router.post(
  "/course/lesson/:slug/:instructorId",
  requireSignin,
  isInstructor,
  addLesson
);
router.put(
  "/course/lesson/:slug/:lessonId",
  requireSignin,
  isInstructor,
  updateLesson
);
router.put(
  "/course/:slug/:lessonId",
  requireSignin,
  isInstructor,
  removeLesson
);

// enrollment
router.get("/check-enrollment/:courseId", requireSignin, checkEnrollment);
router.post("/free-enrollment/:courseId", requireSignin, freeEnrollment);
router.post("/paid-enrollment/:courseId", requireSignin, paidEnrollment);
router.get("/stripe-success/:courseId", requireSignin, stripeSuccess);

// user courses
router.get("/user-courses", requireSignin, userCourses);
router.get("/user/course/:slug", requireSignin, isEnrolled, singleCourse);

// mark completed
router.post("/mark-completed", requireSignin, markCompleted);
router.post("/mark-incompleted", requireSignin, markInompleted);
router.post("/list-completed", requireSignin, listCompleted);

module.exports = router;
