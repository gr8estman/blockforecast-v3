"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  CandlestickData,
  UTCTimestamp,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  PriceScaleMode,
  SeriesMarker,
  createSeriesMarkers,
} from "lightweight-charts";
import { useTradingStore } from "@/store/tradingStore";
import { subscribeToOHLC } from "@/lib/bitquery/websocket";
import { OHLCBar } from "@/types";
import { cn, formatPrice } from "@/lib/utils";
import { SectionHeader } from "@/components/ui";

const INTERVALS = [
  { label: "1m",  value: 60 },
  { label: "3m",  value: 180 },
  { label: "5m",  value: 300 },
  { label: "15m", value: 900 },
  { label: "1h",  value: 3600 },
  { label: "4h",  value: 14400 },
  { label: "1d",  value: 86400 },
];

// How many days of history to request per interval
const DAYS_MAP: Record<number, number> = {
  60: 1, 180: 1, 300: 2, 900: 3, 3600: 7, 14400: 30, 86400: 90,
};

interface CrosshairBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef   = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);
  const unsubRef     = useRef<(() => void) | null>(null);

  const { activeToken, bars, trades, setBars, upsertBar, interval, setInterval } = useTradingStore();
  const [loading, setLoading]     = useState(false);
  const [isLog, setIsLog]         = useState(false);
  const [isLive, setIsLive]       = useState(false);
  const [crosshair, setCrosshair] = useState<CrosshairBar | null>(null);

  // ─── Init Chart ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#050505" },
        textColor: "#555",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "#0f0f0f" },
        horzLines: { color: "#0f0f0f" },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "#333", style: 3 },
        horzLine: { color: "#333", style: 3 },
      },
      rightPriceScale: {
        borderColor: "#111",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#111",
        timeVisible: true,
        secondsVisible: false,
        barSpacing: 8,
        minBarSpacing: 2,
        rightOffset: 5,
      },
      handleScroll: true,
      handleScale: true,
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:         "#2dd4bf",
      downColor:       "#fb7185",
      borderUpColor:   "#2dd4bf",
      borderDownColor: "#fb7185",
      wickUpColor:     "#2dd4bf",
      wickDownColor:   "#fb7185",
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color: "#2dd4bf",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Crosshair → update OHLC info bar
    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const cd = param.seriesData.get(candleSeries) as CandlestickData | undefined;
        const vd = param.seriesData.get(volSeries) as { value: number } | undefined;
        if (cd && "open" in cd) {
          setCrosshair({ open: cd.open, high: cd.high, low: cd.low, close: cd.close, volume: vd?.value ?? 0 });
          return;
        }
      }
      setCrosshair(null);
    });

    chartRef.current     = chart;
    seriesRef.current    = candleSeries;
    volSeriesRef.current = volSeries;
    markersRef.current   = createSeriesMarkers(candleSeries, []) as ISeriesMarkersPluginApi<UTCTimestamp>;

    // Resize observer — reliably tracks container size in flex layouts
    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // ─── Keyboard: L → toggle log scale ─────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "l") setIsLog((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── Log / Linear Scale ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.priceScale("right").applyOptions({
      mode: isLog ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
    });
  }, [isLog]);

  // ─── Load Historical Bars ────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeToken) return;

    const load = async () => {
      setLoading(true);
      try {
        const days = DAYS_MAP[interval] ?? 1;
        const res = await fetch(`/api/chart/${activeToken}?interval=${interval}&days=${days}`);
        if (!res.ok) throw new Error("Failed to fetch chart data");
        const { bars: newBars }: { bars: OHLCBar[] } = await res.json();
        setBars(newBars);
      } catch (err) {
        console.error("Chart load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeToken, interval, setBars]);

  // ─── Sync Bars to Chart ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!seriesRef.current || !volSeriesRef.current || bars.length === 0) return;

    const candleData: CandlestickData[] = bars
      .filter((b) => b.open > 0 || b.close > 0)
      .map((b) => ({
        time:  Math.floor(b.time / 1000) as UTCTimestamp,
        open:  b.open,
        high:  b.high,
        low:   b.low,
        close: b.close,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    const volData = bars
      .filter((b) => b.volume > 0)
      .map((b) => ({
        time:  Math.floor(b.time / 1000) as UTCTimestamp,
        value: b.volume,
        color: b.close >= b.open ? "rgba(45,212,191,0.25)" : "rgba(251,113,133,0.25)",
      }));

    seriesRef.current.setData(candleData);
    volSeriesRef.current.setData(volData);
    chartRef.current?.timeScale().fitContent();       // fit all history into view
    chartRef.current?.timeScale().scrollToPosition(5, false); // add 5-bar right margin (tutorial pattern)
  }, [bars]);

  // ─── Trade Markers ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!markersRef.current) return;
    if (trades.length === 0) {
      markersRef.current.setMarkers([]);
      return;
    }
    const markers: SeriesMarker<UTCTimestamp>[] = trades
      .slice(0, 300)
      .map((t) => ({
        time:     Math.floor(new Date(t.timestamp).getTime() / 1000) as UTCTimestamp,
        position: (t.side === "buy" ? "belowBar" : "aboveBar") as "belowBar" | "aboveBar",
        color:    t.side === "buy" ? "#2dd4bf" : "#fb7185",
        shape:    "circle" as const,
        size:     Math.min(Math.max(0.4, Math.log10(Math.max(t.amountUsd || 5, 5))), 2),
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current.setMarkers(markers);
  }, [trades]);

  // ─── WebSocket: real-time candle updates ─────────────────────────────────────

  useEffect(() => {
    if (!activeToken) return;

    unsubRef.current?.();
    setIsLive(false);

    unsubRef.current = subscribeToOHLC(activeToken, interval, (bar) => {
      setIsLive(true);

      // Update the store (so other components see latest bar)
      upsertBar(bar);

      // Push update directly into the chart series — same pattern as the demo
      const barTime = Math.floor(bar.time / 1000) as UTCTimestamp;
      if (seriesRef.current && bar.open > 0 && bar.close > 0) {
        try {
          seriesRef.current.update({
            time:  barTime,
            open:  bar.open,
            high:  bar.high,
            low:   bar.low,
            close: bar.close,
          });
        } catch {
          // Bar time is older than last candle — skip (stale WebSocket message)
        }
      }

      if (volSeriesRef.current && bar.volume > 0) {
        try {
          volSeriesRef.current.update({
            time:  barTime,
            value: bar.volume,
            color: bar.close >= bar.open ? "rgba(45,212,191,0.25)" : "rgba(251,113,133,0.25)",
          });
        } catch { /* skip stale volume bar */ }
      }
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      setIsLive(false);
    };
  }, [activeToken, interval, upsertBar]);

  // ─── Derived display values ───────────────────────────────────────────────────

  const lastBar    = bars[bars.length - 1];
  const display    = crosshair ?? (lastBar
    ? { open: lastBar.open, high: lastBar.high, low: lastBar.low, close: lastBar.close, volume: lastBar.volume }
    : null);
  const changePct   = display && display.open > 0 ? ((display.close - display.open) / display.open) * 100 : 0;
  const changeColor = display ? (display.close >= display.open ? "#2dd4bf" : "#fb7185") : "#555";

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center h-7 px-2 border-b border-[#111] shrink-0 gap-1">
        {/* OHLC inline */}
        {display ? (
          <div className="flex items-center gap-2 text-[10px] font-mono mr-2">
            <span className="text-[#333]">O</span><span className="text-[#c9d1d9]">{formatPrice(display.open)}</span>
            <span className="text-[#333]">H</span><span className="text-[#2dd4bf]">{formatPrice(display.high)}</span>
            <span className="text-[#333]">L</span><span className="text-[#fb7185]">{formatPrice(display.low)}</span>
            <span className="text-[#333]">C</span><span className="text-[#c9d1d9]">{formatPrice(display.close)}</span>
            <span style={{ color: changeColor }} className="font-semibold">
              {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
            </span>
            {display.volume > 0 && (
              <span className="text-[#333]">V <span className="text-[#555]">${display.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
            )}
          </div>
        ) : <div className="flex-1" />}

        <div className="flex items-center gap-1 ml-auto">
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#2dd4bf] mr-1">
              <span className="w-1 h-1 rounded-full bg-[#2dd4bf] animate-pulse" />LIVE
            </span>
          )}
          <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()}
            className="px-1.5 h-5 text-[10px] font-mono text-[#333] hover:text-[#555] transition-colors">↻</button>
          <button onClick={() => setIsLog((v) => !v)}
            className={cn("px-1.5 h-5 rounded text-[10px] font-mono transition-all",
              isLog ? "bg-[#1a1a1a] text-[#2dd4bf]" : "text-[#333] hover:text-[#555]")}>
            log
          </button>
          {INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => setInterval(value)}
              className={cn("px-1.5 h-5 rounded text-[10px] font-mono transition-all",
                interval === value ? "bg-[#1a1a1a] text-[#c9d1d9]" : "text-[#333] hover:text-[#555]")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505]/80 z-10">
            <div className="flex items-center gap-2 text-xs text-[#333]">
              <span className="w-3 h-3 rounded-full border border-[#333] border-t-[#2dd4bf] animate-spin" />
              Loading…
            </div>
          </div>
        )}
        {!activeToken && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#222] text-sm">Select a token</p>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
