"use client";

import { useCallback, useEffect, useState } from "react";

import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";

interface AlertListResponse {
  readonly data: CityAlertDto[];
  readonly total: number;
}

export function useCityAlerts(initial: readonly CityAlertDto[]) {
  const [alerts, setAlerts] = useState<readonly CityAlertDto[]>(initial);
  const { socket, status } = useSocket();

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch<AlertListResponse>("/api/alerts?limit=40");
      setAlerts(response.data);
    } catch {
      // Keep the server-rendered snapshot visible when the network is unavailable.
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onAlertChanged = () => void refresh();
    socket.on(SOCKET_EVENTS.cityAlertUpdated, onAlertChanged);
    return () => {
      socket.off(SOCKET_EVENTS.cityAlertUpdated, onAlertChanged);
    };
  }, [socket, refresh]);

  useEffect(() => {
    if (status !== "polling") return;
    const interval = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(interval);
  }, [status, refresh]);

  return { alerts, refresh, setAlerts };
}
