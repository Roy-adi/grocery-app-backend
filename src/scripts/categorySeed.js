// src/db/seeds/categories.seed.js
// Run manually: node src/db/seeds/categories.seed.js
import { connectDB } from "../db/connect.js";
import { Category } from "../models/Category.model.js";

const start = async () => {
  await connectDB();
  await seed();
};

start();


// ─── Default seeded categories ────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Dairy & Eggs",
  "Meat & Seafood",
  "Bakery & Bread",
  "Beverages",
  "Snacks & Sweets",
  "Frozen Foods",
  "Household Items",
  "Personal Care",
  "Cereals & Breakfast",
  "Condiments & Sauces",
  "Canned & Packaged",
  "Spices & Herbs",
  "Baby Products",
  "Pet Supplies",
];

const seed = async () => {
  try {

    const docs = DEFAULT_CATEGORIES.map((name) => ({
      name,
      user_id: null,
      isSeeded: true,
    }));

    // insertMany with ordered:false → skips duplicates, inserts the rest
    let inserted = 0;
    let skipped = 0;

    try {
      const result = await Category.insertMany(docs, { ordered: false });
      inserted = result.length;
      skipped = docs.length - inserted;
    } catch (err) {
      if (err.code === 11000 || err.name === "MongoBulkWriteError") {
        inserted = err.result?.nInserted ?? 0;
        skipped = docs.length - inserted;
      } else {
        throw err;
      }
    }

    console.log(`✅ Seed complete: ${inserted} inserted, ${skipped} already existed`);

    const all = await Category.find({ isSeeded: true });
    console.log(`Total seeded categories in DB: ${all.length}`);
    all.forEach((c) => console.log(`${c.name}`));
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    console.log(" done");
    process.exit(0);
  }
};


