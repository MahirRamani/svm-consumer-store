import '@/models';
import mongoose, { Mongoose } from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

// Type for the cached connection
interface MongooseCache {
  promise: Promise<Mongoose> | null;
  conn: Mongoose | null;
}

// Type declaration for the global cache
declare global {
  var mongoose: MongooseCache | undefined;
}

// Use globalThis instead of global for Edge Runtime compatibility
let cached: MongooseCache = globalThis.mongoose || { conn: null, promise: null };

if (!globalThis.mongoose) {
  globalThis.mongoose = cached;
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      console.log("✅ MongoDB connected successfully");
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;


// // import mongoose from 'mongoose'

// // const MONGODB_URI = process.env.MONGODB_URI

// // console.log(`MONGODB_URI: ${MONGODB_URI}`)

// // if (!MONGODB_URI) {
// //   throw new Error("Please define the MONGODB_URI environment variable inside .env")
// // }

// // const dbConnect = async () => {
// //   if (mongoose.connection.readyState >= 1) return

// //   try {
// //     await mongoose.connect(MONGODB_URI)
// //     console.log("MongoDB connected successfully")
// //   } catch (error) {
// //     console.error("MongoDB connection error:", error)
// //     throw error
// //   }
// // }

// // console.log("dbConnect ran successfully")

// // dbConnect()
// // export default dbConnect
