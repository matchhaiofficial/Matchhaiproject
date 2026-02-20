import { useEffect, useState } from "react";

import { useAuth } from "../context/AuthContext";
import { subscribeDocs } from "../services/firestoreService";
import Logger from "../utils/logger";

export function useZoneData() {
    const { user } = useAuth();
    const [zone, setZone] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) {
            setZone(null);
            setLoading(false);
            return;
        }

        setLoading(true);

        const unsub = subscribeDocs(
            {
                collectionPath: ["zones"],
                where: [{ field: "ownerUid", op: "==", value: user.uid }],
            },
            (docs) => {
                if (docs.length > 0) {
                    const doc = docs[0];
                    setZone({ id: doc.id, ...doc.data });
                } else {
                    setZone(null);
                }
                setLoading(false);
            },
            (error) => {
                Logger.error('useZoneData', 'Zone listener failed', error);
                setZone(null);
                setLoading(false);
            },
        );

        return () => unsub();
    }, [user?.uid]);

    return { zone, loading };
}

