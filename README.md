# Hệ Thống Thương Mại Điện Tử Với Phân Tích Cảm Xúc (E-Commerce with Sentiment Analysis)

## 📋 Mô tả dự án

Dự án này là một nền tảng thương mại điện tử Multi-Vendor (nhiều người bán) hoàn chỉnh, được tích hợp tính năng **phân tích cảm xúc (Sentiment Analysis)** thông minh từ đánh giá của người dùng. Hệ thống cho phép người dùng mua sắm, người bán quản lý cửa hàng, và quản trị viên giám sát toàn bộ hệ thống. Đặc biệt, AI được sử dụng để phân tích đánh giá sản phẩm (Tích cực/Tiêu cực/Trung tính), giúp người bán hiểu rõ hơn về phản hồi khách hàng.

## ✨ Tính năng chính

### 🛍️ Cho Khách Hàng
- **Đăng ký/Đăng nhập**: Bảo mật, xác thực qua Email.
- **Tìm kiếm & Lọc sản phẩm**: Tìm kiếm theo tên, danh mục, giá cả.
- **Giỏ hàng & Wishlist**: Quản lý sản phẩm yêu thích và dự định mua.
- **Thanh toán**: Tích hợp Stripe (thẻ tín dụng) và PayPal.
- **Đơn hàng**: Theo dõi trạng thái đơn hàng chi tiết.
- **Chat trực tiếp**: Nhắn tin real-time với người bán (gửi ảnh, xem trạng thái online).
- **Đánh giá sản phẩm**: Viết đánh giá và xem phân tích cảm xúc của các đánh giá khác.

### 🏪 Cho Người Bán (Vendor)
- **Dashboard quản lý**: Thống kê doanh thu, đơn hàng, sản phẩm.
- **Quản lý Sản phẩm & Sự kiện**: Tạo, sửa, xóa sản phẩm, tạo các sự kiện giảm giá có thời hạn.
- **Mã giảm giá (Coupons)**: Tạo mã giảm giá cho cửa hàng.
- **Quản lý Đơn hàng**: Cập nhật trạng thái đơn hàng, xử lý hoàn tiền.
- **Rút tiền**: Yêu cầu rút tiền doanh thu về tài khoản ngân hàng.
- **Hộp thư**: Chat trực tiếp với khách hàng.

### 👨‍💼 Cho Quản Trị Viên (Admin)
- **Quản lý người dùng & Cửa hàng**: Xem, xóa tài khoản vi phạm.
- **Duyệt yêu cầu rút tiền**: Xử lý các yêu cầu rút tiền từ người bán.
- **Thống kê hệ thống**: Xem tổng quan về hoạt động của sàn.

### 🤖 Tính năng AI đặc biệt
- **Phân tích cảm xúc**: Tự động phân tích nội dung đánh giá của khách hàng sử dụng mô hình AI (Hugging Face BERTweet), gán nhãn Tích cực/Tiêu cực cho đánh giá.

## 🛠️ Công nghệ sử dụng

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MySQL (sử dụng Sequelize ORM)
- **Real-time**: Socket.io (Chat, thông báo)
- **Authentication**: JWT, Bcrypt
- **AI/ML**: Hugging Face Inference API (Sentiment Analysis)
- **Payment**: Stripe, PayPal
- **Email**: Nodemailer (SMTP)
- **File Storage**: Cloudinary (Lưu trữ ảnh)

### Frontend
- **Library**: React.js
- **State Management**: Redux Toolkit
- **Styling**: Tailwind CSS, Material UI
- **Real-time**: Socket.io-client
- **HTTP Client**: Axios

### Socket Server
- **Server riêng biệt**: Xử lý kết nối thời gian thực độc lập giúp tối ưu hiệu năng.

## 📦 Hướng dẫn cài đặt & Chạy dự án

### Yêu cầu hệ thống
- Node.js (v14 trở lên)
- MySQL Database
- Các tài khoản API: Cloudinary, Stripe, Hugging Face (Optional cho AI).

### 1. Cài đặt Backend
```bash
cd backend
npm install
```

Tạo file `.env` trong thư mục `backend/config/` với nội dung mẫu:
```env
PORT=8000
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ecommerce_sentiment
JWT_SECRET=your_super_secret_key
JWT_EXPIRES=7d
ACTIVATION_SECRET=your_activation_secret
SMPT_HOST=smtp.gmail.com
SMPT_PORT=465
SMPT_PASSWORD=your_app_password
SMPT_MAIL=your_email@gmail.com
STRIPE_API_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
CLOUDINARY_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
HUGGINGFACE_API_TOKEN=your_huggingface_token
FRONTEND_URL=http://localhost:3000
```

### 2. Cài đặt Frontend
```bash
cd frontend
npm install
```
(Frontend sử dụng `server.js` cấu hình proxy và các hằng số trong code trỏ về backend)

### 3. Cài đặt Socket Server
```bash
cd socket
npm install
```
Tạo file `.env` trong thư mục `socket/`:
```env
PORT=4000
```

## 🚀 Chạy ứng dụng

Bạn cần mở 3 terminal riêng biệt để chạy toàn bộ hệ thống:

**Terminal 1 (Backend):**
```bash
cd backend
npm run dev
# Server chạy tại http://localhost:8000
```

**Terminal 2 (Socket):**
```bash
cd socket
npm start
# Socket chạy tại http://localhost:4000
```

**Terminal 3 (Frontend):**
```bash
cd frontend
npm start
# Web chạy tại http://localhost:3000
```

## 📝 API Endpoints Chính

- **User**: `/api/v2/user` (Register, Login, Profile, Activation)
- **Shop**: `/api/v2/shop` (Register Shop, Login, Info)
- **Product**: `/api/v2/product` (CRUD Product, Reviews, Like)
- **Order**: `/api/v2/order` (Create, Get, Update Status)
- **Chat**: `/api/v2/conversation`, `/api/v2/message`
- **Payment**: `/api/v2/payment` (Stripe process)
- **Withdraw**: `/api/v2/withdraw` 

## 👨‍💻 Tác giả
- **Vo Phu Thinh**
- Email: [vophuthinhcm@gmail.com]

## 📄 License
Dự án này được cấp phép theo chứng chỉ **ISC**.
