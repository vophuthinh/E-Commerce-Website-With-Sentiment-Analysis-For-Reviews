const express = require('express');
const { isSeller, isAuthenticated, isAdmin } = require('../middleware/auth');
const catchAsyncErrors = require('../middleware/catchAsyncErrors');
const router = express.Router();
const Product = require('../model/product');
const Order = require('../model/order');
const Shop = require('../model/shop');
const { upload } = require('../multer');
const ErrorHandler = require('../utils/ErrorHandler');
const fs = require('fs');
const { analyzeSentiment, checkModelStatus, getDominantLabel, analyzeAspects } = require('./analyzeSentiment');
const safeJSONParse = require('../utils/safeJSONParse');

// create product
router.post(
    '/create-product',
    upload.array('images'),
    catchAsyncErrors(async (req, res, next) => {
        try {
            const shopId = req.body.shopId;
            const shop = await Shop.findByPk(shopId);

            if (!shop) {
                return next(new ErrorHandler('Id cửa hàng không hợp lệ!', 400));
            } else {
                const files = req.files;
                const imageUrls = files.map((file) => `${file.filename}`);
                const productData = req.body;
                productData.images = imageUrls;
                productData.shop = shop;
                productData.discount_price = 0;
                productData.shopId = shopId;
                const product = await Product.create(productData);
                res.status(201).json({
                    success: true,
                    product,
                });
            }
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);
router.put(
    '/update-product',
    upload.array('images'),
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { shopId, productId, ...productData } = req.body;
            const shop = await Shop.findByPk(shopId);
            const dataProduct = await Product.findOne({ where: { id: productId } });
            if (!dataProduct) {
                return next(new ErrorHandler('Sản phẩm không hợp lệ!', 400));
            }
            if (!shop) {
                return next(new ErrorHandler('Cửa hàng không hợp lệ!', 400));
            }
            const files = req.files;
            if (files && files.length > 0) {
                const imageUrls = files.map((file) => `${file.filename}`);
                productData.images = imageUrls;
            }
            dataProduct.name = productData.name || dataProduct.name;
            dataProduct.description = productData.description || dataProduct.description;
            dataProduct.price = productData.price || dataProduct.price;
            dataProduct.discountPrice = productData.discountPrice || dataProduct.discountPrice;
            dataProduct.originalPrice = productData.originalPrice || dataProduct.originalPrice;
            dataProduct.shopId = shopId;
            dataProduct.images = productData.images || dataProduct.images;
            await dataProduct.save();
            res.status(200).json({
                success: true,
                product: dataProduct,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);

// get all products of a shop
router.get(
    '/get-all-products-shop/:id',
    catchAsyncErrors(async (req, res, next) => {
        try {
            const products = await Product.findAll({
                where: { shopId: req.params.id },
            });

            // Parse JSON fields safely
            const updatedProducts = products.map((product) => {
                const newProduct = product.toJSON();
                newProduct.images = safeJSONParse(newProduct.images, []);
                newProduct.shop = safeJSONParse(newProduct.shop, {});
                newProduct.reviews = safeJSONParse(newProduct.reviews, []);
                return newProduct;
            });

            res.status(200).json({
                success: true,
                products: updatedProducts,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);

// delete product of a shop
router.delete(
    '/delete-shop-product/:id',
    isSeller,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const productId = req.params.id;

            const productData = await Product.findByPk(productId);
            let imageArr = productData.images;
            if (typeof imageArr === 'string') {
                imageArr = JSON.parse(imageArr);
            }
            imageArr.forEach((imageUrl) => {
                const filename = imageUrl;
                const filePath = `uploads/${filename}`;

                fs.unlink(filePath, (err) => {
                    if (err) {
                        // Error deleting file, continue anyway
                    }
                });
            });
            const product = await productData.destroy();
            if (!product) {
                return next(new ErrorHandler('Không tìm thấy sản phẩm với ID này!', 500));
            }
            res.status(201).json({
                success: true,
                message: 'Xóa sản phẩm thành công!',
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    }),
);

// get all products
router.get(
    '/get-all-products',
    catchAsyncErrors(async (req, res, next) => {
        try {
            const products = await Product.findAll({});
            const updatedProducts = products.map((product) => {
                const newProduct = product.toJSON();
                newProduct.images = safeJSONParse(newProduct.images, []);
                newProduct.shop = safeJSONParse(newProduct.shop, {});
                newProduct.reviews = safeJSONParse(newProduct.reviews, []);
                return newProduct;
            });
            res.status(201).json({
                success: true,
                products: updatedProducts,
            });
        } catch (error) {
            return next(new ErrorHandler(error, 400));
        }
    }),
);

// review for a product
router.put(
    '/create-new-review',
    isAuthenticated,
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { user, rating, comment, productId, orderId } = req.body;

            // Tìm sản phẩm
            const product = await Product.findByPk(productId);

            // Nếu không tìm thấy sản phẩm, trả về lỗi
            if (!product) {
                return next(new ErrorHandler('Sản phẩm không tồn tại!', 404));
            }

            // Perform Sentiment Analysis HERE
            let sentimentData = null;
            if (comment) {
                // Check if model is ready (optional, or just try to analyze)
                const isModelReady = await checkModelStatus();
                if (isModelReady) {
                    if (isModelReady) {
                        const sentimentResult = await analyzeSentiment(comment);
                        const aspectResult = await analyzeAspects(comment);

                        if (sentimentResult) {
                            sentimentData = getDominantLabel(sentimentResult);
                            if (sentimentData && aspectResult.length > 0) {
                                sentimentData.aspects = aspectResult;
                            }
                        }
                    }
                }
            }

            // Verify if user actually purchased and received the product
            const orders = await Order.findAll({
                where: {
                    'user.id': req.user.id,
                    status: 'Delivered'
                }
            });

            let isPurchased = false;
            for (const order of orders) {
                let cartItems = safeJSONParse(order.cart, []);
                if (Array.isArray(cartItems)) {
                    const found = cartItems.find(item => item.id === productId || item._id === productId); // Check both id formats just in case
                    if (found) {
                        isPurchased = true;
                        break;
                    }
                }
            }

            if (!isPurchased) {
                return next(new ErrorHandler('Bạn chỉ có thể đánh giá sản phẩm đã mua và đã nhận hàng!', 400));
            }

            const review = {
                user,
                rating,
                comment,
                productId,
                date: new Date(),
                sentiment: sentimentData, // Store the result!
            };

            const dataReview = product.reviews ? safeJSONParse(product.reviews, []) : [];

            const isReviewed = dataReview.find((rev) => rev.user.id == req.user.id);

            if (isReviewed) {
                dataReview.forEach((rev) => {
                    if (rev.user.id == req.user.id) {
                        rev.rating = rating;
                        rev.comment = comment;
                        rev.user = user;
                        rev.date = new Date();
                        rev.sentiment = sentimentData; // Update sentiment
                    }
                });
            } else {
                dataReview.push(review);
            }

            let avg = 0;
            dataReview.forEach((rev) => {
                avg += rev.rating;
            });

            product.ratings = avg / dataReview.length;

            // Note: Sequelize updates JSON fields by reassigning
            product.reviews = dataReview;

            // We need to explicitly tell Sequelize that this field has changed if using JSON datatype in some versions, 
            // but reassigning usually works.

            await Product.update(
                {
                    reviews: dataReview,
                    ratings: avg / dataReview.length
                },
                { where: { id: productId } }
            );

            res.status(200).json({
                success: true,
                message: 'Đánh giá thành công!',
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);

// all products --- for admin
router.get(
    '/admin-all-products',
    isAuthenticated,
    isAdmin('Admin'),
    catchAsyncErrors(async (req, res, next) => {
        try {
            const products = await Product.findAll({});
            res.status(201).json({
                success: true,
                products,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);
module.exports = router;
