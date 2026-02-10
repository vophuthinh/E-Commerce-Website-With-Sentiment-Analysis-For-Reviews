import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  cart: localStorage.getItem("cartItems")
    ? JSON.parse(localStorage.getItem("cartItems"))
    : [],
};

export const cartReducer = createReducer(initialState, {
  addToCart: (state, action) => {
    const item = action.payload;
    const isItemExist = state.cart.find((i) => i.id === item.id);
    if (isItemExist) {
      // Immer allows direct mutation
      const index = state.cart.findIndex((i) => i.id === isItemExist.id);
      state.cart[index] = item;
    } else {
      state.cart.push(item);
    }
  },

  removeFromCart: (state, action) => {
    state.cart = state.cart.filter((i) => i.id !== action.payload);
  },
});
