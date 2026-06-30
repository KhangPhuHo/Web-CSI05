import { parsePhoneNumberFromString } from 'https://cdn.skypack.dev/libphonenumber-js';

export function validatePhoneInternational(phone) {
  const phoneNumber = parsePhoneNumberFromString(phone);
  return phoneNumber && phoneNumber.isValid();
}

export function formatPhoneInternational(phone) {
  const phoneNumber = parsePhoneNumberFromString(phone);
  return phoneNumber ? phoneNumber.formatInternational() : phone;
}
