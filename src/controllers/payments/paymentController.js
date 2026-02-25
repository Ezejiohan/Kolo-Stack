const axios = require("axios");

exports.initializePayment = async (req, res) => {
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: req.user.email,
      amount: req.body.amount * 100
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`
      }
    }
  );

  res.json(response.data);
};
