import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { StatusBadge } from "@/src/components/ui";

const PLANS = ["monthly", "quarterly", "yearly"];

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [edit, setEdit] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [payments, setPayments] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const m = await api.getMember(id!);
      // Apply status from list
      const list = await api.listMembers();
      const enriched = list.find((x: any) => x.id === id) || m;
      setMember(enriched);
      setEdit({
        name: enriched.name,
        phone: enriched.phone,
        email: enriched.email || "",
        plan: enriched.plan,
        fee_amount: String(enriched.fee_amount || 0),
        height_cm: enriched.height_cm ? String(enriched.height_cm) : "",
        weight_kg: enriched.weight_kg ? String(enriched.weight_kg) : "",
        notes: enriched.notes || "",
      });
      const pay = await api.listPayments(id);
      setPayments(pay);
    } catch (e) {
      console.warn(e);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const save = async () => {
    setBusy(true);
    try {
      const payload: any = {
        name: edit.name,
        phone: edit.phone,
        email: edit.email || null,
        plan: edit.plan,
        fee_amount: parseFloat(edit.fee_amount) || 0,
        notes: edit.notes || null,
      };
      if (edit.height_cm) payload.height_cm = parseFloat(edit.height_cm);
      if (edit.weight_kg) payload.weight_kg = parseFloat(edit.weight_kg);
      await api.updateMember(id!, payload);
      setEditMode(false);
      await load();
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    Alert.alert("Delete Member?", `Permanently remove ${member?.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteMember(id!);
            router.back();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          }
        },
      },
    ]);
  };

  if (loading || !member) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const initial = (member.name?.[0] || "?").toUpperCase();
  const fmt = (v: number) => "₹" + (v || 0).toLocaleString("en-IN");

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>MEMBER</Text>
          {!editMode ? (
            <TouchableOpacity onPress={() => setEditMode(true)} style={styles.iconBtn} testID="edit-btn">
              <Ionicons name="create-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => { setEditMode(false); load(); }} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={styles.profile}>
            <View style={styles.bigAvatar}>
              {member.photo ? (
                <Image source={{ uri: member.photo }} style={styles.bigAvatarImg} />
              ) : (
                <Text style={styles.bigInitial}>{initial}</Text>
              )}
            </View>
            <Text style={styles.name}>{member.name}</Text>
            <Text style={styles.phone}>{member.phone}</Text>
            <View style={{ marginTop: 8 }}>
              <StatusBadge status={member.status || "active"} />
            </View>
          </View>

          {!editMode ? (
            <>
              <View style={styles.statGrid}>
                <InfoTile label="PLAN" value={(member.plan || "—").toUpperCase()} />
                <InfoTile label="FEE" value={fmt(member.fee_amount)} />
                <InfoTile label="JOINED" value={member.join_date || "—"} />
                <InfoTile label="EXPIRES" value={member.expiry_date || "—"} />
                <InfoTile label="BMI" value={member.bmi ? String(member.bmi) : "—"} />
                <InfoTile label="WEIGHT" value={member.weight_kg ? `${member.weight_kg} kg` : "—"} />
              </View>

              {member.notes && (
                <View style={styles.notesCard}>
                  <Text style={styles.label}>NOTES</Text>
                  <Text style={styles.notesText}>{member.notes}</Text>
                </View>
              )}

              <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>PAYMENT HISTORY</Text>
              {payments.length === 0 ? (
                <Text style={styles.empty}>No payments recorded</Text>
              ) : (
                payments.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={styles.payRow}
                    onPress={() => router.push(`/receipt/${p.id}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.payAmount}>{fmt(p.amount)}</Text>
                      <Text style={styles.payMeta}>
                        {p.receipt_no} · {new Date(p.paid_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity testID="delete-btn" onPress={remove} style={styles.dangerBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={styles.dangerText}>DELETE MEMBER</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <EditField label="NAME" value={edit.name} onChangeText={(v: string) => setEdit({ ...edit, name: v })} />
              <EditField label="PHONE" value={edit.phone} onChangeText={(v: string) => setEdit({ ...edit, phone: v })} keyboardType="phone-pad" />
              <EditField label="EMAIL" value={edit.email} onChangeText={(v: string) => setEdit({ ...edit, email: v })} autoCapitalize="none" keyboardType="email-address" />
              <Text style={styles.label}>PLAN</Text>
              <View style={styles.planRow}>
                {PLANS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.planChip, edit.plan === p && styles.planChipActive]}
                    onPress={() => setEdit({ ...edit, plan: p })}
                  >
                    <Text style={[styles.planText, edit.plan === p && { color: "#fff" }]}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <EditField label="FEE (₹)" value={edit.fee_amount} onChangeText={(v: string) => setEdit({ ...edit, fee_amount: v })} keyboardType="numeric" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <EditField label="HEIGHT (cm)" value={edit.height_cm} onChangeText={(v: string) => setEdit({ ...edit, height_cm: v })} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1 }}>
                  <EditField label="WEIGHT (kg)" value={edit.weight_kg} onChangeText={(v: string) => setEdit({ ...edit, weight_kg: v })} keyboardType="numeric" />
                </View>
              </View>
              <EditField label="NOTES" value={edit.notes} onChangeText={(v: string) => setEdit({ ...edit, notes: v })} multiline />

              <TouchableOpacity testID="save-edit-btn" style={styles.saveBtn} onPress={save} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>SAVE CHANGES</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.tileVal}>{value}</Text>
    </View>
  );
}

function EditField({ label, multiline, ...rest }: any) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...rest}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && { height: 90, textAlignVertical: "top", paddingTop: 12 }]}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  profile: { alignItems: "center", marginBottom: spacing.xl },
  bigAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  bigAvatarImg: { width: 110, height: 110 },
  bigInitial: { color: colors.primary, fontSize: 44, fontWeight: "900" },
  name: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: spacing.md },
  phone: { color: colors.textSecondary, fontSize: 14, marginTop: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { width: "47.5%", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 6 },
  tileVal: { color: "#fff", fontSize: 15, fontWeight: "700" },
  notesCard: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  notesText: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  sectionTitle: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 2, marginBottom: spacing.md },
  payRow: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  payAmount: { color: "#fff", fontSize: 16, fontWeight: "800" },
  payMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2 },
  empty: { color: colors.textMuted, textAlign: "center", padding: 16 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.xxl, height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)", backgroundColor: "rgba(239,68,68,0.08)" },
  dangerText: { color: colors.error, fontWeight: "800", letterSpacing: 1.5, fontSize: 12 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, color: "#fff", fontSize: 15 },
  planRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  planChip: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: "center" },
  planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  saveBtn: { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.md, height: 54, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
});
