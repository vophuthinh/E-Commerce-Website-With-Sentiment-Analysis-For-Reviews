const express = require("express");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { upload } = require("../multer");
const Shop = require("../model/shop");
const Event = require("../model/event");
const ErrorHandler = require("../utils/ErrorHandler");
const { isSeller, isAdmin, isAuthenticated } = require("../middleware/auth");
const router = express.Router();
const fs = require("fs");
const safeJSONParse = require("../utils/safeJSONParse");

// create event
router.post(
  "/create-event",
  upload.array("images"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const shopId = req.body.shopId;
      const shop = await Shop.findByPk(shopId);
      if (!shop) {
        return next(new ErrorHandler("Id cửa hàng không hợp lệ!", 400));
      } else {
        const files = req.files;
        const imageUrls = files.map((file) => `${file.filename}`);
        const eventData = req.body;
        eventData.images = imageUrls;
        eventData.shop = shop;
        const product = await Event.create(eventData);
        res.status(201).json({
          success: true,
          product,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

router.put(
  "/update-event",
  upload.array("images"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const shopId = req.body.shopId;
      const eventId = req.body.eventId;
      const shop = await Shop.findByPk(shopId);
      const event = await Event.findByPk(eventId);
      if (!event) {
        return next(new ErrorHandler("Event không hợp lệ!", 400));
      }
      if (!shop) {
        return next(new ErrorHandler("Id cửa hàng không hợp lệ!", 400));
      }
      const files = req.files;
      if (files && files.length > 0) {
        const imageUrls = files.map((file) => `${file.filename}`);
        event.images = imageUrls;
      }
      event.name = req.body.name || event.name;
      event.description = req.body.description || event.description;
      event.category = req.body.category || event.category;
      event.discountPrice = req.body.discountPrice || event.discountPrice;
      event.start_Date = req.body.start_Date || event.start_Date;
      event.Finish_Date = req.body.Finish_Date || event.Finish_Date;
      event.originalPrice = req.body.originalPrice || event.originalPrice;
      event.shopId = shopId;
      const product = await event.save();
      res.status(200).json({
        success: true,
        product,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// get all events
router.get("/get-all-events", async (req, res, next) => {
  try {
    const events = await Event.findAll({});
    const updatedEvents = events.map((event) => {
      const obj = event.toJSON();
      obj.images = safeJSONParse(obj.images, []);
      obj.shop = safeJSONParse(obj.shop, {});
      return obj;
    });
    res.status(200).json({
      success: true,
      events: updatedEvents,
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 400));
  }
});

// get all events of a shop
router.get(
  "/get-all-events/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const events = await Event.findAll({ where: { shopId: req.params.id } });
      const updatedEvents = events.map((event) => {
        const obj = event.toJSON();
        obj.images = safeJSONParse(obj.images, []);
        obj.shop = safeJSONParse(obj.shop, {});
        return obj;
      });
      res.status(200).json({
        success: true,
        events: updatedEvents,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// delete event of a shop
router.delete(
  "/delete-shop-event/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const productId = req.params.id;

      const eventData = await Event.findByPk(productId);
      if (!eventData) {
        return next(new ErrorHandler("Không tìm thấy sự kiện với id này!", 404));
      }

      let ImageEvent = safeJSONParse(eventData.images, []);

      if (Array.isArray(ImageEvent)) {
        ImageEvent.forEach((imageUrl) => {
          const filePath = `uploads/${imageUrl}`;
          fs.unlink(filePath, (err) => {
            if (err) {
              // Error deleting file, continue anyway
            }
          });
        });
      }

      await eventData.destroy();

      res.status(200).json({
        success: true,
        message: "Đã xóa sự kiện thành công!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

// all events --- for admin
router.get(
  "/admin-all-events",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const events = await Event.findAll({});
      res.status(200).json({
        success: true,
        events,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
