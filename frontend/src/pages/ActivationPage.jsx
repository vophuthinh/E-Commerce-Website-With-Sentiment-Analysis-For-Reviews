import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { server } from "../server";
import { toast } from "react-toastify";

const ActivationPage = () => {
  const { activation_token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [email, setEmail] = useState("");

  // Try to get password from sessionStorage when component loads
  useEffect(() => {
    if (activation_token) {
      // Try to decode token to get email (basic attempt)
      try {
        // Check sessionStorage for temporary password
        // Look for any temp_password_* keys
        const keys = Object.keys(sessionStorage);
        const passwordKey = keys.find(key => key.startsWith('temp_password_'));
        if (passwordKey) {
          const storedPassword = sessionStorage.getItem(passwordKey);
          const storedEmail = passwordKey.replace('temp_password_', '');
          if (storedPassword) {
            setPassword(storedPassword);
            setEmail(storedEmail);
          } else {
            setShowPasswordInput(true);
          }
        } else {
          setShowPasswordInput(true);
        }
      } catch (err) {
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
      const response = await axios.post(`${server}/user/activation`, {
        activation_token,
        password,
      });
      
      // Clear temporary password from sessionStorage
      const keys = Object.keys(sessionStorage);
      const passwordKey = keys.find(key => key.startsWith('temp_password_'));
      if (passwordKey) {
        sessionStorage.removeItem(passwordKey);
      }
      
      toast.success("Account activated successfully!");
      setTimeout(() => {
        navigate("/login");
      }, 2000);
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px',
      }}
    >
      {error ? (
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Your token has expired!</p>
          <button
            onClick={() => navigate("/sign-up")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Sign Up Again
          </button>
        </div>
      ) : showPasswordInput ? (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">Activate Your Account</h2>
          <p className="text-gray-600 mb-4 text-center">
            Please enter your password to activate your account
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
            {loading ? "Activating..." : "Activate Account"}
          </button>
        </div>
      ) : loading ? (
        <div className="text-center">
          <p className="text-lg">Activating your account...</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-green-600 text-lg mb-4">Your account has been successfully activated!</p>
          <button
            onClick={() => navigate("/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivationPage;
