import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, radius, spacing } from "@/src/theme";

type Datum = { label: string; value: number };

export function BarChart({ data, accent = colors.primary, height = 140 }: { data: Datum[]; accent?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[styles.chartWrap, { height: height + 28 }]}>
      <View style={[styles.bars, { height }]}>
        {data.map((d, i) => {
          const h = (d.value / max) * height;
          return (
            <View key={i} style={styles.barCol}>
              <View style={{ height: height - h }} />
              <View
                style={{
                  width: "70%",
                  height: Math.max(2, h),
                  backgroundColor: accent,
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                  opacity: d.value === 0 ? 0.25 : 1,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={styles.label}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function LineChart({ data, accent = colors.primary, height = 140 }: { data: Datum[]; accent?: string; height?: number }) {
  // simple bar-style "line" visual using stacked segments (no SVG dep)
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={[styles.chartWrap, { height: height + 28 }]}>
      <View style={[styles.bars, { height, alignItems: "flex-end" }]}>
        {data.map((d, i) => {
          const h = (d.value / max) * height;
          return (
            <View key={i} style={styles.barCol}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: accent,
                  marginBottom: Math.max(0, h - 10),
                  opacity: d.value === 0 ? 0.3 : 1,
                }}
              />
              <View
                style={{
                  width: 2,
                  height: Math.max(0, h - 10),
                  backgroundColor: accent + "55",
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={styles.label}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: { paddingVertical: spacing.sm },
  bars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  labelsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  label: { flex: 1, textAlign: "center", color: colors.textMuted, fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
});
