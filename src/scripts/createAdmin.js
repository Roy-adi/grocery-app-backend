// scripts/createAdmin.js
import { User } from "../models/User.model.js";
import { connectDB } from "../db/connect.js";

const start = async () => {
  await connectDB();
  await createAdmin()
};

start();

const createAdmin = async () => {

  const admin = await User.create({
    name: "Super Admin",
    email: "admin@gmail.com",
    password: "123456",
    role: "admin",
    avatar: "https://ui-avatars.com/api/?name=Super+Admin&size=150",
    authProviders: ["local"],
  });

  console.log("Admin created:", admin.email);
  process.exit();
};

