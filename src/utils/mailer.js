
// Import the nodemailer module for sending emails
const nodemailer = require('nodemailer');

// Define an asynchronous function to send an email
const sendEmail = async (options) => {
    // Create a transporter object using nodemailer.createTransport
    const transporter = nodemailer.createTransport({
        // Specify the email service provider (in this case, Gmail)
        service: "gmail",
        // Authentication credentials for the email account
        auth: {
            user: process.env.GMAIL_EMAIL, // The email address used to send emails (stored in environment variable)
            pass: process.env.GMAIL_PASS // The password or app-specific password for the email account (stored in environment variable)
        }
    });

    // Define the email options, such as sender, recipient, subject, and message content
    let mailOptions = {
        from: {
            name: "KoloStack", // The name displayed as the sender
            address: process.env.GMAIL_EMAIL // The email address displayed as the sender
        },
        to: options.email, // Recipient's email address, passed in through the options parameter
        subject: options.subject, // Email subject, passed in through the options parameter
        html: options.message // Email content in HTML format, passed in through the options parameter
    };

    // Use the transporter to send the email with the specified mailOptions
    await transporter.sendMail(mailOptions);
}

// Export the sendEmail function so it can be used in other parts of the application
module.exports = { sendEmail };
