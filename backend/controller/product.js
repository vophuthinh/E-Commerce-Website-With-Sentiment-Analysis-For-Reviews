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
const logger = require('../utils/logger');
const { analyzeSentiment, analyzeAspects, buildSentimentResult } = require('./analyzeSentiment');
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
            if (!productData) {
                return next(new ErrorHandler('Không tìm thấy sản phẩm với ID này!', 404));
            }
            let imageArr = safeJSONParse(productData.images, []);
            if (Array.isArray(imageArr)) {
                imageArr.forEach((imageUrl) => {
                    const filePath = `uploads/${imageUrl}`;
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            // Error deleting file, continue anyway
                        }
                    });
                });
            }
            await productData.destroy();
            res.status(200).json({
                success: true,
                message: 'Xóa sản phẩm thành công!',
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
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
            res.status(200).json({
                success: true,
                products: updatedProducts,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 400));
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

            // ── 1. Input Validation ──
            const numRating = Number(rating);
            if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
                return next(new ErrorHandler('Rating phải là số nguyên từ 1 đến 5!', 400));
            }
            if (!productId) {
                return next(new ErrorHandler('Thiếu thông tin sản phẩm!', 400));
            }
            if (!user || !user.id) {
                return next(new ErrorHandler('Thiếu thông tin người dùng!', 400));
            }
            // Require comment for low ratings (1-2 stars) — helps sellers improve
            if (numRating <= 2 && (!comment || comment.trim().length === 0)) {
                return next(new ErrorHandler('Vui lòng cho biết lý do bạn không hài lòng (bắt buộc khi đánh giá 1-2 sao)!', 400));
            }

            // ── 2. Find Product ──
            const product = await Product.findByPk(productId);
            if (!product) {
                return next(new ErrorHandler('Sản phẩm không tồn tại!', 404));
            }

            // ── 3. Purchase Verification (optimized) ──
            // Only fetch delivered orders, then filter by user in JS
            const allDeliveredOrders = await Order.findAll({
                where: { status: 'Delivered' },
                attributes: ['id', 'user', 'cart'],
            });
            const userOrders = allDeliveredOrders.filter(order => {
                const orderUser = safeJSONParse(order.user, {});
                return String(orderUser.id) === String(req.user.id);
            });

            // Check if the user purchased this specific product
            let matchedOrderId = null;
            for (const order of userOrders) {
                const cartItems = safeJSONParse(order.cart, []);
                if (Array.isArray(cartItems)) {
                    const found = cartItems.find(
                        item => String(item.id) === String(productId) || String(item._id) === String(productId)
                    );
                    if (found) {
                        matchedOrderId = order.id;
                        break;
                    }
                }
            }

            if (!matchedOrderId) {
                return next(new ErrorHandler('Bạn chỉ có thể đánh giá sản phẩm đã mua và đã nhận hàng!', 400));
            }

            // ── 4. Sentiment Analysis (non-blocking) ──
            let sentimentData = null;
            if (comment && comment.trim().length > 0) {
                try {
                    const [sentimentResult, aspectResult] = await Promise.all([
                        analyzeSentiment(comment),
                        analyzeAspects(comment),
                    ]);

                    if (sentimentResult) {
                        sentimentData = buildSentimentResult(sentimentResult, aspectResult, comment, numRating);
                    }
                } catch (sentimentError) {
                    // Sentiment failure should never block review creation
                    logger.error(`Sentiment analysis failed for product ${productId}:`, sentimentError.message);
                }
            }

            // ── 5. Build Review Object ──
            const now = new Date();
            const review = {
                user: { id: user.id, name: user.name, avatar: user.avatar }, // only store needed fields
                rating: numRating,
                comment: comment ? comment.trim() : '',
                productId,
                orderId: orderId || matchedOrderId,
                date: now,
                sentiment: sentimentData,
            };

            // ── 6. Existing Reviews — Check: allow one review per user per product ──
            const dataReview = product.reviews ? safeJSONParse(product.reviews, []) : [];
            const existingIdx = dataReview.findIndex((rev) => String(rev.user?.id) === String(req.user.id));

            if (existingIdx >= 0) {
                // Update existing review (preserve original date as createdAt)
                const existing = dataReview[existingIdx];
                dataReview[existingIdx] = {
                    ...review,
                    createdAt: existing.createdAt || existing.date, // preserve original creation time
                    date: now, // date = last modified
                    isEdited: true,
                };
            } else {
                review.createdAt = now;
                dataReview.push(review);
            }

            // ── 7. Calculate Average Rating ──
            // Weighted average: if sentiment agrees with rating, full weight; else reduced weight
            let totalWeight = 0;
            let weightedSum = 0;

            for (const rev of dataReview) {
                let weight = 1.0;

                // If sentiment data exists, use it to weight reviews
                if (rev.sentiment && rev.sentiment.score) {
                    const sentimentAgrees =
                        (rev.rating >= 4 && rev.sentiment.label === 'POS') ||
                        (rev.rating <= 2 && rev.sentiment.label === 'NEG') ||
                        (rev.rating === 3);

                    // Reviews where sentiment matches stars are more trustworthy
                    weight = sentimentAgrees ? 1.0 : 0.8;

                    // Sarcasm detected → reduce weight further
                    if (rev.sentiment.sarcasmDetected) {
                        weight *= 0.7;
                    }
                }

                weightedSum += rev.rating * weight;
                totalWeight += weight;
            }

            const avgRating = totalWeight > 0 ? (weightedSum / totalWeight) : 0;
            const roundedRating = parseFloat(avgRating.toFixed(2));

            // ── 8. Save to DB ──
            await Product.update(
                {
                    reviews: dataReview,
                    ratings: roundedRating,
                },
                { where: { id: productId } }
            );

            res.status(200).json({
                success: true,
                message: existingIdx >= 0 ? 'Cập nhật đánh giá thành công!' : 'Đánh giá thành công!',
                review,
                averageRating: roundedRating,
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
            res.status(200).json({
                success: true,
                products,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);

// get sentiment statistics for a shop
router.get(
    '/sentiment-stats/:shopId',
    catchAsyncErrors(async (req, res, next) => {
        try {
            const { aggregateSentiments } = require('./analyzeSentiment');
            const products = await Product.findAll({
                where: { shopId: req.params.shopId },
            });

            // Collect all reviews from all products
            const allReviews = [];
            for (const product of products) {
                const reviews = safeJSONParse(product.reviews, []);
                if (Array.isArray(reviews)) {
                    allReviews.push(...reviews);
                }
            }

            const stats = aggregateSentiments(allReviews);

            res.status(200).json({
                success: true,
                stats,
                totalProducts: products.length,
                totalReviews: allReviews.length,
            });
        } catch (error) {
            return next(new ErrorHandler(error.message, 500));
        }
    }),
);

module.exports = router;
