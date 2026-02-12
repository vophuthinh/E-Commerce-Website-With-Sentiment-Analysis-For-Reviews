// create token and saving that in cookies
const sendShopToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  // Options for cookies
  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "none",
    secure: true,
  };

  // Exclude password from response
  const sellerObj = user.toJSON ? user.toJSON() : { ...user };
  delete sellerObj.password;

  res.status(statusCode).cookie("seller_token", token, options).json({
    success: true,
    user: sellerObj,
    token,
  });
};

module.exports = sendShopToken;
