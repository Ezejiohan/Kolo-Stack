# Kolo Stack - Rotating Savings & Credit Association Platform

A modern, secure platform for managing Rotating Savings and Credit Associations (ROSCAs) - also known as "Kolo" in some African communities. Members contribute regularly to a common fund, and each member receives the full pot in rotation.

## 🌐 Live Site

The API is currently hosted at: https://kolo-stack.onrender.com

You can hit the endpoints directly using this base URL.

## 🚀 Features

### Core Functionality
- **User Management**: Secure registration, authentication, and 2FA support
- **Group Management**: Create and join contribution groups with customizable rules
- **Contribution Tracking**: Automated tracking of member contributions per cycle
- **Rotation Management**: Intelligent rotation system ensuring fair distribution
- **Payment Integration**: Seamless Paystack integration for secure payments
- **Wallet System**: Built-in wallet for managing funds and transactions
- **KYC Integration**: Know Your Customer verification for enhanced security

### Advanced Features
- **Real-time Notifications**: Webhook-based payment confirmations
- **Audit Logging**: Complete transaction and activity logging
- **Role-based Access**: Different permissions for members, group owners, and admins
- **Cycle Management**: Automated cycle initialization and completion
- **Statistics & Analytics**: Detailed contribution and group performance metrics
- **Mobile-ready API**: RESTful API designed for mobile and web applications

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with 2FA support
- **Payments**: Paystack API integration
- **Security**: Helmet, CORS, Rate Limiting, Input Validation
- **Logging**: Morgan for HTTP request logging
- **Scheduling**: Node-cron for automated tasks

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Paystack account and API keys

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kolo-stack
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/kolo-stack

   # JWT
   JWT_SECRET=your-super-secret-jwt-key

   # Paystack
   PAYSTACK_SECRET=sk_test_your-paystack-secret-key
   PAYSTACK_PUBLIC=pk_test_your-paystack-public-key
   PAYSTACK_CALLBACK_URL=https://yourdomain.com/api/payments/verify

   # Server
   PORT=5000
   NODE_ENV=development

   # Email (Gmail)
   GMAIL_USER=your@gmail.com
   GMAIL_PASS=your-gmail-app-password (or OAuth token)
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User login with optional 2FA
- `POST /api/users/2fa/setup` - Setup 2FA
- `POST /api/users/2fa/verify` - Verify 2FA token

### Group Management
- `POST /api/groups` - Create a new group
- `POST /api/groups/:id/join` - Join an existing group
- `GET /api/groups` - Get user's groups
- `POST /api/groups/:id/contribute` - Make a contribution (wallet)

### Payment Integration
- `POST /api/payments/initialize` - Initialize Paystack payment
- `GET /api/payments/verify/:reference` - Verify payment status
- `GET /api/payments/history` - Get payment history
- `POST /api/payments/webhook` - Paystack webhook handler

### Contribution & Rotation Management
- `POST /api/groups/:groupId/cycles` - Initialize new rotation cycle (owner only)
- `POST /api/groups/:groupId/contributions` - Record contribution after payment
- `GET /api/groups/:groupId/stats` - Get group contribution statistics
- `GET /api/groups/:groupId/history` - Get member's contribution history
- `GET /api/groups/:groupId/next-recipient` - Get next payout recipient
- `PATCH /api/groups/cycles/:cycleId/complete` - Complete a rotation cycle
- `GET /api/groups/:groupId/cycles/:cycleNumber/check` - Check cycle completion status

### Wallet Management
- `GET /api/wallet` - Get wallet balance and details
- `POST /api/wallet/deposit` - Deposit funds (via payment)
- `POST /api/wallet/withdraw` - Withdraw funds (requires KYC)

### KYC & Verification
- `POST /api/kyc/submit` - Submit KYC documents
- `GET /api/kyc/status` - Check KYC verification status

### Admin Endpoints
- `GET /api/admin/users` - List all users
- `GET /api/admin/groups` - List all groups
- `GET /api/admin/transactions` - View all transactions
- `PATCH /api/admin/users/:id/status` - Update user status

## 🔄 How Kolo Works

1. **Group Creation**: A user creates a group with contribution amount and rotation frequency
2. **Member Recruitment**: Users join the group until target size is reached
3. **Cycle Initialization**: Group owner starts the first contribution cycle
4. **Contributions**: Members contribute the set amount each cycle period
5. **Payout**: When all members contribute, the pot goes to the designated recipient
6. **Rotation**: The recipient position rotates for the next cycle
7. **Completion**: Process repeats until all members have received their payout

## 🗂 Project Structure

```
kolo-stack/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/             # Route handlers
│   │   ├── payments/
│   │   ├── admin/
│   │   └── ...
│   ├── middlewares/             # Express middlewares
│   ├── modules/                 # Mongoose models
│   │   ├── users/
│   │   ├── groups/
│   │   ├── payments/
│   │   ├── contributions/
│   │   └── ...
│   ├── routes/                  # API routes
│   ├── services/                # Business logic
│   └── app.js                   # Express app setup
├── server.js                    # Server entry point
├── package.json
└── README.md
```

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Two-Factor Authentication** support
- **Rate Limiting** on sensitive endpoints
- **Input Validation** and sanitization
- **CORS Protection**
- **Helmet** security headers
- **Webhook Signature Verification** (Paystack)
- **Audit Logging** for all transactions

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/kolo-prod
JWT_SECRET=your-production-jwt-secret
PAYSTACK_SECRET=sk_live_your-live-secret
PAYSTACK_PUBLIC=pk_live_your-live-public
```

### Docker Deployment (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@kolostack.com or join our Discord community.

## 🙏 Acknowledgments

- Paystack for payment processing
- MongoDB for database services
- Express.js community for the amazing framework
- All contributors and users of the platform

---

**Built with ❤️ for financial inclusion and community empowerment**</content>
<parameter name="filePath">c:\Users\Admin\Desktop\Kolo Stack\README.md