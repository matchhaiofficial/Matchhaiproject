import { doc, getDoc } from "firebase/firestore";
import { db } from "./src/config/firebaseConfig";

async function inspectTeam(teamId) {
    console.log(`Inspecting team: ${teamId}`);
    try {
        const snap = await getDoc(doc(db, "teams", teamId));
        if (snap.exists()) {
            console.log("Data:", JSON.stringify(snap.data(), null, 2));
        } else {
            console.log("Team not found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

inspectTeam("Jtw4tNKOCQyEBc4Zmya6");
inspectTeam("1i8a9PhRcvYUanr98IlX");
