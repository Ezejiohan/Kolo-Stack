require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/database");
require("./src/modules/payouts/rotationEngine");

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
