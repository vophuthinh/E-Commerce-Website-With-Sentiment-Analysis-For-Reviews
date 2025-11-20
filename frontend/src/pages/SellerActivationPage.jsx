import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { server } from '../server';
import { toast } from 'react-toastify';
import Lottie from 'react-lottie';
import animationData from '../Assests/animations/107043-success.json';
import animationDatafail from '../Assests/animations/failtoken.json';

const SellerActivationPage = () => {
    const { activation_token } = useParams();
    const navigate = useNavigate();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState("");
    const [showPasswordInput, setShowPasswordInput] = useState(false);
    const defaultOptions = {
        loop: false,
        autoplay: true,
        animationData: animationData,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    };
    const failOptions = {
        loop: false,
        autoplay: true,
        animationData: animationDatafail,
        rendererSettings: {
            preserveAspectRatio: 'xMidYMid slice',
        },
    };

    // Try to get password from sessionStorage when component loads
    useEffect(() => {
        if (activation_token) {
            // Check sessionStorage for temporary seller password
            const keys = Object.keys(sessionStorage);
            const passwordKey = keys.find(key => key.startsWith('temp_seller_password_'));
            if (passwordKey) {
                const storedPassword = sessionStorage.getItem(passwordKey);
                if (storedPassword) {
                    setPassword(storedPassword);
                } else {
                    setShowPasswordInput(true);
                }
            } else {
                setShowPasswordInput(true);
            }
        }
    }, [activation_token]);

    const handleActivation = async () => {
        if (!password) {
            toast.error("Please enter your password");
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${server}/shop/activation`, {
                activation_token,
                password,
            });
            
            // Clear temporary password from sessionStorage
            const keys = Object.keys(sessionStorage);
            const passwordKey = keys.find(key => key.startsWith('temp_seller_password_'));
            if (passwordKey) {
                sessionStorage.removeItem(passwordKey);
            }
            
            toast.success("Shop account activated successfully!");
        } catch (err) {
            setError(true);
            toast.error(err.response?.data?.message || "Activation failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Auto-activate if password is available and not showing input
        if (activation_token && password && !showPasswordInput && !error && !loading) {
            handleActivation();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activation_token, password, showPasswordInput, error]);

    return (
        <div
            style={{
                width: '100%',
                height: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
            }}
        >
            {error ? (
                <div>
                    <Lottie options={failOptions} width={300} height={300} />
                    <h5 className="text-center mb-14 text-[25px] text-[#000000a1]">Your token has expired 😭</h5>
                    <button
                        onClick={() => navigate("/shop-create")}
                        className="mx-auto block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Register Again
                    </button>
                </div>
            ) : showPasswordInput ? (
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-4 text-center">Activate Your Shop Account</h2>
                    <p className="text-gray-600 mb-4 text-center">
                        Please enter your password to activate your shop account
                    </p>
                    <div className="mb-4">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter your password"
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={handleActivation}
                        disabled={loading || !password}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? "Activating..." : "Activate Shop Account"}
                    </button>
                </div>
            ) : loading ? (
                <div>
                    <Lottie options={defaultOptions} width={300} height={300} />
                    <h5 className="text-center mb-14 text-[25px] text-[#000000a1]">
                        Activating your shop account...
                    </h5>
                </div>
            ) : (
                <div>
                    <Lottie options={defaultOptions} width={300} height={300} />
                    <h5 className="text-center mb-14 text-[25px] text-[#000000a1]">
                        Sales account created successfully 🥳
                    </h5>
                    <button
                        onClick={() => navigate("/shop-login")}
                        className="mx-auto block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Go to Shop Login
                    </button>
                </div>
            )}
        </div>
    );
};

export default SellerActivationPage;
