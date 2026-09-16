import express from "express";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "EduAI Backend API is running",
  });
});

export default app;