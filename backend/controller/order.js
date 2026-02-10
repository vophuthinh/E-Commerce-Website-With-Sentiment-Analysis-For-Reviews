const express = require("express");
const router = express.Router();
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth");
const Order = require("../model/order");
const Shop = require("../model/shop");
const Product = require("../model/product");
const safeJSONParse = require("../utils/safeJSONParse");

// create new order
router.post(
  "/create-order",
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
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({
        where: { "user.id": req.params.userId },
      })
      const updatedProducts = orders.map(product => {
        const newProduct = product.toJSON();
        newProduct.cart = safeJSONParse(newProduct.cart, []);
        newProduct.shipping_address = safeJSONParse(newProduct.shipping_address, {});
        newProduct.user = safeJSONParse(newProduct.user, {});
        newProduct.paymentInfo = safeJSONParse(newProduct.paymentInfo, {});
        return newProduct;
      });
      const newUpdatedProducts = updatedProducts.map(product => ({
        ...product,
        shippingAddress: product.shipping_address,
        totalPrice: product.total_price,
        paidAt: product.paid_at,
        deliveredAt: product.delivered_at,
        createdAt: product.created_at

      }));
      res.status(200).json({
        success: true,
        orders: newUpdatedProducts,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get all orders of seller
router.get(
  "/get-seller-all-orders/:shopId",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({
        "cart.shopId": req.params.shopId,
      })
      const updatedProducts = orders.map(product => {
        const newProduct = product.toJSON();
        newProduct.cart = safeJSONParse(newProduct.cart, []);
        newProduct.shipping_address = safeJSONParse(newProduct.shipping_address, {});
        newProduct.user = safeJSONParse(newProduct.user, {});
        newProduct.paymentInfo = safeJSONParse(newProduct.paymentInfo, {});
        return newProduct;
      });
      const newUpdatedProducts = updatedProducts.map(product => ({
        ...product,
        shippingAddress: product.shipping_address,
        totalPrice: product.total_price,
        paidAt: product.paid_at,
        deliveredAt: product.delivered_at,
        createdAt: product.created_at

      }));
      res.status(200).json({
        success: true,
        orders: newUpdatedProducts,
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
      let cartItems = order.cart;
      if (typeof cartItems === 'string') {
        try {
          cartItems = JSON.parse(cartItems);
        } catch (e) {
          cartItems = [];
        }
      }
      // Assuming all items in an order belong to the same shop as per create-order logic
      if (Array.isArray(cartItems) && cartItems.length > 0) {
        if (cartItems[0].shopId !== req.seller.id) {
          return next(new ErrorHandler("Bạn không có quyền cập nhật đơn hàng này", 403));
        }
      }

      if (req.body.status === "Transferred to delivery partner") {
        // Stock already deducted at creation
      }

      order.status = req.body.status;

      if (req.body.status === "Delivered") {
        order.deliveredAt = Date.now();

        let infoPayment = order.paymentInfo;
        if (typeof infoPayment === 'string') {
          try {
            infoPayment = JSON.parse(infoPayment);
          } catch (e) {
            infoPayment = {};
          }
        }

        if (infoPayment) {
          infoPayment.status = "Succeeded";
          order.paymentInfo = infoPayment;
        }

        const serviceCharge = order.total_price * 0.1;
        await updateSellerInfo(order.total_price - serviceCharge);
      }
      await order.save({ validateBeforeSave: false });
      res.status(200).json({
        success: true,
        order,
      });
      async function updateOrder(id, qty) {
        const product = await Product.findByPk(id);
        product.stock -= qty;
        product.sold_out += qty;
        await product.save({ validateBeforeSave: false });
      }
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
  catchAsyncErrors(async (req, res, next) => {
    try {
      const order = await Order.findByPk(req.params.id);

      if (!order) {
        return next(
          new ErrorHandler("Đơn hàng không tìm thấy với ID này", 400)
        );
      }

      order.status = req.body.status;

      await order.save({ validateBeforeSave: false });

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
        let cartOrder = order.cart;
        if (typeof cartOrder === 'string') {
          try {
            cartOrder = JSON.parse(cartOrder);
          } catch (e) {
            cartOrder = [];
          }
        }
        if (!Array.isArray(cartOrder)) cartOrder = [];

        for (const o of cartOrder) {
          await updateOrder(o.productId, o.quantity);
        }
      }
      async function updateOrder(id, qty) {
        const product = await Product.findByPk(id);
        product.stock += qty;
        product.sold_out -= qty;

        await product.save({ validateBeforeSave: false });
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
  // isAdmin("Admin"),
  catchAsyncErrors(async (req, res, next) => {
    try {
      const orders = await Order.findAll({})
      const updatedProducts = orders.map(product => {
        const newProduct = product.toJSON();
        newProduct.cart = safeJSONParse(newProduct.cart, []);
        newProduct.shipping_address = safeJSONParse(newProduct.shipping_address, {});
        newProduct.user = safeJSONParse(newProduct.user, {});
        newProduct.paymentInfo = safeJSONParse(newProduct.paymentInfo, {});
        return newProduct;
      });
      const newUpdatedProducts = updatedProducts.map(product => ({
        ...product,
        shippingAddress: product.shipping_address,
        totalPrice: product.total_price,
        paidAt: product.paid_at,
        deliveredAt: product.delivered_at,
        createdAt: product.created_at
      }));
      res.status(201).json({
        success: true,
        orders: newUpdatedProducts,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
