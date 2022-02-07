import expressJwt from "express-jwt";
import User from "../models/User";
import Course from "../models/Course";

export const requireSignin = expressJwt({
  getToken: (req, res) => req.cookies.token,
  secret: process.env.JWT_SECRET,
  algorithms: ["HS256"],
});

export const isInstructor = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.role.includes("Instructor")) return res.sendStatus(403);
    next();
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
};

export const isEnrolled = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    const course = await Course.findOne({ slug: req.params.slug });

    let ids = [];
    for (let i = 0; i < user.courses.length; i++) {
      ids.push(user.courses[i].toString());
    }

    if (!ids.includes(course._id.toString())) {
      res.sendStatus(403);
    }

    next();
  } catch (err) {
    console.log(err);
    res.sendStatus(400);
  }
};
