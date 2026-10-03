const API_URL = "http://localhost:5000/api/auth/refresh";

const refreshToken = process.argv[2];

if (!refreshToken) {
  console.error("Usage: node test-refresh-concurrency.mjs <REFRESH_TOKEN>");
  process.exit(1);
}

async function sendRefresh(label) {
  const start = performance.now();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    return {
      request: label,
      status: response.status,
      success: data.success,
      message: data.message ?? "Refresh réussi",
      durationMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      request: label,
      error: error.message,
    };
  }
}

const results = await Promise.all([
  sendRefresh("A"),
  sendRefresh("B"),
]);

console.table(results);