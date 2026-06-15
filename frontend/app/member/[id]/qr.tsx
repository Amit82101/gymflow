import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";

export default function MemberQR() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    api.memberQR(id!).then(setData).catch((e) => Alert.alert("Error", e.message));
  }, [id]);

  if (!data) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const sendWhatsApp = async () => {
    // Normalize phone — keep digits + leading + only
    const raw = (data.phone || "").replace(/[^\d+]/g, "");
    const phone = raw.startsWith("+") ? raw.slice(1) : raw;
    if (!phone) {
      Alert.alert("No phone number", "This member doesn't have a phone number to send WhatsApp to.");
      return;
    }
    const expiryStr = data.expiry_date || "—";
    const msg =
      `Welcome to ${data.gym} 💪\n\n` +
      `Hi ${data.name}, your gym membership is now active.\n` +
      `Valid until: ${expiryStr}\n\n` +
      `Your unique attendance code: *${data.member_id}*\n` +
      `Use this code (or your QR card) for daily check-in.\n\n` +
      `Need help? Reply to this message.`;
    const url = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
    const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      await Linking.openURL(ok ? url : webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch (e: any) {
        Alert.alert("Failed to open WhatsApp", e.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="qr-back">
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>MEMBER QR</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60, alignItems: "center" }}>
        <View style={styles.card}>
          <Text style={styles.brand}>
            {(data.gym || "GYMFLOW").toUpperCase()}
          </Text>
          <Text style={styles.subBrand}>MEMBER ATTENDANCE CARD</Text>

          <View style={styles.qrFrame}>
            <Image
              source={{ uri: data.qr_image }}
              style={styles.qrImg}
              resizeMode="contain"
              testID="member-qr-image"
            />
          </View>

          <Text style={styles.memberName}>{data.name}</Text>
          <Text style={styles.memberId}>ID · {data.member_id.slice(0, 8).toUpperCase()}</Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.lbl}>PHONE</Text>
              <Text style={styles.val}>{data.phone || "—"}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.lbl}>VALID TILL</Text>
              <Text style={styles.val}>{data.expiry_date || "—"}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity testID="send-whatsapp-btn" style={styles.waBtn} onPress={sendWhatsApp}>
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.waText}>SEND VIA WHATSAPP</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {Platform.OS === "web"
            ? "Opens WhatsApp Web in a new tab with a pre-filled welcome message."
            : "Opens WhatsApp with a pre-filled welcome message — admin taps Send."}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  iconBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border,
    padding: spacing.xl, alignItems: "center", alignSelf: "stretch",
  },
  brand: { color: colors.primary, fontSize: 22, fontWeight: "900", letterSpacing: 4 },
  subBrand: { color: colors.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 3, marginTop: 4 },
  qrFrame: {
    width: 240, height: 240,
    backgroundColor: "#fff", borderRadius: radius.lg,
    padding: 8, marginVertical: spacing.xl,
  },
  qrImg: { width: "100%", height: "100%" },
  memberName: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  memberId: { color: colors.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 2, marginTop: 4 },
  row: { flexDirection: "row", marginTop: spacing.xl, alignSelf: "stretch", gap: 16 },
  col: { flex: 1 },
  lbl: { color: colors.textSecondary, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  val: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: 4 },
  waBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, alignSelf: "stretch", height: 56,
    backgroundColor: "#25D366", borderRadius: radius.md,
  },
  waText: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: spacing.md, paddingHorizontal: spacing.md },
});
