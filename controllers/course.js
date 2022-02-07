import AWS from "aws-sdk";
import { nanoid } from "nanoid";
import Course from "../models/Course";
import Completed from "../models/Completed";
import slugify from "slugify";
import { readFileSync } from "fs";
import User from "../models/User";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

const S3 = new AWS.S3(awsConfig);

export const uploadImage = async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).send("Please provide an image.");

    // prepare the image
    const base64Data = new Buffer.from(
      image.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    const type = image.split(";")[0].split("/")[1];

    // image params
    const params = {
      Bucket: "mazen-edemy-course-bucket",
      Key: `${nanoid()}.${type}`,
      Body: base64Data,
      ACL: "public-read",
      ContentEncoding: "base64",
      ContentType: `image/${type}`,
    };

    const data = await S3.upload(params).promise();
    res.send(data);
    //
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const removeImage = async (req, res) => {
  try {
    const { image } = req.body;

    // image params
    const params = {
      Bucket: image.Bucket,
      Key: image.Key,
    };

    // send remove request to aws
    await S3.deleteObject(params).promise();
    res.send({ ok: true });

    //
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const createCourse = async (req, res) => {
  try {
    const alreadyExists = await Course.findOne({
      slug: slugify(req.body.name.toLowerCase()),
    });

    if (alreadyExists) return res.status(400).send("Title already taken.");

    const course = await new Course({
      slug: slugify(req.body.name),
      instructor: req.user._id,
      ...req.body,
    }).save();

    res.json(course);
    //
  } catch (err) {
    console.log(err);
    return res.status(400).send("Course creation failed. Try again.");
  }
};

export const publishCourse = async (req, res) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ slug });

    if (req.user._id !== course.instructor.toString()) {
      return res.status(400).send("Unauthorized action.");
    }

    const updated = await Course.findOneAndUpdate(
      { slug },
      { published: true },
      {
        new: true,
      }
    );

    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Course publish failed. Try again.");
  }
};

export const unpublishCourse = async (req, res) => {
  try {
    const { slug } = req.params;
    const course = await Course.findOne({ slug });

    if (req.user._id !== course.instructor.toString()) {
      return res.status(400).send("Unauthorized action.");
    }

    const updated = await Course.findOneAndUpdate(
      { slug },
      { published: false },
      {
        new: true,
      }
    );

    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Course unpublish failed. Try again.");
  }
};

export const updateCourse = async (req, res) => {
  try {
    const { slug } = req.params;

    const course = await Course.findOne({ slug });

    if (req.user._id !== course.instructor.toString()) {
      return res.status(400).send("Unauthorized action.");
    }

    const updated = await Course.findOneAndUpdate({ slug }, req.body, {
      new: true,
    });

    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Course update failed. Try again.");
  }
};

export const singleCourse = async (req, res) => {
  try {
    const course = await Course.findOne({ slug: req.params.slug }).populate(
      "instructor",
      "_id name"
    );
    res.json(course);
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const videoUpload = async (req, res) => {
  try {
    if (req.user._id !== req.params.instructorId) {
      return res.status(400).send("Unauthorized action.");
    }

    const { video } = req.files;
    if (!video) return res.status(400).send("Please provide a video.");

    // video params
    const params = {
      Bucket: "mazen-edemy-course-bucket",
      Key: `${nanoid()}.${video.type.split("/")[1]}`,
      Body: readFileSync(video.path),
      ACL: "public-read",
      ContentType: video.type,
    };

    // upload to s3
    const data = await S3.upload(params).promise();
    res.send(data);
    //
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const videoRemove = async (req, res) => {
  try {
    if (req.user._id !== req.params.instructorId) {
      return res.status(400).send("Unauthorized action.");
    }

    const { video } = req.body;
    if (!video) return res.status(400).send("Please provide a video.");

    // video params
    const params = {
      Bucket: video.Bucket,
      Key: video.Key,
    };

    // upload to s3
    const data = await S3.deleteObject(params).promise();
    res.send({ ok: true });
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const addLesson = async (req, res) => {
  try {
    const { slug, instructorId } = req.params;
    const { title, content, video } = req.body;

    if (req.user._id !== instructorId) {
      return res.status(400).send("Unauthorized action.");
    }

    const updated = await Course.findOneAndUpdate(
      { slug },
      { $push: { lessons: { title, content, video, slug: slugify(title) } } },
      { new: true }
    ).populate("instructor", "_id name");

    res.json(updated);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Add lesson failed.");
  }
};

export const removeLesson = async (req, res) => {
  try {
    const { slug, lessonId } = req.params;
    const course = await Course.findOne({ slug });
    if (req.user._id !== course.instructor.toString()) {
      return res.status(400).send("Unauthorized action.");
    }

    const updatedCourse = await Course.findByIdAndUpdate(course._id, {
      $pull: { lessons: { _id: lessonId } },
    });

    const deletedLesson = updatedCourse.lessons.filter(
      (item) => item._id.toString() === lessonId
    )[0];

    if (deletedLesson && deletedLesson.video) {
      const params = {
        Bucket: deletedLesson.video.Bucket,
        Key: deletedLesson.video.Key,
      };
      await S3.deleteObject(params).promise();
    }

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Course update failed. Try again.");
  }
};

export const updateLesson = async (req, res) => {
  try {
    const { slug } = req.params;
    const { _id, title, content, video, free_preview } = req.body;

    const course = await Course.findOne({ slug });
    if (req.user._id !== course.instructor.toString()) {
      return res.status(400).send("Unauthorized action.");
    }

    const updatedCourse = await Course.updateOne(
      { "lessons._id": _id },
      {
        $set: {
          "lessons.$.title": title,
          "lessons.$.slug": slugify(title),
          "lessons.$.content": content,
          "lessons.$.video": video,
          "lessons.$.free_preview": free_preview,
        },
      },
      { new: true }
    );

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Lesson update failed. Try again.");
  }
};

export const allPublishedCourses = async (req, res) => {
  try {
    const all = await Course.find({ published: true }).populate(
      "instructor",
      "_id name"
    );
    res.json(all);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Fetching courses failed. Try again.");
  }
};

export const checkEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    const user = await User.findById(req.user._id);

    let ids = [];
    let length = user.courses && user.courses.length;
    for (let i = 0; i < length; i++) {
      ids.push(user.courses[i].toString());
    }

    const status = ids.includes(courseId);

    res.json({
      status,
      course,
    });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Check enrollment failed. Try again.");
  }
};

export const freeEnrollment = async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (course.paid) return;

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { courses: courseId },
      },
      { new: true }
    );

    res.json(course);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Enrollment failed. Try again.");
  }
};

