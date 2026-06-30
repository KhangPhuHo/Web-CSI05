const cloudinary = require("cloudinary").v2;

console.log(">> CLOUDINARY CONFIG CHECK <<");
console.log("CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API_KEY:", process.env.CLOUDINARY_API_KEY);
console.log("SECRET_KEY:", process.env.CLOUDINARY_SECRET_KEY);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
});

module.exports = cloudinary;


