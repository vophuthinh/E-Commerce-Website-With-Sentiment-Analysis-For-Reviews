import React, { useState } from 'react';
import { RxCross1 } from 'react-icons/rx';
import { IoBagHandleOutline } from 'react-icons/io5';
import { HiOutlineMinus, HiPlus } from 'react-icons/hi';
import { Link } from 'react-router-dom';
import { backend_url } from '../../server';
import { useDispatch, useSelector } from 'react-redux';
import { addTocart, removeFromCart } from '../../redux/actions/cart';
import { toast } from 'react-toastify';
import currency from 'currency-formatter';

const Cart = ({ setOpenCart }) => {
    const { cart } = useSelector((state) => state.cart);
    const dispatch = useDispatch();

    const removeFromCartHandler = (data) => {
        dispatch(removeFromCart(data));
        toast.success('Removed from cart!');
    };

    const totalPrice = cart.reduce((acc, item) => acc + item.qty * item.discountPrice, 0);

    const quantityChangeHandler = (data) => {
        dispatch(addTocart(data));
    };

    return (
        <div className="fixed top-0 left-0 w-full h-screen bg-black bg-opacity-40 z-10 transition-opacity duration-300 ease-in-out">
            <div className="fixed top-0 right-0 h-full w-full sm:w-[70%] md:w-[30%] bg-[#f7f9fc] flex flex-col overflow-y-auto shadow-lg rounded-l-lg">
                {cart.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="absolute top-3 right-3 p-2">
                            <RxCross1 size={25} className="cursor-pointer" onClick={() => setOpenCart(false)} />
                        </div>
                        <h5 className="text-[#3b4149]">Your cart is empty!</h5>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center px-6 py-4 bg-[#232f3e] text-white">
                            <RxCross1 size={25} className="cursor-pointer" onClick={() => setOpenCart(false)} />
                            <div className="flex items-center">
                                <IoBagHandleOutline size={25} />
                                <h5 className="pl-2 text-lg font-medium">{cart.length} Products</h5>
                            </div>
                        </div>

                        <div className="border-t border-[#ededed]">
                            {cart.map((item, index) => (
                                <CartSingle
                                    key={index}
                                    data={item}
                                    quantityChangeHandler={quantityChangeHandler}
                                    removeFromCartHandler={removeFromCartHandler}
                                />
                            ))}
                        </div>

                        <div className="px-5 py-3">
                            <Link to="/checkout">
                                <div className="h-[45px] flex items-center justify-center w-full bg-[#febd69] rounded-[5px] shadow-md hover:shadow-lg transition-shadow">
                                    <h1 className="text-[#131921] text-lg font-semibold">
                                        Buy ({currency.format(totalPrice, { code: 'VND' })})
                                    </h1>
                                </div>
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

const CartSingle = ({ data, quantityChangeHandler, removeFromCartHandler }) => {
    const [value, setValue] = useState(data.qty);
    const totalPrice = data.discountPrice * value;

    const increment = () => {
        if (data.stock < value + 1) {
            toast.error('Product stock limited!');
        } else {
            setValue(value + 1);
            quantityChangeHandler({ ...data, qty: value + 1 });
            toast.success('Quantity updated!');
        }
    };

    const decrement = () => {
        const newValue = value === 1 ? 1 : value - 1;
        setValue(newValue);
        quantityChangeHandler({ ...data, qty: newValue });
    };

    return (
        <div className="border-b p-4 flex items-center gap-4 bg-[#f5f5f7]">
            <div className="flex items-center gap-2">
                <button
                    className="bg-[#d35400] hover:bg-[#e74c3c] border border-[#d35400] rounded-full w-7 h-7 flex justify-center items-center cursor-pointer"
                    onClick={increment}
                >
                    <HiPlus size={18} color="#fff" />
                </button>
                <span className="text-lg font-medium">{data.qty}</span>
                <button
                    className="bg-[#777777] hover:bg-[#555555] rounded-full w-7 h-7 flex justify-center items-center cursor-pointer"
                    onClick={decrement}
                >
                    <HiOutlineMinus size={16} color="#fff" />
                </button>
            </div>
            <img src={`${backend_url}${data?.images[0]}`} alt={data.name} className="w-24 h-auto mx-2 rounded-md" />
            <div className="flex-1">
                <h1 className="text-lg font-medium text-[#1c1c1b]">{data.name}</h1>
                <h4 className="text-sm text-[#777777]">
                    {currency.format(data.discountPrice, { code: 'VND' })} x {value}
                </h4>
                <h4 className="text-xl font-bold text-[#e74c3c] mt-1">
                    {currency.format(totalPrice, { code: 'VND' })}
                </h4>
            </div>
            <button
                className="bg-[#d35400] hover:bg-[#e74c3c] p-2 rounded-full cursor-pointer"
                onClick={() => removeFromCartHandler(data)}
            >
                <RxCross1 size={25} color="#fff" />
            </button>
        </div>
    );
};

export default Cart;
