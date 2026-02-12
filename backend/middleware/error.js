const ErrorHandler = require("../utils/ErrorHandler");

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal server Error";

  // Sequelize Validation Error
  if (err.name === "SequelizeValidationError") {
    const message = err.errors.map((e) => e.message).join(", ");
    err = new ErrorHandler(message, 400);
  }

  // Sequelize Unique Constraint Error (duplicate key)
  if (err.name === "SequelizeUniqueConstraintError") {
    const fields = err.errors.map((e) => e.path).join(", ");
    const message = `Giá trị đã tồn tại cho trường: ${fields}`;
    err = new ErrorHandler(message, 400);
  }

  // Sequelize Database Error (general SQL errors)
  if (err.name === "SequelizeDatabaseError") {
    const message = `Lỗi cơ sở dữ liệu: ${err.message}`;
    err = new ErrorHandler(message, 400);
  }

  // Sequelize Foreign Key Constraint Error
  if (err.name === "SequelizeForeignKeyConstraintError") {
    const message = `Không thể thực hiện thao tác do ràng buộc khóa ngoại`;
    err = new ErrorHandler(message, 400);
  }

  // wrong jwt error
  if (err.name === "JsonWebTokenError") {
    const message = `Token không hợp lệ, vui lòng đăng nhập lại`;
    err = new ErrorHandler(message, 401);
  }

  // jwt expired
  if (err.name === "TokenExpiredError") {
    const message = `Token đã hết hạn, vui lòng đăng nhập lại`;
    err = new ErrorHandler(message, 401);
  }

  res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};
