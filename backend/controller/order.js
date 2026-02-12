const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const Order = require("../model/order");
const Shop = require("../model/shop");
const Product = require("../model/product");
const safeJSONParse = require("../utils/safeJSONParse");

/**
 * Helper: Parse and normalize an order for API response.
 * Converts JSON string fields and maps snake_case to camelCase aliases.
 */
function normalizeOrder(order) {
  const obj = order.toJSON ? order.toJSON() : { ...order };
  obj.cart = safeJSONParse(obj.cart, []);
  obj.shipping_address = safeJSONParse(obj.shipping_address, {});
  obj.user = safeJSONParse(obj.user, {});
  obj.paymentInfo = safeJSONParse(obj.paymentInfo, {});
  // Aliases for frontend compatibility
  obj.shippingAddress = obj.shipping_address;
  obj.totalPrice = obj.total_price;
  obj.paidAt = obj.paid_at;
  obj.deliveredAt = obj.delivered_at;
  obj.createdAt = obj.created_at;
  return obj;
}

// create new order
router.post(
  "/create-order",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { cart, shippingAddress, user, paymentInfo } = req.body;

      //   group cart items by shopId
      const shopItemsMap = new Map();
      for (const item of cart) {
        const shopId = item.shopId;
        if (!shopItemsMap.has(shopId)) {
          shopItemsMap.set(shopId, []);
        }
        shopItemsMap.get(shopId).push(item);
      }

      // create an order for each shop
      const orders = [];

      for (const [shopId, items] of shopItemsMap) {
        let orderTotal = 0;
        const productsWithDetails = [];

        // Verify stock and price for each item in this shop's cart
        for (const item of items) {
          const product = await Product.findByPk(item.id);
          if (!product) {
            return next(new ErrorHandler(`Product with id ${item.id} not found`, 404));
          }
          if (product.stock < item.qty) {
            return next(new ErrorHandler(`Insufficient stock for product ${product.name}`, 400));
          }

          // Deduct stock immediately
          product.stock -= item.qty;
          product.sold_out = (product.sold_out || 0) + item.qty;
          await product.save();

          // Calculate price for this item based on DB price
          const itemPrice = parseFloat(product.discountPrice) || parseFloat(product.originalPrice) || 0;
          orderTotal += itemPrice * item.qty;

          productsWithDetails.push(item);
        }

        const order = await Order.create({
          cart: productsWithDetails,
          shipping_address: shippingAddress,
          user,
          total_price: orderTotal, // Use calculated total for this shop
          paymentInfo,
        });
        orders.push(order);
      }

      res.status(201).json({
        success: true,
        orders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all orders of user
router.get(
  "/get-all-orders/:userId",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({});
      // Filter in JS since Sequelize JSON query on nested fields is unreliable
      const filteredOrders = orders.filter((order) => {
        const user = safeJSONParse(order.user, {});
        return String(user.id) === String(req.params.userId);
      });
      const normalizedOrders = filteredOrders.map(normalizeOrder);
      res.status(200).json({
        success: true,
        orders: normalizedOrders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all orders of seller
router.get(
  "/get-seller-all-orders/:shopId",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({});
      // Filter orders that contain items belonging to this shop
      const filteredOrders = orders.filter((order) => {
        const cart = safeJSONParse(order.cart, []);
        return Array.isArray(cart) && cart.some((item) => String(item.shopId) === String(req.params.shopId));
      });
      const normalizedOrders = filteredOrders.map(normalizeOrder);
      res.status(200).json({
        success: true,
        orders: normalizedOrders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update order status for seller
router.put(
  "/update-order-status/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findByPk(req.params.id);

      if (!order) {
        return next(
          new ErrorHandler("Đơn hàng không tìm thấy với ID này", 400)
        );
      }

      // Check ownership
      let cartItems = safeJSONParse(order.cart, []);
      // Assuming all items in an order belong to the same shop as per create-order logic
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        if (String(cartItems[0].shopId) !== String(req.seller.id)) {
          return next(new ErrorHandler("Bạn không có quyền cập nhật đơn hàng này", 403));
        }
      }

      if (req.body.status === "Transferred to delivery partner") {
        // Stock already deducted at creation
      }

      order.status = req.body.status;

      if (req.body.status === "Delivered") {
        order.delivered_at = new Date();

        let infoPayment = safeJSONParse(order.paymentInfo, {});

        if (infoPayment) {
          infoPayment.status = "Succeeded";
          order.paymentInfo = infoPayment;
        }

        const serviceCharge = order.total_price * 0.1;
        await updateSellerInfo(order.total_price - serviceCharge);
      }
      await order.save();
      res.status(200).json({
        success: true,
        order,
      });

      async function updateSellerInfo(amount) {
        const seller = await Shop.findByPk(req.seller.id);
        const currentBalance = parseFloat(seller.availableBalance) || 0;
        seller.availableBalance = currentBalance + parseFloat(amount);
        await seller.save();
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// give a refund ----- user
router.put(
  "/order-refund/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findByPk(req.params.id);

      if (!order) {
        return next(
          new ErrorHandler("Đơn hàng không tìm thấy với ID này", 400)
        );
      }

      // Verify the order belongs to the requesting user
      const orderUser = safeJSONParse(order.user, {});
      if (String(orderUser.id) !== String(req.user.id)) {
        return next(new ErrorHandler("Bạn không có quyền yêu cầu hoàn tiền cho đơn hàng này", 403));
      }

      order.status = req.body.status;

      await order.save();

      res.status(200).json({
        success: true,
        order,
        message: "Yêu cầu hoàn tiền đặt hàng thành công!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// accept the refund ---- seller
router.put(
  "/order-refund-success/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findByPk(req.params.id);

      if (!order) {
        return next(
          new ErrorHandler("Không tìm thấy đơn đặt hàng với id này", 400)
        );
      }

      order.status = req.body.status;

      await order.save();

      res.status(200).json({
        success: true,
        message: "Hoàn tiền đặt hàng thành công!",
      });

      if (req.body.status === "Refund Success") {
        let cartOrder = safeJSONParse(order.cart, []);
        if (!Array.isArray(cartOrder)) cartOrder = [];

        for (const o of cartOrder) {
          await updateOrder(o.productId, o.quantity);
        }
      }
      async function updateOrder(id, qty) {
        const product = await Product.findByPk(id);
        if (product) {
          product.stock += qty;
          product.sold_out -= qty;
          await product.save();
        }
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// all orders --- for admin
router.get(
  "/admin-all-orders",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({});
      const normalizedOrders = orders.map(normalizeOrder);
      res.status(200).json({
        success: true,
        orders: normalizedOrders,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
