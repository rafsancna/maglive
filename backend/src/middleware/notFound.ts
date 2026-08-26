import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new AppError(404, "API_ROUTE_NOT_FOUND", "The requested API route does not exist."));
};
