import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { EmptyState, StatusBadge } from "@/src/components/ui";

const PLANS: Record<string, { label: string; default: number }> = {
  monthly: { label: "MONTHLY · 30 days", default: 1500 },
  quarterly: { label: "QUARTERLY · 90 days", default: 4000 },
  yearly: { label: "YEARLY · 365 days", default: 14000 },
};

export default function Fees() {
  const router = useRouter();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pending, setPending] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<any | null>(null);
  const [planChoice, setPlanChoice] = useState<string>("monthly");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, h] = await Promise.all([api.pendingFees(), api.listPayments()]);
      setPending(p);
      setHistory(h);
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

  const openCollect = (member: any) => {
    setPicking(member);
    setPlanChoice(member.plan || "monthly");
    setAmount(String(member.fee_amount || PLANS[member.plan || "monthly"].default));
  };

  const submit = async () => {
    if (!picking) return;
    setBusy(true);
    try {
      const p = await api.createPayment({
        member_id: picking.id,
        amount: parseFloat(amount) || 0,
        plan: planChoice,
      });
      setPicking(null);
      await load();
      Alert.alert("Payment Recorded", `Receipt: ${p.receipt_no}`, [
        { text: "View", onPress: () => router.push(`/receipt/${p.id}`) },
        { text: "OK" },
      ]);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const totalRevenue = history.reduce((s, p) => s + (p.amount || 0), 0);
  const fmt = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>FEES</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summary, { borderColor: colors.warning + "33" }]}>
          <Text style={styles.sumLbl}>PENDING</Text>
          <Text style={[styles.sumVal, { color: colors.warning }]} testID="pending-count">{pending.length}</Text>
        </View>
        <View style={[styles.summary, { borderColor: colors.success + "33" }]}>
          <Text style={styles.sumLbl}>COLLECTED</Text>
          <Text style={[styles.sumVal, { color: colors.success }]} testID="collected-total">{fmt(totalRevenue)}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        {(["pending", "history"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : tab === "pending" ? (
        <FlatList
          data={pending}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardMeta}>{item.phone}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  <StatusBadge status={item.days_overdue > 0 ? "expired" : "pending"} />
                  <Text style={styles.cardDays}>
                    {item.days_overdue > 0
                      ? `${item.days_overdue}d overdue`
                      : item.days_left >= 0
                      ? `${item.days_left}d left`
                      : ""}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                testID={`collect-${item.id}`}
                style={styles.collectBtn}
                onPress={() => openCollect(item)}
              >
                <Ionicons name="cash" size={14} color="#fff" />
                <Text style={styles.collectText}>COLLECT</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />}
              title="No pending fees"
              subtitle="All members are up to date"
            />
          }
        />
      ) : (
        <FlatList
          data={history}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`receipt-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/receipt/${item.id}`)}
            >
              <View style={[styles.recIcon, { backgroundColor: colors.success + "1A" }]}>
                <Ionicons name="receipt" size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.member_name}</Text>
                <Text style={styles.cardMeta}>
                  {item.receipt_no} · {new Date(item.paid_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.amount}>{fmt(item.amount)}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<EmptyState icon={<Ionicons name="receipt-outline" size={48} color={colors.textMuted} />} title="No payments yet" />}
        />
      )}

      {/* Collect modal */}
      <Modal visible={!!picking} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>COLLECT FEE</Text>
            <Text style={styles.modalSub}>{picking?.name}</Text>

            <Text style={styles.label}>PLAN</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              {Object.entries(PLANS).map(([k, v]) => (
                <TouchableOpacity
                  key={k}
                  testID={`plan-${k}`}
                  style={[styles.planChip, planChoice === k && styles.planChipActive]}
                  onPress={() => {
                    setPlanChoice(k);
                    setAmount(String(v.default));
                  }}
                >
                  <Text style={[styles.planText, planChoice === k && styles.planTextActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>AMOUNT</Text>
            <TextInput
              testID="fee-amount-input"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: spacing.xl }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPicking(null)}>
                <Text style={styles.cancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="confirm-pay"
                style={styles.confirmBtn}
                onPress={submit}
                disabled={busy}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>MARK PAID</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg },
  title: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 2 },
  summaryRow: { flexDirection: "row", gap: 12, paddingHorizontal: spacing.lg, marginBottom: spacing.lg },
  summary: { flex: 1, padding: spacing.lg, borderWidth: 1, borderRadius: radius.lg, backgroundColor: colors.surface },
  sumLbl: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  sumVal: { fontSize: 26, fontWeight: "900", marginTop: 4 },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabTextActive: { color: "#fff" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cardDays: { color: colors.textMuted, fontSize: 11, alignSelf: "center" },
  collectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  collectText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  amount: { color: "#fff", fontSize: 15, fontWeight: "900" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: "center", marginBottom: spacing.md },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1.5 },
  modalSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: spacing.lg },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 8 },
  planChip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planText: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  planTextActive: { color: "#fff" },
  amountInput: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 56,
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
  },
  cancelBtn: { flex: 1, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.textSecondary, fontWeight: "800", letterSpacing: 1, fontSize: 12 },
  confirmBtn: { flex: 2, height: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  confirmText: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
});
