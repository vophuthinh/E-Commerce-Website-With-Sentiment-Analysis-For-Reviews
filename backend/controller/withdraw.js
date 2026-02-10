const Shop = require("../model/shop");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const express = require("express");
const { isSeller, isAuthenticated, isAdmin } = require("../middleware/auth");
const Withdraw = require("../model/withdraw");
const sendMail = require("../utils/sendMail");
const router = express.Router();

// create withdraw request --- only for seller
router.post(
  "/create-withdraw-request",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { amount } = req.body;

      const data = {
        seller: req.seller,
        amount,
      };

      const shop = await Shop.findByPk(req.seller.id);

      if (amount <= 0) {
        return next(new ErrorHandler("Số tiền rút phải lớn hơn 0!", 400));
      }

      if (amount > shop.availableBalance) {
        return next(new ErrorHandler("Số dư không đủ để thực hiện giao dịch này!", 400));
      }

      const withdraw = await Withdraw.create(data);

      shop.availableBalance = shop.availableBalance - amount;

      await shop.save();

      try {
        await sendMail({
          email: req.seller.email,
          subject: "Withdraw Request",
          message: `Xin chào ${req.seller.name},Yêu cầu rút tiền của bạn ${amount}$ đang được xử lý. Sẽ mất 1 khoảng thời gian cho việc rút tiền, vui lòng đợi từ 3 - 5 ngày! `,
        });
      } catch (error) {
        // Log error but the transaction is successful
        console.error("Email sending failed:", error);
      }

      res.status(201).json({
        success: true,
        withdraw,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all withdraws --- admnin

router.get(
  "/get-all-withdraw-request",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const withdraws = await Withdraw.findAll({
        order: [['createdAt', 'DESC']]
      });

      // Parse JSON fields if necessary
      const updatedWithdraws = withdraws.map(w => {
        const wd = w.toJSON();
        if (typeof wd.seller === 'string') {
          try { wd.seller = JSON.parse(wd.seller); } catch (e) { }
        }
        return wd;
      });

      res.status(201).json({
        success: true,
        withdraws: updatedWithdraws,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update withdraw request ---- admin
router.put(
  "/update-withdraw-request/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { sellerId } = req.body;

      const withdraw = await Withdraw.findByPk(req.params.id);

      if (!withdraw) {
        return next(new ErrorHandler("Withdraw not found", 404));
      }

      withdraw.status = "succeed";
      withdraw.updatedAt = new Date();
      await withdraw.save();

      const seller = await Shop.findByPk(sellerId);

      const transaction = {
        _id: withdraw.id,
        amount: withdraw.amount,
        updatedAt: withdraw.updatedAt,
        status: withdraw.status,
      };

      // Assuming transections is a JSON field in Shop
      let currentTransactions = seller.transections;
      // Handle parsing if it comes as string or JSON
      try {
        if (typeof currentTransactions === 'string') {
          currentTransactions = JSON.parse(currentTransactions);
        }
      } catch (e) {
        currentTransactions = [];
      }

      if (!Array.isArray(currentTransactions)) {
        currentTransactions = [];
      }

      currentTransactions.push(transaction);

      // Update shop JSON field
      seller.transections = currentTransactions;

      await seller.save();

      try {
        await sendMail({
          email: seller.email,
          subject: "Payment confirmation",
          message: `Xin chào ${seller.name}, yêu cầu rút tiền của bạn ${withdraw.amount} đang được gửi . Thời gian giao hàng phụ thuộc vào quy định của ngân hàng, thường mất từ ​​3 ngày đến 7 ngày.`,
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }
      res.status(201).json({
        success: true,
        withdraw,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
