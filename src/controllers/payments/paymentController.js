const axios = require("axios");
const Payment = require("../../modules/payments/paymentModel");
const Transaction = require("../../modules/transactions/transactionModel");

// Initialize payment with Paystack
exports.initializePayment = async (req, res) => {
  try {
    const { amount } = req.body;

    // Input validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required"
      });
    }

    // Check if amount is a number
    if (typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: "Amount must be a number"
      });
    }

    // Generate unique reference
    const reference = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record
    const paymentData = {
      user: req.user._id,
      reference,
      amount,
      purpose: req.body.purpose || "deposit"
    };
    if (req.body.groupId) {
      paymentData.group = req.body.groupId;
      // if purpose not explicitly set, treat as contribution
      if (!req.body.purpose) paymentData.purpose = "contribution";
    }
    const payment = new Payment(paymentData);
    await payment.save();

    const metadata = {};
    if (req.body.groupId) metadata.groupId = req.body.groupId;
    if (paymentData.purpose) metadata.purpose = paymentData.purpose;

    // For testing: use mock data when PAYSTACK_SECRET is not set
    if (!process.env.PAYSTACK_SECRET) {
      return res.json({
        success: true,
        data: {
          status: true,
          message: "Authorization URL created",
          authorization_url: `http://localhost:5000/api/payments/verify/${reference}?mock=true`,
          access_code: "mock_access_code",
          reference
        },
        reference
      });
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: req.user.email,
        amount: amount * 100, // Convert to kobo
        reference,
        callback_url: process.env.PAYSTACK_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/payments/verify/${reference}`,
        metadata
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({
      success: true,
      data: response.data,
      reference
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
    res.status(500).json({
      success: false,
      message: "Payment initialization failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify payment status
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required"
      });
    }

    // For testing: use mock data when PAYSTACK_SECRET is not set or mock query param
    if (!process.env.PAYSTACK_SECRET || req.query.mock === 'true') {
      const mockData = {
        id: 123456789,
        reference,
        amount: 500000, // in kobo
        currency: "NGN",
        status: "success",
        paid_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        channel: "card",
        customer: { email: req.user.email },
        metadata: {}
      };

      // Find and update payment record
      const payment = await Payment.findOneAndUpdate(
        { reference },
        {
          status: 'success',
          paystackData: mockData
        },
        { new: true }
      );

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found"
        });
      }

      // Create transaction record
      if (!payment.transaction) {
        const txnType = payment.purpose === 'contribution' ? 'contribution' : 'deposit';
        const transaction = new Transaction({
          user: payment.user,
          type: txnType,
          amount: payment.amount,
          status: "completed",
          group: payment.group
        });
        await transaction.save();

        payment.transaction = transaction._id;
        await payment.save();

        // Record contribution if applicable
        if (payment.purpose === 'contribution' && payment.group) {
          const contributionService = require("../services/contributionService");
          try {
            await contributionService.recordContribution(
              payment.group,
              payment.user,
              payment.amount,
              payment._id,
              transaction._id
            );
          } catch (err) {
            console.error("Failed to record contribution:", err);
          }
        }
      }

      return res.json({
        success: true,
        data: mockData,
        payment: payment
      });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
        }
      }
    );

    const { data } = response.data;

    // Update payment record (ensure group/purpose from metadata)
    const updateFields = {
      status: data.status === 'success' ? 'success' : data.status === 'failed' ? 'failed' : 'pending',
      paystackData: data
    };
    if (data.metadata) {
      if (data.metadata.groupId) updateFields.group = data.metadata.groupId;
      if (data.metadata.purpose) updateFields.purpose = data.metadata.purpose;
    }

    const payment = await Payment.findOneAndUpdate(
      { reference },
      updateFields,
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found"
      });
    }

    // If payment was successful, create a transaction record
    if (data.status === 'success' && !payment.transaction) {
      // create transaction type depends on purpose
      const txnType = payment.purpose === 'contribution' ? 'contribution' : 'deposit';
      const transaction = new Transaction({
        user: payment.user,
        type: txnType,
        amount: payment.amount,
        status: "completed",
        group: payment.group
      });
      await transaction.save();

      // Update payment with transaction reference
      payment.transaction = transaction._id;
      await payment.save();

      // if this was a contribution, record it in contribution service
      if (payment.purpose === 'contribution' && payment.group) {
        const contributionService = require("../services/contributionService");
        try {
          await contributionService.recordContribution(
            payment.group,
            payment.user,
            payment.amount,
            payment._id,
            transaction._id
          );
        } catch (err) {
          console.error("Failed to record contribution:", err);
        }
      }
    }

    res.json({
      success: true,
      data: data,
      payment: payment
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Handle Paystack webhook
exports.handleWebhook = async (req, res) => {
  try {
    // Parse the raw body
    const event = JSON.parse(req.body);

    // In production, verify webhook signature
    // const secret = process.env.PAYSTACK_SECRET;
    // const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
    // if (hash !== req.headers['x-paystack-signature']) {
    //   return res.status(400).send('Invalid signature');
    // }

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;

      // Update payment record
      const payment = await Payment.findOneAndUpdate(
        { reference },
        {
          status: 'success',
          paystackData: event.data
        },
        { new: true }
      );

      if (payment && !payment.transaction) {
        // Create transaction record
        const transaction = new Transaction({
          user: payment.user,
          type: "deposit",
          amount: payment.amount,
          status: "completed"
        });
        await transaction.save();

        // Update payment with transaction reference
        payment.transaction = transaction._id;
        await payment.save();

        console.log(`Payment successful: ${reference}, Amount: ${amount / 100}`);
      }
    } else if (event.event === 'charge.failed') {
      const { reference } = event.data;

      // Update payment status to failed
      await Payment.findOneAndUpdate(
        { reference },
        {
          status: 'failed',
          paystackData: event.data
        }
      );

      console.log(`Payment failed: ${reference}`);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.sendStatus(500);
  }
};
exports.getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const payments = await Payment.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('transaction');

    const total = await Payment.countDocuments({ user: req.user._id });

    res.json({
      success: true,
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get payment history",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
