import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

function ChartView({ data, orders }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef();
  const seriesRef = useRef();
  const priceLinesRef = useRef([]); // 👈 lưu lại các line đã tạo

  useEffect(() => {
    chartRef.current = createChart(chartContainerRef.current, {
      width: 900,
      height: 400,
    });

    seriesRef.current = chartRef.current.addCandlestickSeries();
    seriesRef.current.setData(data);

    return () => chartRef.current.remove();
  }, []);

  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  useEffect(() => {
    if (!seriesRef.current || !orders) return;

    // ❌ Clear all existing lines manually
    priceLinesRef.current.forEach(line => {
      try {
        seriesRef.current.removePriceLine(line);
      } catch (e) {
        console.warn("Failed to remove price line", e);
      }
    });
    priceLinesRef.current = [];

    // ✅ Recreate new lines
    orders.filter(o => !o.isClosed).forEach((o, index) => {
      const entryLine = seriesRef.current.createPriceLine({
        price: o.price,
        color: o.type === "buy" ? "green" : "red",
        lineStyle: 0,
        lineWidth: 2,
        title: `${o.type.toUpperCase()} #${index + 1}`,
        axisLabelVisible: true
      });
      priceLinesRef.current.push(entryLine);

      if (o.sl) {
        const slLine = seriesRef.current.createPriceLine({
          price: o.sl,
          color: "orange",
          lineStyle: 1,
          lineWidth: 1,
          title: "SL",
          axisLabelVisible: true
        });
        priceLinesRef.current.push(slLine);
      }

      if (o.tp) {
        const tpLine = seriesRef.current.createPriceLine({
          price: o.tp,
          color: "blue",
          lineStyle: 1,
          lineWidth: 1,
          title: "TP",
          axisLabelVisible: true
        });
        priceLinesRef.current.push(tpLine);
      }
    });
  }, [orders, data]);

  return <div ref={chartContainerRef} />;
}

export default ChartView;
