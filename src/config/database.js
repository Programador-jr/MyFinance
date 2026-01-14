const mongoose = require("mongoose");

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        dbName: process.env.DB_NAME,
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000
      })
      .then((mongoose) => mongoose);
  }
try {
  cached.conn = await cached.promise;
} catch (err) {
    cached.promise = null;
    throw err;
}
  return cached.conn;
} 

module.exports = connectDB;
