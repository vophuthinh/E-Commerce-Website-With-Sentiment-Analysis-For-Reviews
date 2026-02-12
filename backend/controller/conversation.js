const Conversation = require("../model/conversation");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const express = require("express");
const { isSeller, isAuthenticated } = require("../middleware/auth");
const safeJSONParse = require("../utils/safeJSONParse");
const router = express.Router();

/**
 * Helper: Parse conversation members and normalize conversation object
 */
function normalizeConversation(conv) {
  const obj = conv.toJSON ? conv.toJSON() : { ...conv };
  obj.members = safeJSONParse(obj.members, []);
  return obj;
}

// create a new conversation
router.post(
  "/create-new-conversation",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { groupTitle, userId, sellerId } = req.body;
      const isConversationExist = await Conversation.findOne({
        where: { groupTitle: groupTitle },
      });

      if (isConversationExist) {
        const conversation = isConversationExist;
        res.status(200).json({
          success: true,
          conversation: normalizeConversation(conversation),
        });
      } else {
        const conversation = await Conversation.create({
          members: [userId, sellerId],
          groupTitle: groupTitle,
        });

        return res.status(201).json({
          success: true,
          conversation: normalizeConversation(conversation),
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get seller conversations
router.get(
  "/get-all-conversation-seller/:id",
  isSeller,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const sellerId = req.params.id;
      const conversations = await Conversation.findAll({});
      const filteredConversations = conversations.filter((conversation) => {
        const members = safeJSONParse(conversation.members, []);
        return Array.isArray(members) && members.includes(sellerId);
      });
      if (filteredConversations.length === 0) {
        return res.status(200).json({
          success: true,
          conversations: [],
        });
      }
      const normalizedConversations = filteredConversations.map(normalizeConversation);
      res.status(200).json({
        success: true,
        conversations: normalizedConversations,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get user conversations
router.get(
  "/get-all-conversation-user/:id",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const userId = req.params.id;
      const conversations = await Conversation.findAll({});
      const filteredConversations = conversations.filter((conversation) => {
        const members = safeJSONParse(conversation.members, []);
        return Array.isArray(members) && members.includes(userId);
      });
      if (filteredConversations.length === 0) {
        return res.status(200).json({
          success: true,
          conversations: [],
        });
      }
      const normalizedConversations = filteredConversations.map(normalizeConversation);
      res.status(200).json({
        success: true,
        conversations: normalizedConversations,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update the last message
router.put(
  "/update-last-message/:id",
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { lastMessage, lastMessageId } = req.body;

      const conversation = await Conversation.findByPk(req.params.id);
      if (!conversation) {
        return next(new ErrorHandler("Cuộc trò chuyện không tồn tại!", 404));
      }
      conversation.lastMessage = lastMessage;
      conversation.lastMessageId = lastMessageId;

      await conversation.save();

      res.status(200).json({
        success: true,
        conversation: normalizeConversation(conversation),
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
