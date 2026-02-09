import React from "react";

import ZoneModuleScreen from "../../../src/features/zoneAdmin/components/ZoneModuleScreen";

export default function ZoneAuditModule() {
    return (
        <ZoneModuleScreen
            title="Audit & Security"
            subtitle="Track critical admin actions and monitor suspicious patterns."
            blocks={[
                {
                    title: "Audit Trail",
                    points: [
                        "Record action type, actor, timestamp, and entity context",
                        "Coverage for booking decisions and lifecycle overrides",
                        "Support internal review and accountability",
                    ],
                },
                {
                    title: "Security Monitoring",
                    points: [
                        "Flag repeated request spam and failed auth behavior",
                        "Surface repeated complaints and booking anomalies",
                        "Export-ready log structure for compliance needs",
                    ],
                },
            ]}
        />
    );
}

