require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { body, validationResult } = require('express-validator');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Database connected successfully.'))
  .catch(err => console.error('Database connection error:', err));

const ContactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    ipAddress: { type: String },
    created_at: { type: Date, default: Date.now }
});
const Contact = mongoose.model('Contact', ContactSchema);

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/contact', [
    body('name').trim().isLength({ min: 2 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('subject').trim().notEmpty().escape(),
    body('message').trim().isLength({ min: 10 }).escape()
], async (req, res) => {
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Invalid input data. Check your entry fields.' });
    }

    try {
        const { name, email, subject, message } = req.body;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        const newContact = new Contact({ name, email, subject, message, ipAddress });
        await newContact.save();

        const adminMailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.NOTIFICATION_EMAIL,
            subject: `New Contact Form: ${subject}`,
            text: `You received a new submission:\n\nName: ${name}\nEmail: ${email}\nIP: ${ipAddress}\n\nMessage:\n${message}`
        };
        await transporter.sendMail(adminMailOptions);

        const autoReplyOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `We received your message: ${subject}`,
            text: `Hi ${name},\n\nThank you for reaching out to us. We have received your query regarding "${subject}" and our team will get back to you shortly.\n\nBest regards,\nSupport Team`
        };
        await transporter.sendMail(autoReplyOptions);

        return res.status(200).json({ message: 'Submission fully logged and processed.' });

    } catch (error) {
        console.error('Execution error during route lifecycle:', error);
        return res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
    }
});

app.listen(PORT, () => console.log(`Server executing seamlessly on port ${PORT}`));