export const paidEnrollment = async (req, res) => {
  try {
    // check if course is paid
    const course = await Course.findById(req.params.courseId).populate(
      "instructor"
    );
    if (!course.paid) return;

    // application fee 30%
    const fee = (course.price * 30) / 100;

    // create stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      // purchase details
      line_items: [
        {
          name: course.name,
          amount: Math.round(course.price.toFixed(2) * 100),
          currency: "usd",
          quantity: 1,
        },
      ],
      // charge buyer and transfer remaining balance to seller (after fee)
      payment_intent_data: {
        application_fee_amount: Math.round(fee.toFixed(2) * 100),
        transfer_data: {
          destination: course.instructor.stripe_account_id,
        },
      },
      // redirect url after successful payment
      success_url: `${process.env.STRIPE_SUCCESS_URL}/${course._id}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
    });

    // console.log("SESSION ID => ", session);

    await User.findByIdAndUpdate(req.user._id, {
      stripeSession: session,
    });

    res.json(session.id);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Enrollment failed. Try again.");
  }
};

export const stripeSuccess = async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId);
    const user = await User.findById(req.user._id);

    if (!user.stripeSession.id) return res.sendStatus(400);

    const session = await stripe.checkout.sessions.retrieve(
      user.stripeSession.id
    );

    // if session payment status is paid, push course to user courses []
    if (session.payment_status === "paid") {
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { courses: course._id },
        $set: { stripeSession: {} },
      });
    }

    res.json(course);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Stripe Error. Try again.");
  }
};

export const userCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const courses = await Course.find({ _id: { $in: user.courses } }).populate(
      "instructor",
      "_id name"
    );

    res.json(courses);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Fetching user courses failed. Try again.");
  }
};

export const markCompleted = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;

    const existing = await Completed.findOne({
      user: req.user._id,
      course: courseId,
    });

    if (existing) {
      // update
      await Completed.findOneAndUpdate(
        {
          user: req.user._id,
          course: courseId,
        },
        {
          $addToSet: { lessons: lessonId },
        }
      );
      return res.json({ ok: true });
    }
    // create
    await new Completed({
      user: req.user._id,
      course: courseId,
      lessons: lessonId,
    }).save();
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Mark as completed failed. Try again.");
  }
};

export const markInompleted = async (req, res) => {
  try {
    const { courseId, lessonId } = req.body;

    await Completed.findOneAndUpdate(
      {
        user: req.user._id,
        course: courseId,
      },
      {
        $pull: { lessons: lessonId },
      }
    );
    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Mark as incompleted failed. Try again.");
  }
};

export const listCompleted = async (req, res) => {
  try {
    const { courseId } = req.body;

    const list = await Completed.findOne({
      user: req.user._id,
      course: courseId,
    });

    if (list) {
      res.json(list.lessons);
    }
  } catch (err) {
    console.log(err);
    return res
      .status(400)
      .send("Fetching completed lessons list failed. Try again.");
  }
};
