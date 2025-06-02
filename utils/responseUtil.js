import { MessageEnum } from "../config/message.js";


function formatErrorMessage(errorEnum, data = {}, locale = 'en') {
  const errorMessage = errorEnum?.[locale] || errorEnum?.['en'] || 'Error';

  console.log(errorMessage)

  // Format message with data
  return Object.keys(data).reduce((formattedMessage, key) => {
    const placeholder = `{${key}}`;
    return formattedMessage.replace(placeholder, data[key]);
  }, errorMessage);
}

function createSuccessResponse(res, statusCode, success, messageEnum, data = {}, locale = 'en') {
  const message = formatErrorMessage(messageEnum, data, locale);
  res.status(statusCode).json({
    success,
    message,
    status: statusCode,
    data
  });
}

function createErrorResponse(res, statusCode, messageEnum, data={},locale = 'en') {
  const message = formatErrorMessage(messageEnum, data, locale);
  res.status(statusCode).json({
    success: false,
    message,
    status: statusCode,
    // error: message
  });
}

export {
  createSuccessResponse,
  createErrorResponse,
  formatErrorMessage
};
