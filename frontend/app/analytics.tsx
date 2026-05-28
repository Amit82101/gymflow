import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { BarChart, LineChart } from "@/src/components/charts";
import { Card } from "@/src/components/ui";

export default function Analytics() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [growth, setGrowth] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, r, a, g] = await Promise.all([
      api.dashboardStats(),
      api.revenueAnalytics(6),
      api.attendanceAnalytics(7),
      api.memberGrowth(6),
    ]);
    setStats(s);
    setRevenue(r);
    setAttendance(a);
    setGrowth(g);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]));

  const fmt = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const totalRev = revenue.reduce((s, x) => s + x.value, 0);
  const totalAtt = attendance.reduce((s, x) => s + x.value, 0);
  const active = stats?.active_members ?? 0;
  const inactive = Math.max(0, (stats?.total_members ?? 0) - active);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>ANALYTICS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.primary} />}
      >
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>REVENUE · LAST 6 MONTHS</Text>
          <Text style={styles.cardValue}>{fmt(totalRev)}</Text>
          <View style={{ marginTop: spacing.md }}>
            <BarChart data={revenue} accent={colors.primary} height={140} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>ATTENDANCE · LAST 7 DAYS</Text>
          <Text style={styles.cardValue}>{totalAtt} <Text style={{ fontSize: 14, color: colors.textSecondary }}>check-ins</Text></Text>
          <View style={{ marginTop: spacing.md }}>
            <LineChart data={attendance} accent={colors.success} height={140} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>PEAK HOURS · LAST 7 DAYS</Text>
          <Text style={styles.cardValue}>
            {(() => {
              const top = [...peakHours].sort((a, b) => b.value - a.value)[0];
              return top && top.value > 0 ? `${top.label}:00` : "—";
            })()}{" "}
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>busiest hour</Text>
          </Text>
          <View style={{ marginTop: spacing.md }}>
            <BarChart data={peakHours.filter((_, i) => i >= 5 && i <= 22)} accent={colors.warning} height={120} />
          </View>
        </Card>

        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={styles.cardLabel}>MEMBER GROWTH</Text>
          <Text style={styles.cardValue}>{stats?.total_members ?? 0} <Text style={{ fontSize: 14, color: colors.textSecondary }}>total</Text></Text>
          <View style={{ marginTop: spacing.md }}>
            <BarChart data={growth} accent={colors.info} height={140} />
          </View>
        </Card>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[styles.miniCard, { borderColor: colors.success + "33" }]}>
            <Text style={[styles.miniVal, { color: colors.success }]}>{active}</Text>
            <Text style={styles.miniLbl}>ACTIVE</Text>
          </View>
          <View style={[styles.miniCard, { borderColor: colors.textMuted + "33" }]}>
            <Text style={[styles.miniVal, { color: colors.textSecondary }]}>{inactive}</Text>
            <Text style={styles.miniLbl}>INACTIVE</Text>
          </View>
          <View style={[styles.miniCard, { borderColor: colors.warning + "33" }]}>
            <Text style={[styles.miniVal, { color: colors.warning }]}>{stats?.expiring_soon ?? 0}</Text>
            <Text style={styles.miniLbl}>EXPIRING</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  cardLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  cardValue: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 4 },
  miniCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, alignItems: "center" },
  miniVal: { fontSize: 28, fontWeight: "900" },
  miniLbl: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },
});
