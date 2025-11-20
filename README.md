# Hệ Thống Thương Mại Điện Tử Với Phân Tích Cảm Xúc

## 📋 Mô tả dự án

Dự án này là một nền tảng thương mại điện tử hoàn chỉnh được tích hợp tính năng phân tích cảm xúc thông minh từ đánh giá sản phẩm của người dùng. Hệ thống sử dụng AI để phân tích và hiểu phản hồi của khách hàng, giúp người bán và quản trị viên có cái nhìn sâu sắc hơn về trải nghiệm mua sắm, từ đó cải thiện chất lượng dịch vụ và sản phẩm một cách hiệu quả.

## ✨ Tính năng chính

### 🛍️ Quản lý người dùng
- Đăng ký và đăng nhập cho khách hàng, người bán và quản trị viên
- Xác thực email để kích hoạt tài khoản
- Quản lý profile và thông tin cá nhân
- Phân quyền và bảo mật với JWT

### 📦 Quản lý sản phẩm
- Tạo, chỉnh sửa và xóa sản phẩm
- Upload và quản lý hình ảnh sản phẩm với Cloudinary
- Phân loại và tìm kiếm sản phẩm
- Quản lý kho hàng và số lượng tồn kho

### 🎯 Quản lý đơn hàng
- Đặt hàng và theo dõi đơn hàng
- Quản lý trạng thái đơn hàng (đang xử lý, đã giao, hoàn trả...)
- Xem chi tiết đơn hàng

### 💳 Thanh toán
- Tích hợp Stripe cho thanh toán thẻ tín dụng
- Tích hợp PayPal cho thanh toán trực tuyến
- Thanh toán an toàn và bảo mật

### 🎉 Sự kiện & Mã giảm giá
- Tạo và quản lý sự kiện khuyến mãi
- Hệ thống mã giảm giá (Coupon Code)
- Áp dụng giảm giá tự động

### 💬 Chat trực tiếp (Real-time)
- Hỗ trợ chat real-time giữa người dùng và người bán
- Gửi tin nhắn văn bản và hình ảnh
- Theo dõi trạng thái đã đọc tin nhắn
- Server Socket.io riêng biệt để xử lý chat

### 🤖 Phân tích cảm xúc
- Phân tích cảm xúc từ đánh giá sản phẩm
- Sử dụng OpenAI và Google Cloud Translate API
- Hiển thị kết quả phân tích cho người bán và quản trị viên

### 👨‍💼 Dashboard quản trị
- Dashboard cho quản trị viên với thống kê tổng quan
- Quản lý người dùng, người bán, sản phẩm, đơn hàng
- Quản lý yêu cầu rút tiền của người bán
- Phân tích và báo cáo

### 🏪 Dashboard người bán
- Quản lý sản phẩm của cửa hàng
- Quản lý đơn hàng
- Theo dõi doanh thu
- Yêu cầu rút tiền

## 🏗️ Cấu trúc dự án

```
Ecommerce/
│
├── backend/              # Backend API Server
│   ├── config/          # Cấu hình database, environment
│   ├── controller/      # Controllers xử lý business logic
│   │   ├── user.js
│   │   ├── shop.js
│   │   ├── product.js
│   │   ├── order.js
│   │   ├── payment.js
│   │   ├── event.js
│   │   ├── coupounCode.js
│   │   ├── conversation.js
│   │   ├── message.js
│   │   ├── withdraw.js
│   │   └── analyzeSentiment.js
│   ├── middleware/      # Middleware xử lý authentication, errors
│   │   ├── auth.js
│   │   ├── error.js
│   │   └── catchAsyncErrors.js
│   ├── model/           # Database models (MongoDB & MySQL)
│   │   ├── user.js
│   │   ├── shop.js
│   │   ├── product.js
│   │   ├── order.js
│   │   ├── event.js
│   │   ├── coupounCode.js
│   │   ├── conversation.js
│   │   ├── messages.js
│   │   └── withdraw.js
│   ├── utils/           # Utilities (JWT, Error Handler, Send Mail)
│   ├── uploads/         # Thư mục lưu file upload
│   ├── app.js           # Express app configuration
│   ├── server.js        # Server entry point
│   └── package.json
│
├── frontend/            # React Frontend Application
│   ├── public/          # Static files
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── Admin/   # Admin components
│   │   │   ├── Shop/    # Shop dashboard components
│   │   │   ├── Products/
│   │   │   ├── Cart/
│   │   │   ├── Checkout/
│   │   │   ├── Payment/
│   │   │   ├── Profile/
│   │   │   ├── Events/
│   │   │   ├── Wishlist/
│   │   │   ├── Layout/
│   │   │   ├── Login/
│   │   │   ├── Signup/
│   │   │   └── Route/
│   │   ├── pages/       # Page components
│   │   ├── redux/       # Redux store, actions, reducers
│   │   ├── routes/      # Route configuration
│   │   ├── styles/      # CSS/Tailwind styles
│   │   └── server.js    # Proxy server configuration
│   ├── tailwind.config.js
│   └── package.json
│
├── socket/              # Socket.io Server (Real-time Chat)
│   ├── index.js         # Socket server entry point
│   └── package.json
│
└── README.md
```

## 🛠️ Công nghệ sử dụng

### Backend
- **Runtime**: Node.js 18.10.0
- **Framework**: Express.js
- **Database**: 
  - MongoDB với Mongoose (cho user, product, order...)
  - MySQL với Sequelize (cho một số tính năng khác)
- **Authentication**: JWT (JSON Web Token)
- **File Upload**: Multer, Cloudinary
- **Payment**: Stripe API
- **AI & NLP**: 
  - OpenAI API (cho phân tích cảm xúc)
  - Google Cloud Translate API
