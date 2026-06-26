import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

const PLANS = [
  { id: "monthly", label: "MONTHLY", days: 30, default: 700 },
  { id: "quarterly", label: "QUARTERLY", days: 90, default: 2800 },
  { id: "yearly", label: "YEARLY", days: 365, default: 8400 },
];

export default function NewMember() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    plan: "monthly",
    fee_amount: "700",
    height_cm: "",
    weight_kg: "",
    address: "",
    join_date: "",
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const pickPlan = (id: string) => {
    const p = PLANS.find((x) => x.id === id)!;
    setForm((f) => ({ ...f, plan: id, fee_amount: String(p.default) }));
  };

  const submit = async () => {
   if (
  !form.name.trim() ||
  !form.phone.trim() ||
  !form.join_date.trim()
) {
  Alert.alert(
    "Required",
    "Name, Phone and Joining Date are required"
  );
  return;
    }
    setBusy(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        plan: form.plan,
        fee_amount: parseFloat(form.fee_amount) || 0,
        photo: photo || undefined,
       
        address: form.address || undefined,
    
        join_date: form.join_date.trim(),
      };
      if (form.height_cm) payload.height_cm = parseFloat(form.height_cm);
      if (form.weight_kg) payload.weight_kg = parseFloat(form.weight_kg);
      const created = await api.createMember(payload);
      // Go directly to the QR card for sending via WhatsApp
      router.replace(`/member/${created.id}/qr`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="back-btn">
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>NEW MEMBER</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={42} color={colors.textMuted} />
              )}
            </View>
            <Text style={styles.avatarHint}>Photo (optional)</Text>
          </View>

          <Field label="FULL NAME *" value={form.name} onChangeText={(v:string) => setField("name", v)} placeholder="John Doe" testID="input-name" />
          <Field label="PHONE *" value={form.phone} onChangeText={(v:string) => setField("phone", v)} placeholder="+91 98765 43210" keyboardType="phone-pad" testID="input-phone" />
          <Field label="EMAIL" value={form.email} onChangeText={(v:string) => setField("email", v)} placeholder="john@example.com" keyboardType="email-address" autoCapitalize="none" testID="input-email" />

          <Text style={styles.label}>MEMBERSHIP PLAN</Text>
          <View style={styles.planRow}>
            {PLANS.map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`plan-${p.id}`}
                style={[styles.planChip, form.plan === p.id && styles.planChipActive]}
                onPress={() => pickPlan(p.id)}
              >
                <Text style={[styles.planText, form.plan === p.id && styles.planTextActive]}>{p.label}</Text>
                <Text style={[styles.planDays, form.plan === p.id && { color: "rgba(255,255,255,0.85)" }]}>
                  {p.days}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="FEE AMOUNT (₹)" value={form.fee_amount} onChangeText={(v:string) => setField("fee_amount", v)} keyboardType="numeric" testID="input-fee" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="HEIGHT (cm)" value={form.height_cm} onChangeText={(v:string) => setField("height_cm", v)} keyboardType="numeric" testID="input-height" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="WEIGHT (kg)" value={form.weight_kg} onChangeText={(v:string) => setField("weight_kg", v)} keyboardType="numeric" testID="input-weight" />
            </View>
          </View>

          
          <Field label="ADDRESS" value={form.address} onChangeText={(v:string) => setField("address", v)} placeholder="Street, city" multiline testID="input-address" />
          
          <Field label="JOINING DATE (YYYY-MM-DD) *" value={form.join_date} onChangeText={(v:string) => setField("join_date", v)} placeholder="2023-01-01" testID="input-joiningdate" />

          <TouchableOpacity testID="save-member-btn" style={styles.submit} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>CREATE & GENERATE QR</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...rest }: any) {
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
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  avatarWrap: { alignItems: "center", marginBottom: spacing.xl },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 96, height: 96 },
  avatarHint: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  label: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 6 },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 14, height: 50, color: "#fff", fontSize: 15,
  },
  planRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  planChip: {
    flex: 1, paddingVertical: 12, paddingHorizontal: 10,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center",
  },
  planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planText: { color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  planTextActive: { color: "#fff" },
  planDays: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  submit: {
    marginTop: spacing.xl, backgroundColor: colors.primary,
    borderRadius: radius.md, height: 54, alignItems: "center", justifyContent: "center",
  },
  submitText: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
});
