import { createReducer } from "@reduxjs/toolkit";

const initialState = {
  wishlist: localStorage.getItem("wishlistItems")
    ? JSON.parse(localStorage.getItem("wishlistItems"))
    : [],
};

export const wishlistReducer = createReducer(initialState, {
  addToWishlist: (state, action) => {
    const item = action.payload;
    const isItemExist = state.wishlist.find((i) => i.id === item.id);
    if (isItemExist) {
      const index = state.wishlist.findIndex((i) => i.id === isItemExist.id);
      state.wishlist[index] = item;
    } else {
      state.wishlist.push(item);
    }
  },

  removeFromWishlist: (state, action) => {
    state.wishlist = state.wishlist.filter((i) => i.id !== action.payload);
  },
});
