const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("./catchAsyncErrors");
const jwt = require("jsonwebtoken");
const User = require("../model/user");
const Shop = require("../model/shop");

exports.isAuthenticated = catchAsyncErrors(async (req, res, next) => {
    const { token } = req.cookies;

    if (!token) {
        return next(new ErrorHandler("Vui lòng đăng nhập để tiếp tục", 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findByPk(decoded.id);
    if (!user) {
        return next(new ErrorHandler("Người dùng không tồn tại, vui lòng đăng nhập lại", 401));
    }

    req.user = user;
    next();
});

exports.isSeller = catchAsyncErrors(async (req, res, next) => {
    const { seller_token } = req.cookies;

    if (!seller_token) {
        return next(new ErrorHandler("Vui lòng đăng nhập để tiếp tục", 401));
    }

    const decoded = jwt.verify(seller_token, process.env.JWT_SECRET);

    const seller = await Shop.findByPk(decoded.id);
    if (!seller) {
        return next(new ErrorHandler("Cửa hàng không tồn tại, vui lòng đăng nhập lại", 401));
    }

    req.seller = seller;
    next();
});

exports.isAdmin = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(
                new ErrorHandler(
                    `${req.user?.role || 'Unknown'} không thể truy cập tài nguyên này!`,
                    403
                )
            );
        }
        next();
    };
};