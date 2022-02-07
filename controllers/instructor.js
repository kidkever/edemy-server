import User from "../models/User";
import Course from "../models/Course";
import queryString from "query-string";
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

export const makeInstructor = async (req, res) => {
  try {
    // get user from db
    const user = await User.findById(req.user._id);

    // create a new account if user dont have one yet
    if (!user.stripe_account_id) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
      });
      user.stripe_account_id = account.id;
      user.save();
    }

    // create account link for frontend onboarding
    let accountLink = await stripe.accountLinks.create({
      account: user.stripe_account_id,
      refresh_url: process.env.STRIPE_REDIRECT_URL,
      return_url: process.env.STRIPE_REDIRECT_URL,
      type: "account_onboarding",
    });

    // send url response to frontend
    res.send(`${accountLink.url}?${queryString.stringify(accountLink)}`);
  } catch (err) {
    console.log(err);
  }
};

export const getAccountStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const account = await stripe.accounts.retrieve(user.stripe_account_id);

    if (!account.charges_enabled) return res.status(401).send("Unauthorized.");

    const statusUpdated = await User.findByIdAndUpdate(
      user._id,
      {
        stripe_seller: account,
        $addToSet: { role: "Instructor" },
      },
      {
        new: true,
      }
    )
      .select("-password")
      .exec();

    res.json(statusUpdated);
  } catch (err) {
    console.log(err);
  }
};

export const currentInstructor = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user.role.includes("Instructor")) return res.sendStatus(403);

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
  }
};

export const instructorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ instructor: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(courses);
    //
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const studentCount = async (req, res) => {
  try {
    const users = await User.find({ courses: req.body.courseId }).select("_id");
    res.json(users);
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const instructorBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const balance = await stripe.balance.retrieve({
      stripeAccount: user.stripe_account_id,
    });
    res.json(balance);
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};

export const instructorPayoutSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const loginLink = await stripe.accounts.createLoginLink(
      user.stripe_seller.id,
      { redirect_url: process.env.STRIPE_SETTINGS_REDIRECT }
    );
    res.json(loginLink.url);
  } catch (err) {
    console.log(err);
    return res.sendStatus(400);
  }
};
