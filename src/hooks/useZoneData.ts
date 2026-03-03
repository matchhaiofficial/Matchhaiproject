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
        if (!user?._id) {
            setZone(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const q = query(collection(db, "zones"), where("ownerUid", "==", user._id));
        const unsub = onSnapshot(
            q,
            (snapshot: any) => {
                if (!snapshot.empty) {
                    const doc = snapshot.docs[0];
                    setZone({ id: doc.id, ...doc.data() });
                } else {
                    setZone(null);
                }
                setLoading(false);
            },
            (error: any) => {
                Logger.error('useZoneData', 'Zone listener failed', error);
                setZone(null);
                setLoading(false);
            },
        );

        return () => unsub();
    }, [user?._id]);

    return { zone, loading };
}
