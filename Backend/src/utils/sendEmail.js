// utils/sendMail.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendMail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT == 465, // true if port is 465
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"Vakya Sangham" <${process.env.MAIL_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    // console.log(`📨 Mail sent to: ${to}`);
  } catch (error) {
    console.error("❌ Error sending mail:", error.message);
    throw new Error("Failed to send email. Please try again.");
  }
};
