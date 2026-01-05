import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { db } from "../config/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import Logger from "../utils/logger";

export function useZoneData() {
    const { user } = useAuth();
    const [zone, setZone] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            Logger.debug('useZoneData', 'No user, skipping fetch');
            setLoading(false);
            return;
        }

        Logger.debug('useZoneData', 'Fetching zone data for user', { uid: user.uid });

        const q = query(collection(db, "zones"), where("ownerUid", "==", user.uid));
        const unsub = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                // For now, assume 1 zone per owner
                const doc = snapshot.docs[0];
                Logger.info('useZoneData', 'Zone data found', { zoneId: doc.id });
                setZone({ id: doc.id, ...doc.data() });
            } else {
                Logger.debug('useZoneData', 'No zone found for user', { uid: user.uid });
                setZone(null);
            }
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    return { zone, loading };
}
