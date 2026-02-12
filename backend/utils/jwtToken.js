// create token and saving that in cookies
const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: "none",
    secure: true,
  };

  // Exclude password from response
  const userObj = user.toJSON ? user.toJSON() : { ...user };
  delete userObj.password;

  res.status(statusCode).cookie("token", token, options).json({
    success: true,
    user: userObj,
    token,
  });
};

module.exports = sendToken;
