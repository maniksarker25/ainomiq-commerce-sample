"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type CallStatus =
  | "idle"
  | "connecting"
  | "ringing"
  | "in-progress"
  | "disconnected"
  | "error";

interface VoipTestProps {
  tenantId: string;
  twilioConnected: boolean;
  twilioNumber?: string;
}

export default function VoipTest({
  tenantId,
  twilioConnected,
  twilioNumber,
}: VoipTestProps) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const deviceRef = useRef<any>(null);
  const callRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    stopTimer();
    if (callRef.current) {
      try {
        callRef.current.disconnect();
      } catch {
        /* ignore */
      }
      callRef.current = null;
    }
    if (deviceRef.current) {
      try {
        deviceRef.current.destroy();
      } catch {
        /* ignore */
      }
      deviceRef.current = null;
    }
    setDeviceReady(false);
  }, [stopTimer]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const initDevice = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Dynamically import to avoid SSR issues
      const { Device } = await import("@twilio/voice-sdk");

      // Fetch access token
      const res = await fetch(
        `/api/cs/voip-token?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to get VoIP token");
      }

      // Destroy existing device
      if (deviceRef.current) {
        try {
          deviceRef.current.destroy();
        } catch {
          /* ignore */
        }
      }

      const device = new Device(data.token, {
        codecPreferences: ["opus", "pcmu"] as any,
        closeProtection: true,
        ...(data.region ? { edge: "dublin" } : {}),
      });

      device.on("registered", () => {
        setDeviceReady(true);
      });

      device.on("error", (err: any) => {
        console.error("[VoIP] Device error:", err);
        setError(err?.message || "Device error");
        setStatus("error");
      });

      await device.register();
      deviceRef.current = device;
      setDeviceReady(true);
    } catch (err: any) {
      console.error("[VoIP] Init error:", err);
      setError(err?.message || "Failed to initialize VoIP");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const startCall = useCallback(async () => {
    setError(null);
    setLoading(true);
    setStatus("connecting");

    try {
      // Step 0: Force mic permission prompt FIRST
      console.log("[VoIP] Step 0: Requesting microphone...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Got permission - stop the stream, Twilio will create its own
        stream.getTracks().forEach((t) => t.stop());
        console.log("[VoIP] Microphone access granted");
      } catch (micErr: any) {
        console.error("[VoIP] Mic error:", micErr);
        // Check the actual permission state
        if (navigator.permissions) {
          try {
            const perm = await navigator.permissions.query({
              name: "microphone" as PermissionName,
            });
            console.log("[VoIP] Permission state:", perm.state);
          } catch {
            /* ignore */
          }
        }
        throw new Error(
          micErr?.name === "NotAllowedError"
            ? "Microphone blocked. Click the lock icon in your address bar → allow microphone → try again."
            : micErr?.name === "NotFoundError"
              ? "No microphone found. Connect a microphone and try again."
              : `Microphone error: ${micErr?.message || micErr?.name || "Unknown"}`,
        );
      }

      // Step 1: Initialize device if not ready
      if (!deviceRef.current) {
        console.log("[VoIP] Step 1: Fetching token...");
        const res = await fetch(
          `/api/cs/voip-token?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
        );
        const data = await res.json();
        console.log("[VoIP] Token response:", res.status, data.error || "OK");

        if (!res.ok || data.error) {
          throw new Error(`Token error: ${data.error || res.statusText}`);
        }

        console.log("[VoIP] Step 2: Creating Device...");
        const { Device } = await import("@twilio/voice-sdk");

        if (deviceRef.current) {
          try {
            deviceRef.current.destroy();
          } catch {
            /* ignore */
          }
        }

        const device = new Device(data.token, {
          codecPreferences: ["opus", "pcmu"] as any,
          closeProtection: true,
          edge: "dublin",
        });

        device.on("registered", () => {
          console.log("[VoIP] Device registered");
          setDeviceReady(true);
        });

        device.on("error", (err: any) => {
          console.error("[VoIP] Device error:", err?.code, err?.message);
          setError(
            `Device error (${err?.code || "?"}): ${err?.message || "Unknown"}`,
          );
          setStatus("error");
        });

        console.log("[VoIP] Step 3: Registering device...");
        await device.register();
        deviceRef.current = device;
        console.log("[VoIP] Device ready");
      }

      // Step 2: Connect the call
      console.log(
        "[VoIP] Step 4: Connecting call to",
        twilioNumber || "(default)",
      );
      const call = await deviceRef.current.connect({
        params: {
          To: twilioNumber || "",
        },
      });

      callRef.current = call;

      call.on("ringing", () => {
        console.log("[VoIP] Call ringing");
        setStatus("ringing");
      });

      call.on("accept", () => {
        console.log("[VoIP] Call accepted");
        setStatus("in-progress");
        startTimer();
      });

      call.on("disconnect", () => {
        console.log("[VoIP] Call disconnected");
        setStatus("disconnected");
        stopTimer();
        callRef.current = null;
      });

      call.on("cancel", () => {
        console.log("[VoIP] Call cancelled");
        setStatus("idle");
        stopTimer();
        callRef.current = null;
      });

      call.on("error", (err: any) => {
        console.error("[VoIP] Call error:", err?.code, err?.message);
        setError(
          `Call error (${err?.code || "?"}): ${err?.message || "Unknown"}`,
        );
        setStatus("error");
        stopTimer();
        callRef.current = null;
      });
    } catch (err: any) {
      console.error("[VoIP] Error:", err);
      setError(err?.message || "Failed to start call");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }, [initDevice, twilioNumber, startTimer, stopTimer, tenantId]);

  const endCall = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.disconnect();
      } catch {
        /* ignore */
      }
      callRef.current = null;
    }
    setStatus("disconnected");
    stopTimer();
  }, [stopTimer]);

  const resetCall = useCallback(() => {
    cleanup();
    setStatus("idle");
    setDuration(0);
    setError(null);
  }, [cleanup]);

  const formatDuration = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${String(sec).padStart(2, "0")}`;
  };

  const statusColor: Record<CallStatus, string> = {
    idle: "#6b7280",
    connecting: "#ca8a04",
    ringing: "#ca8a04",
    "in-progress": "#16a34a",
    disconnected: "#6b7280",
    error: "#dc2626",
  };

  const statusLabel: Record<CallStatus, string> = {
    idle: "Ready",
    connecting: "Connecting...",
    ringing: "Ringing...",
    "in-progress": "In call",
    disconnected: "Call ended",
    error: "Error",
  };

  if (!twilioConnected) return null;

  return (
    <div
      className="glass rounded-2xl"
      style={{ padding: "20px", marginBottom: "16px" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h4
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "#1a1a2e",
              margin: 0,
            }}
          >
            <span style={{ marginRight: "8px" }}>🎧</span>
            VoIP Test Call
          </h4>
          <p
            style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0 0 0" }}
          >
            Test your AI voice agent directly from your browser
          </p>
        </div>
        {status !== "idle" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: `${statusColor[status]}15`,
              border: `1px solid ${statusColor[status]}30`,
            }}
          >
            {status === "in-progress" && (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#16a34a",
                  animation: "pulse 1.5s infinite",
                }}
              />
            )}
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: statusColor[status],
              }}
            >
              {statusLabel[status]}
            </span>
            {status === "in-progress" && (
              <span
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {formatDuration(duration)}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            marginBottom: "12px",
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.15)",
            fontSize: "13px",
            color: "#dc2626",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {status === "idle" ||
        status === "disconnected" ||
        status === "error" ? (
          <>
            <button
              onClick={startCall}
              disabled={loading}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 20px",
                fontSize: "13px",
                background: loading ? "#9ca3af" : "#16a34a",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
              </svg>
              {loading
                ? "Initializing..."
                : status === "disconnected"
                  ? "Call again"
                  : "Start test call"}
            </button>
            {status === "disconnected" && (
              <button
                onClick={resetCall}
                style={{
                  padding: "10px 16px",
                  fontSize: "13px",
                  borderRadius: "10px",
                  border: "1px solid #e2e6ef",
                  background: "white",
                  color: "#6b7280",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            )}
          </>
        ) : (
          <button
            onClick={endCall}
            className="btn-primary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 20px",
              fontSize: "13px",
              background: "#dc2626",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.42 8.67 7.53 7 12 7s8.58 1.67 11.71 4.72c.18.18.29.44.29.72 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 00-2.67-1.85.996.996 0 01-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
            End call
          </button>
        )}

        {twilioNumber && (
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>
            Calling {twilioNumber}
          </span>
        )}
      </div>

      {status === "in-progress" && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px 16px",
            borderRadius: "12px",
            background: "rgba(22, 163, 74, 0.06)",
            border: "1px solid rgba(22, 163, 74, 0.12)",
            fontSize: "13px",
            color: "#15803d",
            lineHeight: 1.5,
          }}
        >
          💡 Speak naturally - the AI agent will respond through your
          speakers/headphones. Try asking about an order status, returns policy,
          or shipping.
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
