import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing } from "@/src/theme";
import { Card, SectionHeader } from "@/src/components/ui";
import { BarChart, LineChart } from "@/src/components/charts";

export default function Dashboard() {
  const { admin, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r, a] = await Promise.all([
        api.dashboardStats(),
        api.revenueAnalytics(6),
        api.attendanceAnalytics(7),
      ]);
      setStats(s);
      setRevenue(r);
      setAttendance(a);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const fmtMoney = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello,</Text>
            <Text testID="admin-name" style={styles.adminName}>{(admin?.name || "Admin").toUpperCase()}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              testID="analytics-btn"
              style={styles.iconBtn}
              onPress={() => router.push("/analytics")}
            >
              <Ionicons name="bar-chart" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity testID="logout-btn" style={styles.iconBtn} onPress={signOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {loading && !stats ? (
          <View style={{ padding: 60, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Bento stats */}
            <View style={styles.bento}>
              <StatBlock
                testID="stat-active-members"
                icon="people"
                label="ACTIVE MEMBERS"
                value={stats?.active_members ?? 0}
                accent={colors.primary}
              />
              <StatBlock
                testID="stat-today-attendance"
                icon="checkmark-done"
                label="TODAY CHECK-INS"
                value={stats?.today_attendance ?? 0}
                accent={colors.success}
              />
              <StatBlock
                testID="stat-pending-fees"
                icon="alert-circle"
                label="PENDING FEES"
                value={stats?.pending_fees ?? 0}
                accent={colors.warning}
              />
              <StatBlock
                testID="stat-expiring"
                icon="time"
                label="EXPIRING SOON"
                value={stats?.expiring_soon ?? 0}
                accent={colors.info}
              />
            </View>

            {/* Revenue hero card */}
            <View style={styles.revenueCard}>
              <Text style={styles.revLabel}>MONTHLY REVENUE</Text>
              <Text testID="monthly-revenue" style={styles.revValue}>
                {fmtMoney(stats?.monthly_revenue || 0)}
              </Text>
              <Text style={styles.revSub}>
                {stats?.total_members || 0} total members
              </Text>
              <View style={{ marginTop: spacing.lg }}>
                <BarChart data={revenue} accent="#fff" height={90} />
              </View>
            </View>

            <SectionHeader title="Quick Actions" />
            <View style={styles.qaRow}>
              <QuickAction
                testID="qa-add-member"
                icon="person-add"
                label="ADD MEMBER"
                color={colors.primary}
                onPress={() => router.push("/member/new")}
              />
              <QuickAction
                testID="qa-checkin"
                icon="scan"
                label="CHECK-IN"
                color={colors.success}
                onPress={() => router.push("/(tabs)/attendance")}
              />
              <QuickAction
                testID="qa-fees"
                icon="cash"
                label="COLLECT FEE"
                color={colors.warning}
                onPress={() => router.push("/(tabs)/fees")}
              />
            </View>

            <SectionHeader title="Attendance · Last 7 days" />
            <Card>
              <LineChart data={attendance} accent={colors.primary} height={130} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBlock({
  icon,
  label,
  value,
  accent,
  testID,
}: {
  icon: any;
  label: string;
  value: number | string;
  accent: string;
  testID?: string;
}) {
  return (
    <View style={styles.statBlock} testID={testID}>
      <View style={[styles.statIcon, { backgroundColor: accent + "1A", borderColor: accent + "33" }]}>
        <Ionicons name={icon} size={16} color={accent} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  color,
  onPress,
  testID,
}: {
  icon: any;
  label: string;
  color: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity testID={testID} style={styles.qa} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.qaIcon, { backgroundColor: color + "1A", borderColor: color + "33" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  hello: { color: colors.textSecondary, fontSize: 13 },
  adminName: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 1.5, marginTop: 2 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bento: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  statBlock: {
    width: "47.5%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  statValue: { color: "#fff", fontSize: 28, fontWeight: "900" },
  statLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 1.2, marginTop: 2 },
  revenueCard: {
    margin: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: "hidden",
  },
  revLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  revValue: { color: "#fff", fontSize: 36, fontWeight: "900", marginTop: 4 },
  revSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2 },
  qaRow: { flexDirection: "row", gap: 10, paddingHorizontal: spacing.lg },
  qa: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  qaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginBottom: 8,
  },
  qaLabel: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
});

// reuse shared SectionHeader wrapper with consistent padding
const _SectionWrap = ({ children }: any) => <View style={{ paddingHorizontal: spacing.lg }}>{children}</View>;
