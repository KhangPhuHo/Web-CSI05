const cloudinary = require("cloudinary").v2;

console.log(">> CLOUDINARY CONFIG CHECK <<");
console.log("Everything is working fine, Cloudinary is configured successfully.");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
});

module.exports = cloudinary;


