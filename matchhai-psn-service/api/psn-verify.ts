import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyPsnForTekkenAndFc } from "../src/psnVerify";
import { PsnVerifyRequest } from "../src/types";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.status(200).end();
        return;
    }

    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const body = req.body as PsnVerifyRequest;

        if (!body?.psnOnlineId || typeof body.psnOnlineId !== "string") {
            res.status(400).json({ error: "psnOnlineId is required" });
            return;
        }

        const result = await verifyPsnForTekkenAndFc({
            psnOnlineId: body.psnOnlineId.trim(),
            wantsTekken: body.wantsTekken,
            wantsFc: body.wantsFc
        });

        res.status(200).json({ status: "ok", psn: result });
    } catch (err: any) {
        console.error("PSN verify error", err);

        // Check for specific error types if needed
        const message = err?.message ?? "Unexpected PSN verification error";
        const statusCode = message.includes("not found") ? 404 : 500;

        res.status(statusCode).json({
            status: "error",
            message: message
        });
    }
}
