import React from "react";

import ZoneModuleScreen from "../../../src/features/zoneAdmin/components/ZoneModuleScreen";

export default function ZoneSupportModule() {
    return (
        <ZoneModuleScreen
            title="Support & Safety"
            subtitle="Handle complaints, safety actions, and ticket workflows in one pipeline."
            blocks={[
                {
                    title: "Complaint Pipeline",
                    points: [
                        "Complaint to ticket conversion with linked matchroom context",
                        "Resolution actions: warn, temporary ban, permanent ban",
                        "Internal notes and standardized closure codes",
                    ],
                },
                {
                    title: "Safety Controls",
                    points: [
                        "Ban history with reason, duration, and appeal metadata",
                        "Optional restrictions for chat and booking cooldowns",
                        "Maintenance issues can be converted into resource tickets",
                    ],
                },
            ]}
            footerHint="Keep actions auditable to support dispute handling and policy enforcement."
        />
    );
}

