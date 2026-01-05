import fs from "fs";
import http from "http";
import path from "path";
import handler from "../api/psn-verify";

// 1. Load .env manually
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    envConfig.split("\n").forEach((line) => {
        const [key, val] = line.split("=");
        if (key && val) {
            process.env[key.trim()] = val.trim();
        }
    });
}

// 2. Mock Vercel Request/Response
const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    // Body Parsing
    const buffers: any[] = [];
    for await (const chunk of req) {
        buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString();

    (req as any).body = rawBody ? JSON.parse(rawBody) : {};

    // Polyfills
    (res as any).status = (code: number) => {
        res.statusCode = code;
        return res;
    };
    (res as any).json = (data: any) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
        return res;
    };

    try {
        // Call Handler
        await handler(req as any, res as any);
    } catch (e) {
        console.error("Local Server Handler Error:", e);
        if (!res.writableEnded) {
            res.statusCode = 500;
            res.end(JSON.stringify({
                error: "Internal Server Error",
                details: e instanceof Error ? e.message : String(e),
                stack: e instanceof Error ? e.stack : null
            }));
        }
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Local PSN Service running at http://localhost:${PORT}`);
});
