import { useAuth } from "../context/AuthContext";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat";

export default function PresenceRuntimeBridge() {
  const { user, loading } = useAuth();
  usePresenceHeartbeat(Boolean(user?._id) && !loading);
  return null;
}
