const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.sendMail = async ({ to, subject, html }) => {
  await transporter.sendMail({
    from: `"MyFinance" <${process.env.MAIL_USER}>`,
    to,
    subject,
    html
  });
};
