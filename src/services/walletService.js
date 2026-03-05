const Wallet = require("../modules/wallet/walletModel");

exports.getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });

  if (!wallet) {
    wallet = await Wallet.create({ user: userId });
  }

  return wallet;
};
