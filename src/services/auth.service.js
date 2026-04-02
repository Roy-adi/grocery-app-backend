// src/services/auth.service.js
// Business logic for authentication.
// Controllers call these functions — services never touch req/res directly.

import { User } from "../models/User.model.js";
import { ApiError } from "../utils/ApiError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/token.js";

/**
 * Register a new user.
 * @param {{ name, email, password }} data - Validated signup payload
 * @returns {{ user, accessToken, refreshToken }}
 */
export const registerUser = async ({ name, email, password }) => {
  // 1. Check for duplicate email
  const existing = await User.findOne({ email });
  if (existing) {
    //  Handle account linking case
    if (existing.authProviders.includes("google")) {
      throw new ApiError(
        400,
        "Account already exists with Google. Please login with Google.",
      );
    }

    throw new ApiError(409, "Email already registered");
  }

  //  Generate avatar
  const avatar = generateAvatarUrl(name);

  // 2. Create user (password hashed in pre-save hook on the model)
  const user = await User.create({
    name,
    email,
    password,
    role: "user",
    authProviders: ["local"],
    avatar,
  });

  // 3. Generate token pair
  const { accessToken, refreshToken } = generateTokenPair(user);

  await attachRefreshToken(user, refreshToken);

  // 5. Return safe user shape (no password, no refreshToken)
  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 * Login an existing user.
 * @param {{ email, password }} data - Validated login payload
 * @returns {{ user, accessToken, refreshToken }}
 */
export const loginUser = async ({ email, password }) => {

  console.log(email, password)
  // 1. Find user — explicitly select password & lock fields (they're excluded by default)
  const user = await User.findOne({ email }).select(
    "+password +refreshTokens +loginAttempts +lockUntil +authProviders",
  );

  if (!user) {
    // Vague message intentional — avoid user enumeration
    throw new ApiError(401, "Invalid email or password");
  }

  //  Prevent wrong auth method

  if (!user.authProviders.includes("local")) {
    throw new ApiError(
      400,
      "This account uses Google login. Please continue with Google.",
    );
  }

  // 2. Check account lock
  if (user.isLocked()) {
    throw new ApiError(
      423,
      "Account temporarily locked due to too many failed login attempts. Try again in 15 minutes.",
    );
  }

  // 3. Verify password
  const isMatch = await user.isPasswordCorrect(password);
  if (!isMatch) {
    await user.incrementLoginAttempts(); // Track failure
    throw new ApiError(401, "Invalid email or password");
  }

  // 4. Successful login — reset lock counters
  await user.resetLoginAttempts();

  // 5. Generate token pair
  const { accessToken, refreshToken } = generateTokenPair(user);

  await attachRefreshToken(user, refreshToken);

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 *  GOOGLE AUTH (LOGIN + REGISTER + LINKING)
 */
export const googleAuth = async ({ name, email, googleId, avatar }) => {
  let user = await User.findOne({
    $or: [{ email }, { googleId }],
  }).select("+refreshTokens");

  if (!user) {
    //  First-time Google user
    user = await User.create({
      name,
      email,
      googleId,
      avatar,
      authProviders: "google",
    });
  } else {
    //  ACCOUNT LINKING CASE
    if (!user.googleId) {
      user.googleId = googleId;
    }

    //  Add provider if not already present
    if (!user.authProviders.includes("google")) {
      user.authProviders.push("google");
    }
  }

  const { accessToken, refreshToken } = generateTokenPair(user);

  await attachRefreshToken(user, refreshToken);

  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
};

/**
 * Rotate access + refresh tokens using a valid refresh token.
 * Called by a POST /auth/refresh endpoint (implement when needed).
 * @param {string} incomingRefreshToken
 * @returns {{ accessToken, refreshToken }}
 */
export const refreshTokens = async (incomingRefreshToken) => {
  // 1. Decode the incoming token
  const decoded = verifyRefreshToken(incomingRefreshToken);

  // 2. Find user and compare stored token
  const user = await User.findById(decoded.userId);

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  //  Check if token exists
  const tokenExists = user.refreshTokens.some(
    (t) => t.token === incomingRefreshToken,
  );

  //  REUSE DETECTION
  if (!tokenExists) {
    // compromise detected
    user.refreshTokens = []; // logout all devices
    await user.save({ validateBeforeSave: false });

    throw new ApiError(
      403,
      "Refresh token reuse detected. All sessions revoked.",
    );
  }

  //  Remove old token
  user.refreshTokens = user.refreshTokens.filter(
    (t) => t.token !== incomingRefreshToken,
  );

  // 3. Issue new pair (old refresh token is now invalid → rotation)
  const { accessToken, refreshToken } = generateTokenPair(user);

  user.refreshTokens.push({ token: refreshToken });

  await user.save({ validateBeforeSave: false });

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return sanitizeUser(user);
};

// update profile service

export const editProfileService = async (userId, data) => {
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  if (!data || typeof data !== "object") {
    throw new ApiError(400, "Invalid request data");
  }

  const { name, password } = data;

  const user = await User.findById(userId).select("+password");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let isModified = false;

  //  Update name
  if (name && name.trim() !== user.name) {
    user.name = name.trim();
    isModified = true;
  }

  //  Update password
  if (password) {
    const isSamePassword = await user.isPasswordCorrect(password);

    if (isSamePassword) {
      throw new ApiError(
        400,
        "New password must be different from old password",
      );
    }

    user.password = password; // pre-save hook will hash
    isModified = true;
  }

  if (!isModified) {
    throw new ApiError(400, "No changes detected");
  }

  //  Correct save
  await user.save();

  //  Safe return
  const userObj = user.toObject();
  delete userObj.password;

  return userObj;
};

/**
 * Logout: invalidate the refresh token stored in DB.
 * @param {string} userId
 */
export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateTokenPair = (user) => {
  const payload = { userId: user._id, role: user.role };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken({ userId: user._id }),
  };
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  createdAt: user.createdAt,
});

const attachRefreshToken = async (user, refreshToken) => {
  user.refreshTokens.push({ token: refreshToken });

  const MAX_SESSIONS = 5;

  if (user.refreshTokens.length > MAX_SESSIONS) {
    user.refreshTokens = user.refreshTokens
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_SESSIONS);
  }

  await user.save({ validateBeforeSave: false });
};

export const generateAvatarUrl = (name) => {
  const encodedName = encodeURIComponent(name.trim());

  return `https://ui-avatars.com/api/?name=${encodedName}&size=150&background=random&format=png`;
};