- **Real-time**: Socket.io
- **Email**: Nodemailer
- **Others**: Bcrypt (password hashing), Cookie-parser, CORS

### Frontend
- **Framework**: React 18.2.0
- **State Management**: Redux Toolkit, React Redux
- **Routing**: React Router DOM 6.8.2
- **UI Framework**: 
  - TailwindCSS 3.2.7
  - Material-UI (MUI) 6.1.6
- **Charts**: Chart.js, React-Chartjs-2
- **Payment**: 
  - Stripe React
  - PayPal React
- **Real-time**: Socket.io-client
- **HTTP Client**: Axios
- **Others**: React Toastify, React Icons, Swiper

### Socket Server
- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.io 4.6.1+

## 📦 Hướng dẫn cài đặt

### Yêu cầu hệ thống
- Node.js >= 18.10.0
- npm hoặc yarn
- MongoDB (đang chạy)
- MySQL (đang chạy)
- Tài khoản Cloudinary (cho lưu trữ hình ảnh)
- API Key OpenAI
- API Key Google Cloud Translate (tùy chọn)
- Stripe Account (cho thanh toán)
- PayPal Developer Account (cho thanh toán)

### 1. Clone repository

```bash
git clone <repository-url>
cd Ecommerce
```

### 2. Cài đặt Backend

```bash
cd backend
npm install
```

Tạo file `.env` trong thư mục `backend/config/` với nội dung:

```env
NODE_ENV=development
PORT=8000
DB_URI=your_mongodb_connection_string
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=new-nodejs
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
COOKIE_EXPIRE=5
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_API_KEY=your_stripe_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_APPLICATION_CREDENTIALS=path_to_google_credentials.json
FRONTEND_URL=http://localhost:3000
```

Chạy Backend:

```bash
npm start
# hoặc cho development
npm run dev
```

Backend sẽ chạy tại: `http://localhost:8000`

### 3. Cài đặt Frontend

```bash
cd frontend
npm install
```

Tạo file `.env` trong thư mục `frontend/` (nếu cần):

```env
REACT_APP_SERVER_URL=http://localhost:8000
REACT_APP_SOCKET_URL=http://localhost:4000
REACT_APP_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

Chạy Frontend:

```bash
npm start
```

Frontend sẽ chạy tại: `http://localhost:3000`

### 4. Cài đặt Socket Server

```bash
cd socket
npm install
```

Tạo file `.env` trong thư mục `socket/`:

```env
PORT=4000
```

Chạy Socket Server:

```bash
npm start
```

Socket Server sẽ chạy tại: `http://localhost:4000`

## 🚀 Chạy dự án

Sau khi cài đặt xong, bạn cần chạy 3 server cùng lúc:

### Terminal 1 - Backend
```bash
cd backend
npm start
```

### Terminal 2 - Frontend
```bash
cd frontend
npm start
```

### Terminal 3 - Socket Server
```bash
cd socket
npm start
```

Mở trình duyệt và truy cập: `http://localhost:3000`

## 📝 API Endpoints

### User Routes (`/api/v2/user`)
- POST `/register` - Đăng ký người dùng mới
- POST `/login` - Đăng nhập
- GET `/logout` - Đăng xuất
- GET `/me` - Lấy thông tin người dùng hiện tại
- PUT `/update-profile` - Cập nhật thông tin cá nhân
- PUT `/update-password` - Đổi mật khẩu
- GET `/activation/:token` - Kích hoạt tài khoản

### Product Routes (`/api/v2/product`)
- GET `/get-all-products` - Lấy tất cả sản phẩm
- GET `/get-product/:id` - Lấy chi tiết sản phẩm
- POST `/create-product` - Tạo sản phẩm mới (Seller)
- PUT `/update-product/:id` - Cập nhật sản phẩm (Seller)
- DELETE `/delete-product/:id` - Xóa sản phẩm (Seller)

### Order Routes (`/api/v2/order`)
- POST `/create-order` - Tạo đơn hàng mới
- GET `/get-all-orders/:userId` - Lấy tất cả đơn hàng
- GET `/get-order/:id` - Lấy chi tiết đơn hàng
- PUT `/update-order-status/:id` - Cập nhật trạng thái đơn hàng

### Payment Routes (`/api/v2/payment`)
- POST `/process` - Xử lý thanh toán Stripe
- POST `/stripeapikey` - Lấy Stripe API key

### Conversation & Message Routes
- `/api/v2/conversation` - Quản lý cuộc trò chuyện
- `/api/v2/message` - Gửi và nhận tin nhắn

### Admin Routes
- Quản lý người dùng, người bán, sản phẩm, đơn hàng
- Xử lý yêu cầu rút tiền

## 🔐 Bảo mật

- JWT Authentication cho tất cả các route được bảo vệ
- Password được hash bằng bcrypt
- CORS được cấu hình để bảo vệ API
- Cookie-based authentication
- Xác thực email cho tài khoản mới

## 📄 License

ISC

## 👨‍💻 Tác giả

- **Tác giả**: Vo Phu Thinh
- **Email**: [vophuthinhcm@gmail.com]

## 🤝 Đóng góp

Đóng góp cho dự án này rất được hoan nghênh! Vui lòng:
1. Fork repository
2. Tạo branch mới (`git checkout -b feature/AmazingFeature`)
3. Commit các thay đổi (`git commit -m 'Add some AmazingFeature'`)
4. Push lên branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

Hoặc liên hệ qua email để thảo luận về các thay đổi lớn.

---

> **Lưu ý**: Dự án này được phát triển với mục đích học tập và nghiên cứu. Hãy đảm bảo cấu hình đúng các biến môi trường và API keys trước khi sử dụng trong môi trường production.
