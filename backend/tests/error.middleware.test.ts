import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { AppError } from "../src/errors/app-error.js";
import { Prisma } from "../src/generated/prisma/client.js";

function createResponseMock() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };

  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);

  return res;
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the status and message for an AppError", () => {
    const error = new AppError(403, "Forbidden");
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Forbidden",
    });
  });

  it("should return 401 for an invalid JWT", () => {
    const error = new jwt.JsonWebTokenError("invalid token");
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Invalid or expired refresh token",
    });
  });

  it("should return 400 for a ZodError", () => {
    const error = new ZodError([]);
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Validation failed",
      errors: [],
    });
  });

  it("should return a generic 500 response for an unexpected error", () => {
    const error = new Error("sensitive internal detail");
    const res = createResponseMock();
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(consoleError).toHaveBeenCalledWith(error);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Internal server error",
    });
  });


  it("should return 409 for a Prisma unique constraint violation", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint violation",
      {
        code: "P2002",
        clientVersion: "7.10.0",
        meta: { target: ["email"] },
      },
    );
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "A resource with these details already exists",
    });
  });

  it("should return 409 for a Prisma foreign key constraint violation", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Foreign key constraint violation",
      {
        code: "P2003",
        clientVersion: "7.10.0",
        meta: { field_name: "tenantId" },
      },
    );
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "The operation conflicts with an existing resource",
    });
  });

  it("should return 404 for a Prisma record not found error", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Record not found",
      {
        code: "P2025",
        clientVersion: "7.10.0",
      },
    );
    const res = createResponseMock();

    errorHandler(
      error,
      {} as Request,
      res as unknown as Response,
      (() => {}) as NextFunction,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Resource not found",
    });
  });

});
