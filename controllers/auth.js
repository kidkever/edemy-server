import User from "../models/User";
import { hashPassword, comparePassword } from "../utils/auth";
import jwt from "jsonwebtoken";
import AWS from "aws-sdk";
import { nanoid } from "nanoid";

const awsConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  apiVersion: process.env.AWS_API_VERSION,
};

const SES = new AWS.SES(awsConfig);

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // validation
    if (!name) return res.status(400).send("Name is required.");
    if (!password || password.length < 6) {
      return res
        .status(400)
        .send("Password is required and should be min 6 characters long.");
    }
    const userExists = await User.findOne({ email }).exec();
    if (userExists) return res.status(400).send("Email is taken.");

    // hash password
    const hashedPassword = await hashPassword(password);

    // register
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    // console.log(user);
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error, Try again.");
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // check if user exists
    const user = await User.findOne({ email }).exec();
    if (!user) return res.status(400).send("Bad credentials.");

    // check password
    const match = await comparePassword(password, user.password);
    if (!match) return res.status(400).send("Bad credentials.");

    // create jwt
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // exclude password
    user.password = undefined;

    // send token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      // secure: true  // only works on https
    });

    // return user
    return res.status(200).json(user);
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error, Try again.");
  }
};

export const logout = async (req, res) => {
  try {
    res.clearCookie("token");
    return res.json({ message: "Signed out successfully." });
  } catch (err) {
    console.log(err);
  }
};

export const currentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password").exec();
    return res.json({ ok: true });
  } catch (err) {
    console.log(err);
  }
};

export const sendTestEmail = async (req, res) => {
  const params = {
    Source: process.env.EMAIL_FROM,
    Destination: {
      ToAddresses: ["kidkever1@gmail.com"],
    },
    ReplyToAddresses: [process.env.EMAIL_FROM],
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: `
            <h1>Reset Password Link</h1>
            <p>Please use the following link to reset your password.</p>
          `,
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: "Password reset link",
      },
    },
  };

  const emailSent = SES.sendEmail(params).promise();
  emailSent
    .then((data) => {
      console.log(data);
      res.json({ ok: true });
    })
    .catch((err) => console.log(err));
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const shortCode = nanoid(6).toUpperCase();
    const user = await User.findOneAndUpdate(
      { email },
      { passwordResetCode: shortCode }
    );

    if (!user) return res.status(404).send("User Not Found.");

    // prepare for email
    const params = {
      Source: process.env.EMAIL_FROM,
      Destination: {
        ToAddresses: [email],
      },
      ReplyToAddresses: [process.env.EMAIL_FROM],
      Message: {
        Body: {
          Html: {
            Charset: "UTF-8",
            Data: `
              <div style='text-align:center;'>
                <h1>Reset Password Code</h1>
                <p>Please use the following code to reset your password.</p>
                <h2 style='color:red;'>${shortCode}</h2>
                <i><a href='#'>Edemy.com</a></i>
              </div>
            `,
          },
        },
        Subject: {
          Charset: "UTF-8",
          Data: "Password reset code",
        },
      },
    };

    const data = await SES.sendEmail(params).promise();
    console.log(data);
    res.json({ ok: true });

    //
  } catch (err) {
    console.log(err);
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const hashedPassword = await hashPassword(newPassword);

    const user = await User.findOneAndUpdate(
      { email, passwordResetCode: code },
      { password: hashedPassword, passwordResetCode: "" }
    );

    if (!user) return res.status(404).send("User Not Found.");

    res.json({ ok: true });
  } catch (err) {
    console.log(err);
    return res.status(400).send("Error! try again.");
  }
};
