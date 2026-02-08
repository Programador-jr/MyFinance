const mongoose = require("mongoose");
const dns = require("node:dns");

let cached = global.mongoose;
let dnsConfigured = false;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

function configureDnsServers() {
  if (dnsConfigured) {
    return;
  }

  const rawDnsServers = process.env.DNS_SERVERS;
  if (!rawDnsServers) {
    dnsConfigured = true;
    return;
  }

  const servers = rawDnsServers
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!servers.length) {
    dnsConfigured = true;
    return;
  }

  try {
    dns.setServers(servers);
    console.log(`MongoDB DNS servers: ${servers.join(", ")}`);
  } catch (err) {
    console.warn(`Ignoring invalid DNS_SERVERS value: ${err.message}`);
  }

  dnsConfigured = true;
}

function isSrvDnsError(err) {
  return (
    err &&
    err.syscall === "querySrv" &&
    ["ECONNREFUSED", "ENOTFOUND", "ETIMEOUT"].includes(err.code)
  );
}

function getMongooseOptions() {
  const options = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 15000
  };

  if (process.env.DB_NAME) {
    options.dbName = process.env.DB_NAME;
  }

  return options;
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    configureDnsServers();

    cached.promise = (async () => {
      const mongoUri = process.env.MONGO_URI;
      if (!mongoUri) {
        throw new Error("MONGO_URI is not set");
      }

      const options = getMongooseOptions();

      try {
        return await mongoose.connect(mongoUri, options);
      } catch (err) {
        const directUri = process.env.MONGO_URI_DIRECT;
        if (directUri && mongoUri.startsWith("mongodb+srv://") && isSrvDnsError(err)) {
          console.warn(
            "MongoDB SRV DNS lookup failed. Retrying with MONGO_URI_DIRECT."
          );
          return mongoose.connect(directUri, options);
        }
        throw err;
      }
    })();
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
