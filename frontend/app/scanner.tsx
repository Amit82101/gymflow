import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { api } from "@/src/api";
import { colors, radius, spacing } from "@/src/theme";
import { StatusBadge } from "@/src/components/ui";

export default function Scanner() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const lastScanRef = useRef<string>("");
  const lastScanAtRef = useRef<number>(0);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const onScanned = async ({ data }: { data: string }) => {
    if (!scanning || busy) return;
    // Throttle same code within 3s
    const now = Date.now();
    if (data === lastScanRef.current && now - lastScanAtRef.current < 3000) return;
    lastScanRef.current = data;
    lastScanAtRef.current = now;

    setScanning(false);
    setBusy(true);
    try {
      const res = await api.scanQR(data);
      setResult(res);
    } catch (e: any) {
      setResult({ status: "error", message: e.message || "Scan failed" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setResult(null);
    setScanning(true);
  };

  // Web fallback (camera won't work in web preview)
  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header onBack={() => router.back()} />
        <View style={styles.webFallback}>
          <Ionicons name="phone-portrait-outline" size={56} color={colors.primary} />
          <Text style={styles.webTitle}>SCAN ON MOBILE</Text>
          <Text style={styles.webSub}>
            QR scanning requires a real device camera. Open this app in Expo Go on Android/iOS to scan member QR codes.
          </Text>
          <TouchableOpacity
            testID="simulate-scan"
            style={styles.simulateBtn}
            onPress={async () => {
              // Simulate by listing members and scanning the first
              try {
                const m = await api.listMembers();
                if (m[0]) {
                  setBusy(true);
                  const res = await api.scanQR(JSON.stringify({ v: 1, id: m[0].id }));
                  setResult(res);
                  setBusy(false);
                }
              } catch (e: any) {
                Alert.alert("Failed", e.message);
              }
            }}
          >
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={styles.simulateText}>SIMULATE SCAN (1st member)</Text>
          </TouchableOpacity>
        </View>
        {result && <ResultSheet result={result} onReset={reset} />}
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <Header onBack={() => router.back()} />
        <View style={styles.webFallback}>
          <Ionicons name="camera-outline" size={56} color={colors.primary} />
          <Text style={styles.webTitle}>CAMERA ACCESS NEEDED</Text>
          <Text style={styles.webSub}>
            We need your camera to scan member QR codes for attendance.
          </Text>
          {permission.canAskAgain ? (
            <TouchableOpacity style={styles.simulateBtn} onPress={requestPermission}>
              <Text style={styles.simulateText}>GRANT CAMERA ACCESS</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.simulateBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.simulateText}>OPEN SETTINGS</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? onScanned : undefined}
      />
      <SafeAreaView style={StyleSheet.absoluteFillObject} edges={["top"]}>
        <Header onBack={() => router.back()} dark />
        <View style={styles.frameWrap} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.frameHint}>POINT CAMERA AT MEMBER QR</Text>
        </View>
      </SafeAreaView>
      {busy && (
        <View style={styles.busyOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.busyText}>VERIFYING...</Text>
        </View>
      )}
      {result && <ResultSheet result={result} onReset={reset} />}
    </View>
  );
}

function Header({ onBack, dark }: { onBack: () => void; dark?: boolean }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity testID="scanner-back" onPress={onBack} style={[styles.iconBtn, dark && { backgroundColor: "rgba(0,0,0,0.5)" }]}>
        <Ionicons name="chevron-back" size={22} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.title}>QR SCANNER</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function ResultSheet({ result, onReset }: { result: any; onReset: () => void }) {
  const map: Record<string, { color: string; icon: any; title: string }> = {
    checked_in: { color: colors.success, icon: "checkmark-circle", title: "CHECKED IN" },
    checked_out: { color: colors.info, icon: "exit-outline", title: "CHECKED OUT" },
    duplicate: { color: colors.warning, icon: "alert-circle", title: "DUPLICATE SCAN" },
    expired: { color: colors.error, icon: "close-circle", title: "MEMBERSHIP EXPIRED" },
    error: { color: colors.error, icon: "warning", title: "SCAN ERROR" },
  };
  const cfg = map[result.status] || map.error;
  const member = result.member;
  const initial = member?.name?.[0]?.toUpperCase() || "?";

  return (
    <View style={styles.resultBackdrop}>
      <View style={styles.resultSheet}>
        <View style={styles.resultHandle} />
        <View style={[styles.resultIcon, { backgroundColor: cfg.color + "1A", borderColor: cfg.color + "55" }]}>
          <Ionicons name={cfg.icon} size={42} color={cfg.color} />
        </View>
        <Text style={[styles.resultTitle, { color: cfg.color }]}>{cfg.title}</Text>
        <Text style={styles.resultMsg}>{result.message}</Text>

        {member && (
          <View style={styles.memberCard}>
            <View style={styles.memberAvatar}>
              {member.photo ? (
                <Image source={{ uri: member.photo }} style={styles.memberAvatarImg} />
              ) : (
                <Text style={styles.memberInitial}>{initial}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} testID="scan-member-name">{member.name}</Text>
              <Text style={styles.memberMeta}>
                {(member.plan || "").toUpperCase()} · {member.phone}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <StatusBadge status={result.status === "expired" ? "expired" : "active"} />
                <StatusBadge status={member.fee_status === "paid" ? "paid" : "pending"} />
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity testID="scan-again-btn" style={styles.againBtn} onPress={onReset}>
          <Ionicons name="scan" size={18} color="#fff" />
          <Text style={styles.againText}>SCAN ANOTHER</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  webFallback: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
  webTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 2, marginTop: spacing.lg },
  webSub: { color: colors.textSecondary, fontSize: 13, marginTop: spacing.md, textAlign: "center", lineHeight: 20 },
  simulateBtn: {
    marginTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.primary, paddingHorizontal: 20, height: 48,
    borderRadius: radius.md,
  },
  simulateText: { color: "#fff", fontWeight: "800", letterSpacing: 1.5, fontSize: 12 },
  frameWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  frame: {
    width: 260, height: 260,
    borderRadius: 16,
  },
  corner: {
    position: "absolute", width: 36, height: 36,
    borderColor: colors.primary, borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  frameHint: {
    color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 2,
    marginTop: spacing.xl,
  },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  busyText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  resultBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  resultSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing.xl, paddingBottom: 40,
    alignItems: "center",
  },
  resultHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, marginBottom: spacing.lg },
  resultIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  resultTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 2 },
  resultMsg: { color: colors.textSecondary, fontSize: 14, marginTop: 4, textAlign: "center" },
  memberCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface2, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginTop: spacing.lg, alignSelf: "stretch",
  },
  memberAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.bg, alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  memberAvatarImg: { width: 56, height: 56 },
  memberInitial: { color: colors.primary, fontSize: 24, fontWeight: "900" },
  memberName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  memberMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  againBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: spacing.xl, height: 52, backgroundColor: colors.primary,
    borderRadius: radius.md, alignSelf: "stretch",
  },
  againText: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
});
