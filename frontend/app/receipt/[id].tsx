import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api.getPayment(id!).then(setData).catch(console.warn);
  }, [id]);

  if (!data) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const fmt = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");
  const paidAt = new Date(data.paid_at);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RECEIPT</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={32} color={colors.success} />
          </View>
          <Text style={styles.paid}>PAYMENT RECEIVED</Text>
          <Text style={styles.amount}>{fmt(data.amount)}</Text>

          <View style={styles.divider} />

          <Row k="RECEIPT NO" v={data.receipt_no} />
          <Row k="MEMBER" v={data.member_name} />
          <Row k="PLAN" v={(data.plan || "").toUpperCase()} />
          <Row k="METHOD" v={(data.method || "cash").toUpperCase()} />
          <Row k="PAID ON" v={paidAt.toLocaleString()} />
          <Row k="PERIOD" v={`${data.period_start} → ${data.period_end}`} />

          <View style={styles.divider} />

          <View style={styles.footer}>
            <Text style={styles.brand}>GYMFLOW</Text>
            <Text style={styles.tagline}>Digital Receipt · Thank you</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: "center" },
  badge: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  paid: { color: colors.success, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  amount: { color: "#fff", fontSize: 44, fontWeight: "900", marginTop: 6 },
  divider: { height: 1, alignSelf: "stretch", backgroundColor: colors.border, marginVertical: spacing.lg },
  row: { flexDirection: "row", justifyContent: "space-between", alignSelf: "stretch", paddingVertical: 6 },
  k: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  v: { color: "#fff", fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  footer: { alignItems: "center", marginTop: spacing.sm },
  brand: { color: colors.primary, fontSize: 18, fontWeight: "900", letterSpacing: 3 },
  tagline: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
